import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { queues, queueTesters } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { isVoluntaryTester } from "../utils/permissions";
import { getOrCreateQueue, updateQueueEmbed } from "../handlers/queue";
import { logCommand } from "../handlers/audit";

export const joinTesterPoolCommand = {
  data: new SlashCommandBuilder()
    .setName("join-tester-pool")
    .setDescription("Join an existing queue as an additional tester (requires tester roles)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode queue to join as tester")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region queue to join")
        .setRequired(true)
        .addChoices(
          { name: "NA", value: "NA" },
          { name: "EU", value: "EU" },
          { name: "AS", value: "AS" },
          { name: "SA", value: "SA" },
          { name: "AU", value: "AU" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemode = interaction.options.getString("gamemode", true);
    const region = interaction.options.getString("region", true);

    const canTest = await isVoluntaryTester(member, interaction.guildId!, gamemode);
    if (!canTest) {
      await interaction.reply({
        content: `❌ You need **@Voluntary Tester** and **@${GAMEMODES[gamemode as Gamemode]}Tester** roles to join the tester pool.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);

    if (!queue.isActive) {
      await interaction.editReply({
        content: "❌ There is no active queue for this gamemode and region. Use `/start` to open one.",
      });
      return;
    }

    const alreadyTesting = await db
      .select()
      .from(queueTesters)
      .where(
        and(
          eq(queueTesters.queueId, queue.id),
          eq(queueTesters.discordId, member.id)
        )
      )
      .limit(1);

    if (alreadyTesting.length > 0) {
      await interaction.editReply({
        content: "❌ You are already in this queue as a tester.",
      });
      return;
    }

    await db.insert(queueTesters).values({
      queueId: queue.id,
      discordId: member.id,
    });

    await updateQueueEmbed(client, queue);

    await interaction.editReply({
      content: `✅ You have joined the **${GAMEMODES[gamemode as Gamemode]}** (${region}) tester pool.`,
    });

    await logCommand(client, {
      command: "join-tester-pool",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region },
    });
  },
};
