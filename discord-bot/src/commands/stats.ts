import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { db } from "../database";
import { testerStats, players, tiers } from "../database/schema";
import { eq } from "drizzle-orm";
import { GAMEMODES, TIER_LABELS, EMBED_COLORS, Gamemode, Tier } from "../utils/constants";
import { logCommand } from "../handlers/audit";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View a tester's stats")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("The tester to view stats for")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const targetUser = interaction.options.getUser("user", true);

    await interaction.deferReply({ ephemeral: true });

    const statsRow = await db
      .select()
      .from(testerStats)
      .where(eq(testerStats.discordId, targetUser.id))
      .limit(1);

    const now = new Date();
    const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

    const allTimeTests = statsRow[0]?.allTimeTests ?? 0;
    const monthlyTests = statsRow[0]?.monthlyTests ?? 0;

    const playerRow = await db
      .select()
      .from(players)
      .where(eq(players.discordId, targetUser.id))
      .limit(1);

    const ign = playerRow[0]?.ign ?? targetUser.username;
    const region = playerRow[0]?.region ?? "Unknown";

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${ign}'s Tester Stats`,
        iconURL: targetUser.displayAvatarURL({ size: 128 }),
      })
      .setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`)
      .setColor(0xffd700)
      .addFields(
        {
          name: "👤 Discord",
          value: `<@${targetUser.id}>`,
          inline: true,
        },
        {
          name: "🌍 Region",
          value: region,
          inline: true,
        },
        {
          name: "\u200B",
          value: "\u200B",
          inline: true,
        },
        {
          name: "🏆 All-Time Tests",
          value: `**${allTimeTests}**`,
          inline: true,
        },
        {
          name: `📅 ${monthLabel}`,
          value: `**${monthlyTests}**`,
          inline: true,
        },
        {
          name: "\u200B",
          value: "\u200B",
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: `Stats for ${ign}` });

    await interaction.editReply({ embeds: [embed] });

    await logCommand(client, {
      command: "stats",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id },
    });
  },
};
