import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { queues, queueMembers, queueTesters, channelConfig } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { getOrCreateQueue, removeFromQueue } from "../handlers/queue";
import { GAMEMODE_KEYS, GAMEMODES } from "../utils/constants";
import { logCommand } from "../handlers/audit";

export const leaveCommand = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave the waitlist or queue")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode queue to leave")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region queue to leave")
        .setRequired(true)
        .addChoices(
          { name: "EU/NA", value: "EU/NA" },
          { name: "AS/AU", value: "AS/AU" },
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemode = interaction.options.getString("gamemode", true);
    const region = interaction.options.getString("region", true);

    const commandsChannelRow = await db
      .select()
      .from(channelConfig)
      .where(
        and(
          eq(channelConfig.guildId, interaction.guildId!),
          eq(channelConfig.configKey, "commands")
        )
      )
      .limit(1);

    if (commandsChannelRow[0] && interaction.channelId !== commandsChannelRow[0].channelId) {
      await interaction.reply({
        content: `❌ This command can only be used in <#${commandsChannelRow[0].channelId}>.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    const queue = await getOrCreateQueue(gamemode, region);

    const inQueue = await db
      .select()
      .from(queueMembers)
      .where(
        and(
          eq(queueMembers.queueId, queue.id),
          eq(queueMembers.discordId, member.id)
        )
      )
      .limit(1);

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

    if (inQueue.length === 0 && isTester.length === 0) {
      await interaction.editReply({
        content: "❌ You are not in this queue.",
      });
      return;
    }

    if (inQueue.length > 0) {
      await removeFromQueue(queue.id, member.id);
    }

    if (isTester.length > 0) {
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
          .update(queues)
          .set({ isActive: false, lastSessionEnd: new Date(), updatedAt: new Date() })
          .where(eq(queues.id, queue.id));

        const { updateQueueEmbed } = await import("../handlers/queue");
        const updatedQueue = { ...queue, isActive: false, lastSessionEnd: new Date() };
        await updateQueueEmbed(client, updatedQueue as typeof queue);
      }
    }

    await interaction.editReply({
      content: `✅ <@${member.id}> has left the **${GAMEMODES[gamemode as keyof typeof GAMEMODES]}** (${region}) queue.`,
    });

    await logCommand(client, {
      command: "leave",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region },
    });
  },
};
