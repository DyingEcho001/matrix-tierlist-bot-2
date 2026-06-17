import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { queues, queueTesters, queueMembers } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { isVoluntaryTester, hasStaffRole } from "../utils/permissions";
import { getOrCreateQueue, updateQueueEmbed } from "../handlers/queue";
import { logCommand } from "../handlers/audit";

export const endCommand = {
  data: new SlashCommandBuilder()
    .setName("end")
    .setDescription("Close the testing queue for a gamemode and region")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode queue to close")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region queue to close")
        .setRequired(true)
        .addChoices(
          { name: "EU/NA", value: "EU/NA" },
          { name: "AS/AU", value: "AS/AU" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemode = interaction.options.getString("gamemode", true);
    const region = interaction.options.getString("region", true);

    const canTest = await isVoluntaryTester(member, interaction.guildId!, gamemode);
    if (!canTest) {
      await interaction.reply({
        content: `❌ You need the **@Voluntary Tester** and **@${GAMEMODES[gamemode as Gamemode]} Tester** roles to close a queue.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);
    const isRegulatorPlus = await hasStaffRole(member, interaction.guildId!, "regulator");

    const isTester = await db
      .select()
      .from(queueTesters)
      .where(
        and(
          eq(queueTesters.queueId, queue.id),
          eq(queueTesters.discordId, member.id)
        )
      )
      .limit(1);

    if (isTester.length === 0 && !isRegulatorPlus) {
      await interaction.editReply({
        content: "❌ You are not an active tester in this queue.",
      });
      return;
    }

    // Regulators+ who are not in the queue force-close the entire session
    if (isTester.length === 0 && isRegulatorPlus) {
      const activeTesters = await db
        .select()
        .from(queueTesters)
        .where(eq(queueTesters.queueId, queue.id));

      if (activeTesters.length === 0) {
        await interaction.editReply({
          content: `❌ There are no active testers in the **${GAMEMODES[gamemode as Gamemode]}** (${region}) queue to close.`,
        });
        return;
      }

      await db.delete(queueTesters).where(eq(queueTesters.queueId, queue.id));
      await db.delete(queueMembers).where(eq(queueMembers.queueId, queue.id));
      await db
        .update(queues)
        .set({ isActive: false, lastSessionEnd: new Date(), updatedAt: new Date() })
        .where(eq(queues.id, queue.id));

      const closedQueue = { ...queue, isActive: false, lastSessionEnd: new Date() };
      await updateQueueEmbed(client, closedQueue as typeof queue);

      await interaction.editReply({
        content: `✅ Force-closed the **${GAMEMODES[gamemode as Gamemode]}** (${region}) queue and removed ${activeTesters.length} tester(s). All members cleared.`,
      });

      await logCommand(client, {
        command: "end",
        user: member,
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        options: { gamemode, region, forceClose: "true", testersRemoved: String(activeTesters.length) },
      });
      return;
    }

    // Normal path — tester ending their own session
    await db
      .delete(queueTesters)
      .where(
        and(
          eq(queueTesters.queueId, queue.id),
          eq(queueTesters.discordId, member.id)
        )
      );

    const remainingTesters = await db
      .select()
      .from(queueTesters)
      .where(eq(queueTesters.queueId, queue.id));

    if (remainingTesters.length === 0) {
      await db
        .delete(queueMembers)
        .where(eq(queueMembers.queueId, queue.id));

      await db
        .update(queues)
        .set({ isActive: false, lastSessionEnd: new Date(), updatedAt: new Date() })
        .where(eq(queues.id, queue.id));

      const closedQueue = { ...queue, isActive: false, lastSessionEnd: new Date() };
      await updateQueueEmbed(client, closedQueue as typeof queue);

      await interaction.editReply({
        content: `✅ Queue for **${GAMEMODES[gamemode as Gamemode]}** (${region}) has been closed. All members cleared.`,
      });
    } else {
      await interaction.editReply({
        content: `✅ You have left the tester pool. ${remainingTesters.length} tester(s) still active — queue remains open.`,
      });
    }

    await logCommand(client, {
      command: "end",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region },
    });
  },
};
