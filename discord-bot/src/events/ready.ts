import { Client, Events } from "discord.js";
import { startQueueUpdateLoop } from "../handlers/queue";
import { startTempRoleChecker } from "../handlers/temprole-checker";
import { db } from "../database";
import { restrictions } from "../database/schema";
import { and, eq, lte, isNotNull } from "drizzle-orm";

export function registerReadyEvent(client: Client): void {
  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);

    startQueueUpdateLoop(client);
    startTempRoleChecker(client);
    startRestrictionExpiryChecker(client);

    console.log("✅ Background tasks started.");
  });
}

function startRestrictionExpiryChecker(client: Client): void {
  setInterval(async () => {
    try {
      const expired = await db
        .select()
        .from(restrictions)
        .where(
          and(
            eq(restrictions.isActive, true),
            eq(restrictions.isPermanent, false),
            lte(restrictions.expiresAt, new Date()),
            isNotNull(restrictions.expiresAt)
          )
        );

      for (const restriction of expired) {
        await db
          .update(restrictions)
          .set({ isActive: false })
          .where(eq(restrictions.id, restriction.id));

        console.log(`[Restriction] Expired restriction for ${restriction.discordId}`);
      }
    } catch (err) {
      console.error("Restriction expiry checker error:", err);
    }
  }, 5 * 60 * 1000);
}
