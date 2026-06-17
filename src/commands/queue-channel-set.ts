import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
} from "discord.js";
import { db } from "../database";
import { queues, channelConfig } from "../database/schema";
import { eq } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { requireStaff } from "../utils/permissions";
import { getOrCreateQueue, updateQueueEmbed } from "../handlers/queue";
import { logCommand } from "../handlers/audit";

export const queueChannelSetCommand = {
  data: new SlashCommandBuilder()
    .setName("queue-channel-set")
    .setDescription("Assign the channel where a queue embed is posted (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region")
        .setRequired(true)
        .addChoices(
          { name: "EU/NA", value: "EU/NA" },
          { name: "AS/AU", value: "AS/AU" }
        )
    )
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("The channel to post queue embeds in")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const region = interaction.options.getString("region", true);
    const channelOption = interaction.options.getChannel("channel", true);

    const targetChannel = (await client.channels
      .fetch(channelOption.id)
      .catch(() => null)) as TextChannel | null;

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({
        content: "❌ Invalid channel — must be a text channel.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);

    await db
      .update(queues)
      .set({ channelId: channelOption.id, updatedAt: new Date() })
      .where(eq(queues.id, queue.id));

    await db
      .insert(channelConfig)
      .values({
        guildId: interaction.guildId!,
        configKey: `waitlist_${gamemode}_${region}`,
        channelId: channelOption.id,
      })
      .onConflictDoUpdate({
        target: [channelConfig.guildId, channelConfig.configKey],
        set: { channelId: channelOption.id, updatedAt: new Date() },
      });

    const updatedQueue = { ...queue, channelId: channelOption.id };
    await updateQueueEmbed(client, updatedQueue as typeof queue);

    await interaction.editReply({
      content: `✅ Queue channel for **${GAMEMODES[gamemode]}** (${region}) set to <#${channelOption.id}>.\n\nAll future \`/start\` and \`/end\` embeds for this queue will be posted and edited there.`,
    });

    await logCommand(client, {
      command: "queue-channel-set",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region, channel: channelOption.id },
    });
  },
};
