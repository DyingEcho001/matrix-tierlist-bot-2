import { Client } from "discord.js";
import { db } from "../database";
import { cooldowns } from "../database/schema";
import { eq, and, lte, gt } from "drizzle-orm";
import {
  buildCooldownWarnDmEmbed,
  buildCooldownExpiredDmEmbed,
} from "../utils/embeds";
import { GAMEMODES, Gamemode } from "../utils/constants";

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const WARN_BEFORE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function startDmNotifier(client: Client): void {
  setInterval(() => runDmNotifier(client), CHECK_INTERVAL_MS);
}

async function runDmNotifier(client: Client): Promise<void> {
  try {
    await sendCooldownWarnings(client);
    await sendCooldownExpiries(client);
  } catch (err) {
    console.error("[DM Notifier] Error:", err);
  }
}

async function sendCooldownWarnings(client: Client): Promise<void> {
  const now = new Date();
  const warnThreshold = new Date(now.getTime() + WARN_BEFORE_MS);

  const due = await db
    .select()
    .from(cooldowns)
    .where(
      and(
        eq(cooldowns.warnDmSent, false),
        lte(cooldowns.expiresAt, warnThreshold),
        gt(cooldowns.expiresAt, now)
      )
    );

  for (const row of due) {
    try {
      const user = await client.users.fetch(row.discordId).catch(() => null);
      if (!user) continue;

      const gamemodeName = GAMEMODES[row.gamemode as Gamemode] ?? row.gamemode;
      const embed = buildCooldownWarnDmEmbed(row.gamemode as Gamemode, row.expiresAt);

      await user.send({ embeds: [embed] }).catch(() => null);

      await db
        .update(cooldowns)
        .set({ warnDmSent: true })
        .where(eq(cooldowns.id, row.id));

      console.log(`[DM Notifier] Sent 2h warning to ${row.discordId} for ${gamemodeName}`);
    } catch (err) {
      console.error(`[DM Notifier] Failed to send warning to ${row.discordId}:`, err);
    }
  }
}

async function sendCooldownExpiries(client: Client): Promise<void> {
  const now = new Date();

  const expired = await db
    .select()
    .from(cooldowns)
    .where(
      and(
        eq(cooldowns.expiredDmSent, false),
        lte(cooldowns.expiresAt, now)
      )
    );

  for (const row of expired) {
    try {
      const user = await client.users.fetch(row.discordId).catch(() => null);
      if (!user) continue;

      const gamemodeName = GAMEMODES[row.gamemode as Gamemode] ?? row.gamemode;
      const embed = buildCooldownExpiredDmEmbed(row.gamemode as Gamemode);

      await user.send({ embeds: [embed] }).catch(() => null);

      await db
        .update(cooldowns)
        .set({ expiredDmSent: true })
        .where(eq(cooldowns.id, row.id));

      console.log(`[DM Notifier] Sent expiry DM to ${row.discordId} for ${gamemodeName}`);
    } catch (err) {
      console.error(`[DM Notifier] Failed to send expiry DM to ${row.discordId}:`, err);
    }
  }
}
