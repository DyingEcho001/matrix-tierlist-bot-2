import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { requireSuperAdmin } from "../utils/permissions";
import { buildRegistrationPanelEmbed } from "../utils/embeds";
import { logCommand } from "../handlers/audit";
import { GAMEMODES, GAMEMODE_KEYS, Gamemode } from "../utils/constants";

function buildPanel2Components(): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  // Row 1: Green register button
  const registerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("register_profile")
      .setLabel("Register / Update Profile")
      .setStyle(ButtonStyle.Success)
      .setEmoji({ id: "1475200135108628523", name: "BOOK_QUILL" })
  );

  // Row 2: Select menu for gamemodes
  const options = GAMEMODE_KEYS.map((gm: Gamemode) =>
    new StringSelectMenuOptionBuilder()
      .setValue(gm)
      .setLabel(GAMEMODES[gm])
  );

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_gamemode_waitlist")
      .setPlaceholder("Select a gamemode to get the waitlist role")
      .addOptions(options)
  );

  return [registerRow, selectRow];
}

export const registration2PanelSendCommand = {
  data: new SlashCommandBuilder()
    .setName("registration2-panel-send")
    .setDescription("Send the registration panel (v2 layout) to a channel (Super Admin only)")
    .setDefaultMemberPermissions(null)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Channel to send the panel to")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    if (!(await requireSuperAdmin(interaction))) return;

    const channel = interaction.options.getChannel("channel", true);
    const targetChannel = (await client.channels
      .fetch(channel.id)
      .catch(() => null)) as TextChannel | null;

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.editReply({ content: "❌ Invalid channel." });
      return;
    }

    try {
      const embed = buildRegistrationPanelEmbed();
      const components = buildPanel2Components();
      await targetChannel.send({ embeds: [embed], components });
    } catch (err) {
      await interaction.editReply({
        content: `❌ Failed to send the panel: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    await interaction.editReply({
      content: `✅ Registration panel (v2) sent to <#${channel.id}>.`,
    });

    await logCommand(client, {
      command: "registration2-panel-send",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { channel: channel.id },
    });
  },
};
