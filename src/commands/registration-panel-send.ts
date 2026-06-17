import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
} from "discord.js";
import { requireStaff } from "../utils/permissions";
import {
  buildRegistrationPanelEmbed,
  buildRegistrationPanelRows,
} from "../utils/embeds";
import { logCommand } from "../handlers/audit";

export const registrationPanelSendCommand = {
  data: new SlashCommandBuilder()
    .setName("registration-panel-send")
    .setDescription("Send the registration/waitlist panel to a channel (Manager only)")
    .setDefaultMemberPermissions(null)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Channel to send the panel to")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

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

    const embed = buildRegistrationPanelEmbed();
    const rows = buildRegistrationPanelRows();

    await targetChannel.send({
      embeds: [embed],
      components: rows,
    });

    await interaction.reply({
      content: `✅ Registration panel sent to <#${channel.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "registration-panel-send",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { channel: channel.id },
    });
  },
};
