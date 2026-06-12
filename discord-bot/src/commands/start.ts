import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { queues, queueTesters, channelConfig } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, REGION_KEYS } from "../utils/constants";
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
          { name: "NA", value: "NA" },
          { name: "EU", value: "EU" },
          { name: "AS", value: "AS" },
          { name: "SA", value: "SA" },
          { name: "AU", value: "AU" }
        )
    )
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Channel to post the queue in (optional, uses configured channel by default)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemode = interaction.options.getString("gamemode", true);
    const region = interaction.options.getString("region", true);
    const channelOption = interaction.options.getChannel("channel");

    const canTest = await isVoluntaryTester(member, interaction.guildId!, gamemode);
    if (!canTest) {
      await interaction.reply({
        content: `❌ You need the **@Voluntary Tester** role and **@${GAMEMODES[gamemode as keyof typeof GAMEMODES]}Tester** role to open a queue.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);

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

    let targetChannelId = queue.channelId;

    if (channelOption) {
      targetChannelId = channelOption.id;
    } else if (!targetChannelId) {
      const configRow = await db
        .select()
        .from(channelConfig)
        .where(
          and(
            eq(channelConfig.guildId, interaction.guildId!),
            eq(channelConfig.configKey, `waitlist_${gamemode}_${region}`)
          )
        )
        .limit(1);

      if (!configRow[0]) {
        await interaction.editReply({
          content:
            "❌ No channel configured for this queue. Use `/set-channel` or provide a channel option.",
        });
        return;
      }
      targetChannelId = configRow[0].channelId;
    }

    await db.insert(queueTesters).values({
      queueId: queue.id,
      discordId: member.id,
    }).onConflictDoNothing();

    await db
      .update(queues)
      .set({ isActive: true, channelId: targetChannelId, updatedAt: new Date() })
      .where(eq(queues.id, queue.id));

    const updatedQueue = { ...queue, isActive: true, channelId: targetChannelId };
    await updateQueueEmbed(client, updatedQueue as typeof queue);

    await interaction.editReply({
      content: `✅ Queue opened for **${GAMEMODES[gamemode as keyof typeof GAMEMODES]}** (${region}). Queue embed posted in <#${targetChannelId}>.`,
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
