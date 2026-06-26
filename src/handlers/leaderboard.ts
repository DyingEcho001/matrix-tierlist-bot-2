import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { db } from "../database";
import { testerStats, channelConfig } from "../database/schema";
import { desc, eq, sql, and } from "drizzle-orm";

const leaderboardMessages = new Map<string, { channelId: string; messageId: string }>();

function getMonthName(): string {
  return new Date().toLocaleString("en-US", { month: "long" });
}

function buildLeaderboardEmbed(
  allTimeRows: Array<{ discordId: string; allTimeTests: number | null }>,
  monthlyRows: Array<{ discordId: string; monthlyTests: number | null }>,
  totalMonthly: number,
  guildName: string
): EmbedBuilder {
  const month = getMonthName();

  const allTimeLines =
    allTimeRows.length > 0
      ? allTimeRows.map(
          (r, i) => `${i + 1}. <@${r.discordId}> — **${r.allTimeTests ?? 0}** tests`
        )
      : ["*No data yet.*"];

  const monthlyLines =
    monthlyRows.length > 0
      ? monthlyRows.map(
          (r, i) => `${i + 1}. <@${r.discordId}> — **${r.monthlyTests ?? 0}** tests`
        )
      : ["*No data yet.*"];

  return new EmbedBuilder()
    .setTitle("📊 Testing Leaderboard")
    .setColor(0x6C3483)
    .setDescription(
      [
        "🏆 **All Time Testing Leaderboard**",
        "",
        ...allTimeLines,
        "",
        `🥇 **${month} Testing Leaderboard**`,
        "",
        ...monthlyLines,
        "",
        `**Total Tests in ${month} : ${totalMonthly}**`,
      ].join("\n")
    )
    .setFooter({ text: guildName });
}

export async function postOrUpdateLeaderboard(
  client: Client,
  guildId: string
): Promise<void> {
  const channelRow = await db
    .select()
    .from(channelConfig)
    .where(
      and(
        eq(channelConfig.guildId, guildId),
        eq(channelConfig.configKey, "testing_leaderboard")
      )
    )
    .limit(1);

  if (!channelRow[0]) return;
  const channelId = channelRow[0].channelId;

  const channel = (await client.channels
    .fetch(channelId)
    .catch(() => null)) as TextChannel | null;
  if (!channel) return;

  const [allTimeRows, monthlyRows, totalRow] = await Promise.all([
    db
      .select({ discordId: testerStats.discordId, allTimeTests: testerStats.allTimeTests })
      .from(testerStats)
      .orderBy(desc(testerStats.allTimeTests))
      .limit(10),
    db
      .select({ discordId: testerStats.discordId, monthlyTests: testerStats.monthlyTests })
      .from(testerStats)
      .orderBy(desc(testerStats.monthlyTests))
      .limit(10),
    db
      .select({ total: sql<number>`COALESCE(SUM(monthly_tests), 0)` })
      .from(testerStats),
  ]);

  const filteredMonthly = monthlyRows.filter((r) => (r.monthlyTests ?? 0) > 0);
  const totalMonthly = Number(totalRow[0]?.total ?? 0);
  const guildName = client.guilds.cache.get(guildId)?.name ?? "Testing Leaderboard";

  const embed = buildLeaderboardEmbed(allTimeRows, filteredMonthly, totalMonthly, guildName);

  const existing = leaderboardMessages.get(guildId);

  if (existing && existing.channelId === channelId) {
    try {
      const msg = await channel.messages.fetch(existing.messageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      // Message was deleted or unreachable — fall through to scan channel
    }
  }

  // Survive restarts: scan recent messages for an existing bot leaderboard embed
  try {
    const recent = await channel.messages.fetch({ limit: 20 });
    const botLeaderboard = recent.find(
      (m) =>
        m.author.id === client.user!.id &&
        m.embeds.length > 0 &&
        m.embeds[0].title === "📊 Testing Leaderboard"
    );
    if (botLeaderboard) {
      await botLeaderboard.edit({ embeds: [embed] });
      leaderboardMessages.set(guildId, { channelId, messageId: botLeaderboard.id });
      return;
    }
  } catch {
    // Could not scan — fall through to post new
  }

  const msg = await channel.send({ embeds: [embed] });
  leaderboardMessages.set(guildId, { channelId, messageId: msg.id });
}

export async function updateAllLeaderboards(client: Client): Promise<void> {
  const rows = await db
    .select()
    .from(channelConfig)
    .where(eq(channelConfig.configKey, "testing_leaderboard"));

  for (const row of rows) {
    await postOrUpdateLeaderboard(client, row.guildId).catch((err) => {
      console.error(`[Leaderboard] Error updating guild ${row.guildId}:`, err);
    });
  }
}

export function startLeaderboardLoop(client: Client): void {
  const INTERVAL = 12 * 60 * 1000;

  updateAllLeaderboards(client).catch((err) =>
    console.error("[Leaderboard] Initial update error:", err)
  );

  setInterval(() => {
    updateAllLeaderboards(client).catch((err) =>
      console.error("[Leaderboard] Loop error:", err)
    );
  }, INTERVAL);
}
