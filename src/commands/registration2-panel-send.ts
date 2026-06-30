import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { requireSuperAdmin } from "../utils/permissions";
import { buildRegistrationPanelEmbed } from "../utils/embeds";
import { logCommand } from "../handlers/audit";
import { GAMEMODES, GAMEMODE_BUTTON_EMOJIS, Gamemode } from "../utils/constants";

const GAMEMODE_KEYS = Object.keys(GAMEMODES) as Gamemode[];

function makeButtonEmoji(
  gm: Gamemode
): { id: string; name: string } | { name: string } | undefined {
  const e = GAMEMODE_BUTTON_EMOJIS[gm];
  if (typeof e === "string") return { name: e };
  if (e && typeof e === "object" && "id" in e && e.id)
    return { id: e.id, name: e.name };
  return undefined;
}

function buildPanel2Rows(skipEmoji = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Row 1: 4 disabled spacer buttons to push the register button to the right
  const registerBtn = new ButtonBuilder()
    .setCustomId("register_profile")
    .setLabel("Register / Update Profile")
    .setStyle(ButtonStyle.Primary)
    .setEmoji({ id: "1475200135108628523", name: "BOOK_QUILL" });

  const spacers = [1, 2, 3, 4].map((n) =>
    new ButtonBuilder()
      .setCustomId(`panel2_spacer_${n}`)
      .setLabel("\u200b")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...spacers, registerBtn)
  );

  // Remaining rows: gamemode buttons (5 per row) — these are the waitlist role buttons
  for (let i = 0; i < GAMEMODE_KEYS.length; i += 5) {
    const chunk = GAMEMODE_KEYS.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...chunk.map((gm) => {
        const btn = new ButtonBuilder()
          .setCustomId(`join_gamemode_${gm}`)
          .setLabel(GAMEMODES[gm])
          .setStyle(ButtonStyle.Secondary);
        if (!skipEmoji) {
          const emoji = makeButtonEmoji(gm);
          if (emoji) btn.setEmoji(emoji);
        }
        return btn;
      })
    );
    rows.push(row);
  }

  return rows;
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
      // Use the original registration panel embed, with the new button layout
      const embed = buildRegistrationPanelEmbed();
      let rows = buildPanel2Rows(false);
      try {
        await targetChannel.send({ embeds: [embed], components: rows });
      } catch (emojiErr: any) {
        const msg: string = emojiErr?.message ?? String(emojiErr);
        if (
          msg.includes("emoji") ||
          msg.includes("COMPONENT_INVALID_EMOJI") ||
          emojiErr?.code === 50035
        ) {
          rows = buildPanel2Rows(true);
          await targetChannel.send({ embeds: [embed], components: rows });
        } else {
          throw emojiErr;
        }
      }
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
