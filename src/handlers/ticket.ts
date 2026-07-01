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
  tierRoles,
  gamemodeRoles,
} from "../database/schema";
import { eq, and } from "drizzle-orm";
import { buildTicketInfoEmbed, buildTestResultEmbed } from "../utils/embeds";
import { GAMEMODES, TIER_LABELS, Gamemode, Tier, COOLDOWNS, HT3_PLUS_TIERS } from "../utils/constants";
import { EmbedBuilder } from "discord.js";

export async function applyTierRole(params: {
  client: Client;
  guildId: string;
  discordId: string;
  gamemode: string;
  tier: Tier;
}): Promise<void> {
  const { client, guildId, discordId, gamemode, tier } = params;
  try {
    const newRoleRow = await db
      .select()
      .from(tierRoles)
      .where(
        and(
          eq(tierRoles.guildId, guildId),
          eq(tierRoles.gamemode, gamemode),
          eq(tierRoles.tier, tier)
        )
      )
      .limit(1);

    if (!newRoleRow[0]) return;

    const newRoleId = newRoleRow[0].roleId;

    const allGamemodeRoles = await db
      .select()
      .from(tierRoles)
      .where(and(eq(tierRoles.guildId, guildId), eq(tierRoles.gamemode, gamemode)));

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return;

    for (const row of allGamemodeRoles) {
      if (row.roleId !== newRoleId && member.roles.cache.has(row.roleId)) {
        await member.roles.remove(row.roleId).catch(() => null);
      }
    }

    if (!member.roles.cache.has(newRoleId)) {
      await member.roles.add(newRoleId).catch(() => null);
    }
  } catch (err) {
    console.error("Failed to apply tier role:", err);
  }
}

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
      tester,
      gamemode,
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
  isHt3Eval?: boolean;
  ht3Passed?: boolean;
}): Promise<void> {
  const { client, ticket, tier, closedBy, skipCooldown = false, isHt3Eval = false, ht3Passed = false } = params;

  const isHT3Plus = HT3_PLUS_TIERS.includes(tier);
  const cooldownMs = isHT3Plus ? COOLDOWNS.ht3 : COOLDOWNS.normal;
  const cooldownDays = isHT3Plus ? 15 : 5;

  // Read previous tier BEFORE the upsert overwrites it
  const previousTierBeforeClose = await db
    .select()
    .from(tiers)
    .where(and(eq(tiers.discordId, ticket.testeeId), eq(tiers.gamemode, ticket.gamemode)))
    .limit(1);
  const previousTierValue = previousTierBeforeClose[0]?.tier ?? null;

  await db
    .insert(tiers)
    .values({ discordId: ticket.testeeId, gamemode: ticket.gamemode, tier, givenBy: closedBy })
    .onConflictDoUpdate({
      target: [tiers.discordId, tiers.gamemode],
      set: { tier, givenBy: closedBy, updatedAt: new Date() },
    });

  await applyTierRole({
    client,
    guildId: ticket.guildId,
    discordId: ticket.testeeId,
    gamemode: ticket.gamemode,
    tier,
  });

  // Remove the testee's waitlist role for this gamemode so they lose access to the waitlist channel
  try {
    const playerRow = await db
      .select()
      .from(players)
      .where(eq(players.discordId, ticket.testeeId))
      .limit(1);

    if (playerRow[0]) {
      const waitlistRoleRow = await db
        .select()
        .from(gamemodeRoles)
        .where(
          and(
            eq(gamemodeRoles.guildId, ticket.guildId),
            eq(gamemodeRoles.gamemode, ticket.gamemode),
            eq(gamemodeRoles.region, playerRow[0].region)
          )
        )
        .limit(1);

      if (waitlistRoleRow[0]) {
        const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
        if (guild) {
          const testeeMember = await guild.members.fetch(ticket.testeeId).catch(() => null);
          if (testeeMember?.roles.cache.has(waitlistRoleRow[0].roleId)) {
            await testeeMember.roles.remove(waitlistRoleRow[0].roleId, "Tier test completed — waitlist role removed").catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to remove waitlist role after test:", err);
  }

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

      const ign = playerData[0]?.ign ?? testeeUser.username;
      const region = playerData[0]?.region ?? ticket.region;
      const previousTier = previousTierValue;

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
        isHt3Eval,
        ht3Passed,
      });

      const resultsChannelId = await getChannelId(ticket.guildId, "results");
      if (resultsChannelId) {
        const resultsChannel = (await client.channels
          .fetch(resultsChannelId)
          .catch(() => null)) as TextChannel | null;
        if (resultsChannel) {
          const resultMsg = await resultsChannel.send({
            content: `<@${ticket.testeeId}>`,
            embeds: [resultEmbed],
          });
          for (const emoji of ["🏆", "🎉", "🔥", "👍🏻", "💀"]) {
            await resultMsg.react(emoji).catch(() => null);
          }
        }
      }
    }

    const channel = (await client.channels
      .fetch(ticket.channelId)
      .catch(() => null)) as TextChannel | null;

    if (channel) {
      await sendTranscript(client, ticket, channel, tier, isHt3Eval, ht3Passed);
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

    const resultMsg = await resultsChannel.send({ content: `<@${testeeId}>`, embeds: [resultEmbed] });
    for (const emoji of ["🏆", "🎉", "🔥", "👍🏻", "💀"]) {
      await resultMsg.react(emoji).catch(() => null);
    }
  } catch (err) {
    console.error("Failed to send result to results channel:", err);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlTranscript(
  ticket: typeof tickets.$inferSelect,
  messages: Array<{ author: string; avatarURL: string; content: string; timestamp: Date; isBot: boolean; embeds: string[] }>
): string {
  const gamemodeName = GAMEMODES[ticket.gamemode as Gamemode] ?? ticket.gamemode;
  const messageRows = messages
    .map((m) => {
      const time = m.timestamp.toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      });
      const embedsHtml = m.embeds.length > 0
        ? `<div class="embeds">${m.embeds.map(e => `<div class="embed-block">${escapeHtml(e)}</div>`).join("")}</div>`
        : "";
      return `
      <div class="message ${m.isBot ? "bot" : ""}">
        <img class="avatar" src="${m.avatarURL}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" />
        <div class="content">
          <div class="meta">
            <span class="author ${m.isBot ? "bot-tag" : ""}">${escapeHtml(m.author)}</span>
            <span class="timestamp">${time}</span>
          </div>
          <div class="text">${escapeHtml(m.content)}</div>
          ${embedsHtml}
        </div>
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Transcript — Ticket #${ticket.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #313338; color: #dbdee1; font-family: 'gg sans', 'Noto Sans', Arial, sans-serif; font-size: 14px; }
    .header { background: #2b2d31; padding: 16px 24px; border-bottom: 1px solid #1e1f22; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 18px; color: #fff; }
    .header .meta { font-size: 12px; color: #949ba4; margin-top: 4px; }
    .badge { background: #5865f2; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    .messages { padding: 16px 24px; }
    .message { display: flex; gap: 12px; padding: 4px 0 8px; }
    .message:hover { background: rgba(0,0,0,0.06); border-radius: 4px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
    .content { flex: 1; }
    .meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
    .author { font-weight: 600; color: #fff; }
    .author.bot-tag { color: #5865f2; }
    .timestamp { font-size: 11px; color: #949ba4; }
    .text { color: #dbdee1; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .embeds { margin-top: 6px; }
    .embed-block { background: #2b2d31; border-left: 4px solid #5865f2; border-radius: 4px; padding: 8px 12px; margin-top: 4px; font-size: 12px; color: #949ba4; font-style: italic; }
    .message.bot .author { color: #5865f2; }
    .divider { border: none; border-top: 1px solid #3f4147; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Ticket #${ticket.id} — ${escapeHtml(gamemodeName)}</h1>
      <div class="meta">
        Tester: <@${ticket.testerId}> &nbsp;|&nbsp; Testee: <@${ticket.testeeId}> &nbsp;|&nbsp; Region: ${escapeHtml(ticket.region)} &nbsp;|&nbsp; Status: ${escapeHtml(ticket.status ?? "closed")}
        &nbsp;<span class="badge">Matrix Tierlist</span>
      </div>
    </div>
  </div>
  <div class="messages">
    ${messageRows}
  </div>
</body>
</html>`;
}

export async function sendTranscript(
  client: Client,
  ticket: typeof tickets.$inferSelect,
  channel: TextChannel,
  tierGiven?: Tier,
  isHt3Eval?: boolean,
  ht3Passed?: boolean
): Promise<void> {
  try {
    const transcriptChannelId = await getChannelId(ticket.guildId, "transcript");
    if (!transcriptChannelId) return;

    const transcriptChannel = (await client.channels
      .fetch(transcriptChannelId)
      .catch(() => null)) as TextChannel | null;
    if (!transcriptChannel) return;

    const fetched = await channel.messages.fetch({ limit: 100 });
    const sorted = [...fetched.values()].reverse();

    const messageData = sorted.map((m) => ({
      author: m.member?.displayName ?? m.author.username,
      avatarURL: m.author.displayAvatarURL({ size: 64 }),
      content: m.content || (m.embeds.length > 0 ? "" : "(no content)"),
      timestamp: m.createdAt,
      isBot: m.author.bot,
      embeds: m.embeds.map((e) =>
        [e.title, e.description, ...(e.fields?.map((f) => `${f.name}: ${f.value}`) ?? [])]
          .filter(Boolean)
          .join(" | ")
      ),
    }));

    const html = buildHtmlTranscript(ticket, messageData);
    const buffer = Buffer.from(html, "utf-8");
    const fileName = `transcript-${ticket.id}-${ticket.gamemode}-${Date.now()}.html`;

    const gamemodeName = GAMEMODES[ticket.gamemode as Gamemode] ?? ticket.gamemode;
    const tierLabel = tierGiven ? (TIER_LABELS[tierGiven] ?? tierGiven) : "Unknown";

    const transcriptEmbed = new EmbedBuilder()
      .setTitle(`📋 Ticket #${ticket.id} Transcript`)
      .setColor(0x9B59B6)
      .addFields(
        { name: "Tester", value: `<@${ticket.testerId}>`, inline: false },
        { name: "Testee", value: `<@${ticket.testeeId}>`, inline: false },
        { name: "Tier Given", value: tierLabel, inline: false },
        { name: "Gamemode", value: gamemodeName, inline: false },
        { name: "HT3 Evaluation", value: isHt3Eval ? "Yes" : "No", inline: false },
        ...(isHt3Eval
          ? [{ name: "HT3 Evaluation Result", value: ht3Passed ? "✅ Passed" : "❌ Failed", inline: false }]
          : []),
      )
      .setTimestamp();

    await transcriptChannel.send({
      embeds: [transcriptEmbed],
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
