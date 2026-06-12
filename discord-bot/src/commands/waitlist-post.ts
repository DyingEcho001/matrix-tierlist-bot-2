import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
} from "discord.js";
import { db } from "../database";
import { queues, channelConfig } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { requireStaff } from "../utils/permissions";
import {
  buildQueueClosedEmbed,
  buildQueueOpenEmbed,
  buildQueueOpenRow,
} from "../utils/embeds";
import {
  getOrCreateQueue,
  getQueueMembers,
  getQueueTesters,
  updateQueueEmbed,
} from "../handlers/queue";
import { logCommand } from "../handlers/audit";

export const waitlistPostCommand = {
  data: new SlashCommandBuilder()
    .setName("waitlist-post")
    .setDescription("Post a queue embed for a gamemode/region (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("Gamemode")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("Region")
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
        .setDescription("Channel to post the queue embed in")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const region = interaction.options.getString("region", true);
    const channel = interaction.options.getChannel("channel", true);

    const targetChannel = (await client.channels
      .fetch(channel.id)
      .catch(() => null)) as TextChannel | null;

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({
        content: "❌ Invalid channel.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);

    await db
      .update(queues)
      .set({ channelId: channel.id, updatedAt: new Date() })
      .where(eq(queues.id, queue.id));

    await db
      .insert(channelConfig)
      .values({
        guildId: interaction.guildId!,
        configKey: `waitlist_${gamemode}_${region}`,
        channelId: channel.id,
      })
      .onConflictDoUpdate({
        target: [channelConfig.guildId, channelConfig.configKey],
        set: { channelId: channel.id, updatedAt: new Date() },
      });

    const updatedQueue = { ...queue, channelId: channel.id };
    await updateQueueEmbed(client, updatedQueue as typeof queue);

    await interaction.editReply({
      content: `✅ Queue embed for **${GAMEMODES[gamemode]}** (${region}) posted in <#${channel.id}>.`,
    });

    await logCommand(client, {
      command: "waitlist-post",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region, channel: channel.id },
    });
  },
};
