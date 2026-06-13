import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { db } from "../database";
import { testerStats } from "../database/schema";
import { desc } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { EMBED_COLORS } from "../utils/constants";
import { logCommand } from "../handlers/audit";

const MEDALS = ["🥇", "🥈", "🥉"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const monthlyLeaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("monthly-leaderboard")
    .setDescription("View the monthly tester roster/leaderboard (Helper+)")
    .setDefaultMemberPermissions(null),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "helper"))) return;

    await interaction.deferReply();

    const rows = await db
      .select()
      .from(testerStats)
      .orderBy(desc(testerStats.monthlyTests))
      .limit(20);

    const activeRows = rows.filter((r) => (r.monthlyTests ?? 0) > 0);

    if (activeRows.length === 0) {
      await interaction.editReply({
        content: "❌ No tester data for this month yet.",
      });
      return;
    }

    const now = new Date();
    const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

    const lines = await Promise.all(
      activeRows.map(async (row, i) => {
        const medal = MEDALS[i] ?? `**${i + 1}.**`;
        let name: string;
        try {
          const user = await client.users.fetch(row.discordId);
          name = user.username;
        } catch {
          name = `<@${row.discordId}>`;
        }
        return `${medal} **${name}** — ${row.monthlyTests ?? 0} tests`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle(`📅 Monthly Tester Roster — ${monthLabel}`)
      .setDescription(lines.join("\n"))
      .setColor(0x5865f2)
      .addFields({
        name: "Active Testers This Month",
        value: `${activeRows.length} tester${activeRows.length !== 1 ? "s" : ""}`,
        inline: true,
      })
      .setFooter({ text: `Resets at the start of each month` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logCommand(client, {
      command: "monthly-leaderboard",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: {},
    });
  },
};
