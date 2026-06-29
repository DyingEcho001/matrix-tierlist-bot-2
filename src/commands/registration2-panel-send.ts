import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { requireSuperAdmin } from "../utils/permissions";
import { logCommand } from "../handlers/audit";
import {
  GAMEMODES,
  GAMEMODE_KEYS,
  GAMEMODE_BUTTON_EMOJIS,
  Gamemode,
} from "../utils/constants";

function makeButtonEmoji(
  gm: Gamemode
): { id: string; name: string } | { name: string } | undefined {
  const e = GAMEMODE_BUTTON_EMOJIS[gm];
  if (typeof e === "string") return { name: e };
  if (e && typeof e === "object" && "id" in e && e.id)
    return { id: e.id, name: e.name };
  return undefined;
}

function buildPanel2Embed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("⚡ Matrix Tierlist — Player Evaluation")
    .setDescription(
      "Get evaluated by our certified testers. Follow the steps below to join the queue."
    )
    .addFields(
      {
        name: "📋  Step 1 — Register Your Profile",
        value:
          "Set your **IGN**, **region**, and **account type** using the button below.\n> This is required before you can join any gamemode waitlist.",
        inline: false,
      },
      {
        name: "🎮  Step 2 — Join a Waitlist",
        value:
          "Tap any gamemode button to receive the matching waitlist role.\n> You'll be pinged automatically when a tester opens a session in your region.",
        inline: false,
      },
      {
        name: "🏆  Step 3 — Attend Your Test",
        value:
          "Join the session when called by your tester.\n> Results are posted to the results channel after your evaluation.",
        inline: false,
      },
      {
        name: "ℹ️  Rules & Cooldowns",
        value: [
          "⏱ **Cooldown:** 5 days per test · 15 days for HT3+",
          "📌 **LT2 and above?** Open a high-tier ticket instead of joining the queue",
          "✅ **Validity:** Only authentic account and gameplay info is accepted",
        ].join("\n"),
        inline: false,
      }
    )
    .setFooter({
      text: "Matrix Tierlist | Dev — DyingEcho  •  Use the buttons below to get started",
    })
    .setTimestamp();
}

function buildPanel2Rows(skipEmoji = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const registerBtn = new ButtonBuilder()
    .setCustomId("register_profile")
    .setLabel("Register / Update Profile")
    .setStyle(ButtonStyle.Primary)
    .setEmoji({ id: "1475200135108628523", name: "BOOK_QUILL" });

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(registerBtn));

  for (let i = 0; i < GAMEMODE_KEYS.length; i += 4) {
    const chunk = GAMEMODE_KEYS.slice(i, i + 4);
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
    .setDescription("Send the alternate registration panel to a channel (Super Admin only)")
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
      const embed = buildPanel2Embed();
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
      content: `✅ Alternate registration panel sent to <#${channel.id}>.`,
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
