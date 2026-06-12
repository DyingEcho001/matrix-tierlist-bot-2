import { Client } from "discord.js";
import { db } from "../database";
import { tempRoles } from "../database/schema";
import { lte } from "drizzle-orm";

export function startTempRoleChecker(client: Client): void {
  setInterval(async () => {
    try {
      const expired = await db
        .select()
        .from(tempRoles)
        .where(lte(tempRoles.expiresAt, new Date()));

      for (const entry of expired) {
        try {
          const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
          if (!guild) continue;

          const member = await guild.members.fetch(entry.discordId).catch(() => null);
          if (member) {
            await member.roles.remove(entry.roleId, "Temp role expired").catch(() => null);
          }

          await db.delete(tempRoles).where(
            // biome-ignore lint: intentional
            require("drizzle-orm").eq(tempRoles.id, entry.id)
          );
        } catch (e) {
          console.error("Temp role removal error:", e);
        }
      }
    } catch (e) {
      console.error("Temp role checker error:", e);
    }
  }, 60_000);
}
