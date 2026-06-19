import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { queues, queueTesters } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, REGION_KEYS, REGIONS } from "../utils/constants";
import { isVoluntaryTester } from "../utils/permissions";
import { getOrCreateQueue, updateQueueEmbed } from "../handlers/queue";
import { logCommand } from "../handlers/audit";

export const startCommand = {
  data: new SlashCommandBuilder()
    .setName("start")
    .setDescription("Open a testing queue for a specific gamemode and region")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode to open a queue for")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region for this queue")
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
        content: `❌ You need the **@Voluntary Tester** role and the **@${GAMEMODES[gamemode as keyof typeof GAMEMODES]} Tester** role to open a queue.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);

    // Block opening a second queue while already active in one
    const anyActiveQueue = await db
      .select({ queue: queues })
      .from(queueTesters)
      .innerJoin(queues, eq(queueTesters.queueId, queues.id))
      .where(eq(queueTesters.discordId, member.id))
      .limit(1);

    if (anyActiveQueue.length > 0) {
      const active = anyActiveQueue[0].queue;
      await interaction.editReply({
        content: `❌ You already have an active **${GAMEMODES[active.gamemode as keyof typeof GAMEMODES]}** (${active.region}) queue open. Use \`/end\` to close it before starting a new one.`,
      });
      return;
    }

    if (!queue.channelId) {
      await interaction.editReply({
        content: "❌ No channel has been assigned to this queue yet. Ask an admin to use `/waitlist-post` to set it up first.",
      });
      return;
    }

    await db.insert(queueTesters).values({
      queueId: queue.id,
      discordId: member.id,
    }).onConflictDoNothing();

    await db
      .update(queues)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(queues.id, queue.id));

    const updatedQueue = { ...queue, isActive: true };
    await updateQueueEmbed(client, updatedQueue as typeof queue);

    await interaction.editReply({
      content: `✅ Queue opened for **${GAMEMODES[gamemode as keyof typeof GAMEMODES]}** (${region}). Queue embed updated in <#${queue.channelId}>.`,
    });

    await logCommand(client, {
      command: "start",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region },
    });
  },
};
