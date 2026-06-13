import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { db } from "../database";
import { testerStats } from "../database/schema";
import { desc, gt } from "drizzle-orm";
import { EMBED_COLORS } from "../utils/constants";
import { logCommand } from "../handlers/audit";

const MEDALS = ["🥇", "🥈", "🥉"];

export const alltimeLeaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("alltime-leaderboard")
    .setDescription("View the all-time tester leaderboard")
    .setDefaultMemberPermissions(null),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;

    await interaction.deferReply();

    const rows = await db
      .select()
      .from(testerStats)
      .orderBy(desc(testerStats.allTimeTests))
      .limit(20);

    if (rows.length === 0) {
      await interaction.editReply({
        content: "❌ No tester data found yet.",
      });
      return;
    }

    const lines = await Promise.all(
      rows.map(async (row, i) => {
        const medal = MEDALS[i] ?? `**${i + 1}.**`;
        let name: string;
        try {
          const user = await client.users.fetch(row.discordId);
          name = user.username;
        } catch {
          name = `<@${row.discordId}>`;
        }
        return `${medal} **${name}** — ${row.allTimeTests ?? 0} tests`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle("🏆 All-Time Tester Leaderboard")
      .setDescription(lines.join("\n"))
      .setColor(0xffd700)
      .setFooter({ text: `Top ${rows.length} testers • All time` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logCommand(client, {
      command: "alltime-leaderboard",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: {},
    });
  },
};
