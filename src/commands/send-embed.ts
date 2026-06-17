import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { requireStaff } from "../utils/permissions";
import { EMBED_COLORS } from "../utils/constants";
import { logCommand } from "../handlers/audit";

export const sendEmbedCommand = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Send a text embed to a channel (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("title")
        .setDescription("The title of the embed")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("text")
        .setDescription("The text content to send in the embed")
        .setRequired(true)
    )
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("The channel to send the embed in")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("watermark")
        .setDescription("Optional watermark text shown in the footer")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const title = interaction.options.getString("title", true);
    const text = interaction.options.getString("text", true);
    const watermark = interaction.options.getString("watermark", false);
    const channelOption = interaction.options.getChannel("channel", true);

    const targetChannel = (await client.channels
      .fetch(channelOption.id)
      .catch(() => null)) as TextChannel | null;

    if (!targetChannel || !("send" in targetChannel)) {
      await interaction.reply({
        content: "❌ Invalid channel — must be a text channel.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(text)
      .setColor(EMBED_COLORS.primary)
      .setTimestamp();

    if (watermark) {
      embed.setFooter({ text: watermark });
    }

    await (targetChannel as TextChannel).send({ embeds: [embed] });

    await interaction.reply({
      content: `✅ Embed sent to <#${channelOption.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "embed",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { title, channel: channelOption.id, watermark: watermark ?? "none" },
    });
  },
};
