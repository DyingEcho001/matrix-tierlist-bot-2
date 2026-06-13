import {
  Client,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import { db } from "../database";
import {
  tickets,
  categoryConfig,
  channelConfig,
  testerStats,
  players,
  cooldowns,
  tiers,
} from "../database/schema";
import { eq, and } from "drizzle-orm";
import { buildTicketInfoEmbed, buildTestResultEmbed } from "../utils/embeds";
import { GAMEMODES, Gamemode, Tier, COOLDOWNS, HT3_PLUS_TIERS } from "../utils/constants";

export async function getCategoryId(
  guildId: string,
  key: string
): Promise<string | null> {
  const row = await db
    .select()
    .from(categoryConfig)
    .where(
      and(
        eq(categoryConfig.guildId, guildId),
        eq(categoryConfig.configKey, key)
      )
    )
    .limit(1);
  return row[0]?.categoryId ?? null;
}

export async function getChannelId(
  guildId: string,
  key: string
): Promise<string | null> {
  const row = await db
    .select()
    .from(channelConfig)
    .where(
      and(
        eq(channelConfig.guildId, guildId),
        eq(channelConfig.configKey, key)
      )
    )
    .limit(1);
  return row[0]?.channelId ?? null;
}

export async function createTestingTicket(params: {
  guild: Guild;
  tester: GuildMember;
  testee: GuildMember;
  gamemode: Gamemode;
  region: string;
  type?: string;
}): Promise<TextChannel | null> {
  const { guild, tester, testee, gamemode, region, type = "normal" } = params;

  const categoryId = await getCategoryId(guild.id, "testing_category");

  const playerData = await db
    .select()
    .from(players)
    .where(eq(players.discordId, testee.id))
    .limit(1);

  const playerInfo = playerData[0];

  const previousTierRow = await db
    .select()
    .from(tiers)
    .where(and(eq(tiers.discordId, testee.id), eq(tiers.gamemode, gamemode)))
    .limit(1);

  const previousTier = previousTierRow[0]?.tier ?? null;

  const channelName = `${gamemode.replace(/_/g, "-")}-${testee.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`.slice(0, 100);

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId ?? undefined,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: tester.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: testee.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: guild.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });

    await db
      .insert(tickets)
      .values({
        type,
        gamemode,
        region,
        testerId: tester.id,
        testeeId: testee.id,
        channelId: channel.id,
        guildId: guild.id,
        status: "open",
      })
      .returning();

    const infoEmbed = buildTicketInfoEmbed({
      testee,
      ign: playerInfo?.ign ?? testee.user.username,
      region: playerInfo?.region ?? region,
      preferredServer: playerInfo?.preferredServer ?? "Unknown",
      isPremium: playerInfo?.isPremium,
      previousTier,
    });

    await channel.send({
      content: `<@${tester.id}> <@${testee.id}>`,
      embeds: [infoEmbed],
    });

    return channel;
  } catch (err) {
    console.error("Failed to create testing ticket:", err);
    return null;
  }
}

export async function closeTicket(params: {
  client: Client;
  ticket: typeof tickets.$inferSelect;
  tier: Tier;
  closedBy: string;
  skipCooldown?: boolean;
}): Promise<void> {
  const { client, ticket, tier, closedBy, skipCooldown = false } = params;

  const isHT3Plus = HT3_PLUS_TIERS.includes(tier);
  const cooldownMs = isHT3Plus ? COOLDOWNS.ht3 : COOLDOWNS.normal;
  const cooldownDays = isHT3Plus ? 15 : 5;

  await db
    .insert(tiers)
    .values({ discordId: ticket.testeeId, gamemode: ticket.gamemode, tier, givenBy: closedBy })
    .onConflictDoUpdate({
      target: [tiers.discordId, tiers.gamemode],
      set: { tier, givenBy: closedBy, updatedAt: new Date() },
    });

  if (!skipCooldown) {
    const expiresAt = new Date(Date.now() + cooldownMs);
    await db
      .insert(cooldowns)
      .values({
        discordId: ticket.testeeId,
        gamemode: ticket.gamemode,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [cooldowns.discordId, cooldowns.gamemode],
        set: { expiresAt, createdAt: new Date() },
      });
  }

  try {
    const testeeUser = await client.users.fetch(ticket.testeeId).catch(() => null);
    const testerUser = await client.users.fetch(ticket.testerId).catch(() => null);

    if (testeeUser && testerUser) {
      const playerData = await db
        .select()
        .from(players)
        .where(eq(players.discordId, ticket.testeeId))
        .limit(1);

      const prevTierRow = await db
        .select()
        .from(tiers)
        .where(and(eq(tiers.discordId, ticket.testeeId), eq(tiers.gamemode, ticket.gamemode)))
        .limit(1);

      const ign = playerData[0]?.ign ?? testeeUser.username;
      const region = playerData[0]?.region ?? ticket.region;
      const previousTier = prevTierRow[0]?.tier ?? null;

      const resultEmbed = buildTestResultEmbed({
        testeeId: ticket.testeeId,
        testerId: ticket.testerId,
        testeeAvatarURL: testeeUser.displayAvatarURL({ size: 128 }),
        ign,
        region,
        gamemode: ticket.gamemode as Gamemode,
        tier,
        previousTier,
        cooldownDays: skipCooldown ? 0 : cooldownDays,
      });

      const resultsChannelId = await getChannelId(ticket.guildId, "results");
      if (resultsChannelId) {
        const resultsChannel = (await client.channels
          .fetch(resultsChannelId)
          .catch(() => null)) as TextChannel | null;
        if (resultsChannel) {
          await resultsChannel.send({
            content: `<@${ticket.testeeId}>`,
            embeds: [resultEmbed],
          });
        }
      }
    }

    const channel = (await client.channels
      .fetch(ticket.channelId)
      .catch(() => null)) as TextChannel | null;

    if (channel) {
      await sendTranscript(client, ticket, channel);
      setTimeout(async () => {
        await channel.delete("Ticket closed").catch(() => null);
      }, 3000);
    }
  } catch (err) {
    console.error("Error closing ticket:", err);
  }

  await db
    .update(tickets)
    .set({ status: "closed", tierGiven: tier, closedBy, closedAt: new Date() })
    .where(eq(tickets.id, ticket.id));
}

export async function sendResultToChannel(params: {
  client: Client;
  guildId: string;
  testeeId: string;
  testerId: string;
  gamemode: Gamemode;
  tier: Tier;
  cooldownDays: number;
  ign?: string;
  region?: string;
  previousTier?: string | null;
}): Promise<void> {
  const { client, guildId, testeeId, testerId, gamemode, tier, cooldownDays, ign, region, previousTier } = params;
  try {
    const resultsChannelId = await getChannelId(guildId, "results");
    if (!resultsChannelId) return;

    const resultsChannel = (await client.channels
      .fetch(resultsChannelId)
      .catch(() => null)) as TextChannel | null;
    if (!resultsChannel) return;

    const testeeUser = await client.users.fetch(testeeId).catch(() => null);
    if (!testeeUser) return;

    const resolvedIgn = ign ?? testeeUser.username;
    const resolvedRegion = region ?? "Unknown";

    const resultEmbed = buildTestResultEmbed({
      testeeId,
      testerId,
      testeeAvatarURL: testeeUser.displayAvatarURL({ size: 128 }),
      ign: resolvedIgn,
      region: resolvedRegion,
      gamemode,
      tier,
      previousTier,
      cooldownDays,
    });

    await resultsChannel.send({ content: `<@${testeeId}>`, embeds: [resultEmbed] });
  } catch (err) {
    console.error("Failed to send result to results channel:", err);
  }
}

export async function sendTranscript(
  client: Client,
  ticket: typeof tickets.$inferSelect,
  channel: TextChannel
): Promise<void> {
  try {
    const transcriptChannelId = await getChannelId(ticket.guildId, "transcript");
    if (!transcriptChannelId) return;

    const transcriptChannel = (await client.channels
      .fetch(transcriptChannelId)
      .catch(() => null)) as TextChannel | null;
    if (!transcriptChannel) return;

    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();

    const lines = sorted.map(
      (m) =>
        `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}${
          m.embeds.length > 0 ? " [embed]" : ""
        }`
    );

    const transcript = lines.join("\n");
    const buffer = Buffer.from(transcript, "utf-8");
    const fileName = `transcript-${ticket.id}-${ticket.gamemode}-${Date.now()}.txt`;

    await transcriptChannel.send({
      content: `📋 Transcript for ticket #${ticket.id} | ${
        GAMEMODES[ticket.gamemode as Gamemode] ?? ticket.gamemode
      } | Tester: <@${ticket.testerId}> | Testee: <@${ticket.testeeId}>`,
      files: [{ attachment: buffer, name: fileName }],
    });
  } catch (err) {
    console.error("Failed to send transcript:", err);
  }
}

export async function getTicketByChannel(
  channelId: string
): Promise<typeof tickets.$inferSelect | null> {
  const row = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.channelId, channelId), eq(tickets.status, "open")))
    .limit(1);
  return row[0] ?? null;
}

export async function incrementTesterStats(discordId: string): Promise<void> {
  const existing = await db
    .select()
    .from(testerStats)
    .where(eq(testerStats.discordId, discordId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(testerStats)
      .set({
        allTimeTests: existing[0].allTimeTests! + 1,
        monthlyTests: existing[0].monthlyTests! + 1,
        updatedAt: new Date(),
      })
      .where(eq(testerStats.discordId, discordId));
  } else {
    await db
      .insert(testerStats)
      .values({ discordId, allTimeTests: 1, monthlyTests: 1 });
  }
}
