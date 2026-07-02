import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { queueTesters } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { getOrCreateQueue, updateQueueEmbed } from "../handlers/queue";
import { logCommand } from "../handlers/audit";

export const leaveTesterPoolCommand = {
  data: new SlashCommandBuilder()
    .setName("leave-tester-pool")
    .setDescription("Leave the tester pool for a queue you previously joined")
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
          { name: "AS/AU", value: "AS/AU" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemode = interaction.options.getString("gamemode", true);
    const region = interaction.options.getString("region", true);

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);

    const testerRow = await db
      .select()
      .from(queueTesters)
      .where(
        and(
          eq(queueTesters.queueId, queue.id),
          eq(queueTesters.discordId, member.id)
        )
      )
      .limit(1);

    if (testerRow.length === 0) {
      await interaction.editReply({
        content: `❌ You are not in the **${GAMEMODES[gamemode as Gamemode]}** (${region}) tester pool.`,
      });
      return;
    }

    await db
      .delete(queueTesters)
      .where(
        and(
          eq(queueTesters.queueId, queue.id),
          eq(queueTesters.discordId, member.id)
        )
      );

    await updateQueueEmbed(client, queue);

    await interaction.editReply({
      content: `✅ You have left the **${GAMEMODES[gamemode as Gamemode]}** (${region}) tester pool.`,
    });

    await logCommand(client, {
      command: "leave-tester-pool",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region },
    });
  },
};
