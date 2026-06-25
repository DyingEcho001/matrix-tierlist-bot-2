import { Client, TextChannel } from "discord.js";
import { db } from "../database";
import {
  queues,
  queueMembers,
  queueTesters,
  tickets,
  players,
  channelConfig,
  queuePriorityRoles,
} from "../database/schema";
import { eq, and, asc } from "drizzle-orm";
import {
  buildQueueOpenEmbed,
  buildQueueClosedEmbed,
  buildQueueOpenRow,
} from "../utils/embeds";
import { Gamemode } from "../utils/constants";

export async function getOrCreateQueue(
  gamemode: string,
  region: string
): Promise<typeof queues.$inferSelect> {
  const existing = await db
    .select()
    .from(queues)
    .where(and(eq(queues.gamemode, gamemode), eq(queues.region, region)))
    .limit(1);

  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(queues)
    .values({ gamemode, region, isActive: false })
    .returning();
  return inserted[0];
}

export async function getQueueMembers(queueId: number) {
  return db
    .select()
    .from(queueMembers)
    .where(eq(queueMembers.queueId, queueId))
    .orderBy(asc(queueMembers.position));
}

export async function getQueueTesters(queueId: number) {
  return db
    .select()
    .from(queueTesters)
    .where(eq(queueTesters.queueId, queueId));
}

export async function addToQueue(
  queueId: number,
  discordId: string
): Promise<number> {
  const members = await getQueueMembers(queueId);
  const nextPos = members.length > 0 ? members[members.length - 1].position + 1 : 1;

  await db
    .insert(queueMembers)
    .values({ queueId, discordId, position: nextPos })
    .onConflictDoNothing();

  return nextPos;
}

export async function removeFromQueue(
  queueId: number,
  discordId: string
): Promise<void> {
  await db
    .delete(queueMembers)
    .where(
      and(
        eq(queueMembers.queueId, queueId),
        eq(queueMembers.discordId, discordId)
      )
    );

  const remaining = await getQueueMembers(queueId);
  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(queueMembers)
      .set({ position: i + 1 })
      .where(eq(queueMembers.id, remaining[i].id));
  }
}

export async function popFromQueue(
  queueId: number
): Promise<string | null> {
  const members = await getQueueMembers(queueId);
  if (members.length === 0) return null;
  const first = members[0];
  await removeFromQueue(queueId, first.discordId);
  return first.discordId;
}

export async function popFromQueueWithPriority(
  queueId: number,
  guildId: string,
  client: Client
): Promise<string | null> {
  const members = await getQueueMembers(queueId);
  if (members.length === 0) return null;

  const priorityRow = await db
    .select()
    .from(queuePriorityRoles)
    .where(eq(queuePriorityRoles.guildId, guildId))
    .limit(1);

  if (priorityRow.length > 0) {
    const roleId = priorityRow[0].roleId;
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      for (const member of members) {
        const guildMember = await guild.members.fetch(member.discordId).catch(() => null);
        if (guildMember && guildMember.roles.cache.has(roleId)) {
          await removeFromQueue(queueId, member.discordId);
          return member.discordId;
        }
      }
    }
  }

  const first = members[0];
  await removeFromQueue(queueId, first.discordId);
  return first.discordId;
}

export async function updateQueueEmbed(
  client: Client,
  queue: typeof queues.$inferSelect
): Promise<void> {
  if (!queue.channelId) return;

  try {
    const channel = (await client.channels
      .fetch(queue.channelId)
      .catch(() => null)) as TextChannel | null;
    if (!channel) return;

    const members = await getQueueMembers(queue.id);
    const testers = await getQueueTesters(queue.id);

    const rawActiveTests = await db
      .select({ testeeId: tickets.testeeId, testerId: tickets.testerId })
      .from(tickets)
      .where(
        and(
          eq(tickets.gamemode, queue.gamemode),
          eq(tickets.region, queue.region),
          eq(tickets.status, "open")
        )
      );

    const seen = new Set<string>();
    const activeTests = rawActiveTests.filter((t) => {
      if (seen.has(t.testeeId)) return false;
      seen.add(t.testeeId);
      return true;
    });

    if (!queue.isActive) {
      const closedEmbed = buildQueueClosedEmbed({
        gamemode: queue.gamemode as Gamemode,
        region: queue.region,
        lastSession: queue.lastSessionEnd,
      });

      if (queue.messageId) {
        const msg = await channel.messages
          .fetch(queue.messageId)
          .catch(() => null);
        if (msg) await msg.delete().catch(() => null);
      }

      const newMsg = await channel.send({ embeds: [closedEmbed] });
      await db
        .update(queues)
        .set({ messageId: newMsg.id })
        .where(eq(queues.id, queue.id));
      return;
    }

    const openEmbed = buildQueueOpenEmbed({
      gamemode: queue.gamemode as Gamemode,
      region: queue.region,
      members: members.map((m) => ({ discordId: m.discordId })),
      testers: testers.map((t) => ({ discordId: t.discordId })),
      activeTests,
    });
    const row = buildQueueOpenRow();

    if (queue.messageId) {
      const msg = await channel.messages
        .fetch(queue.messageId)
        .catch(() => null);
      if (msg) {
        if (msg.content.includes("@here")) {
          await msg.edit({ content: "@here", embeds: [openEmbed], components: [row] });
          return;
        }
        await msg.delete().catch(() => null);
      }
    }

    const newMsg = await channel.send({
      content: "@here",
      allowedMentions: { parse: ["everyone"] },
      embeds: [openEmbed],
      components: [row],
    });
    await db
      .update(queues)
      .set({ messageId: newMsg.id })
      .where(eq(queues.id, queue.id));
  } catch (err) {
    console.error("Failed to update queue embed:", err);
  }
}

export async function startQueueUpdateLoop(client: Client): Promise<void> {
  setInterval(async () => {
    try {
      const activeQueues = await db
        .select()
        .from(queues)
        .where(eq(queues.isActive, true));

      for (const queue of activeQueues) {
        await updateQueueEmbed(client, queue);
      }
    } catch (err) {
      console.error("Queue update loop error:", err);
    }
  }, 10_000);
}
