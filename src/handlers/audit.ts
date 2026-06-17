import { Client, GuildMember, User } from "discord.js";
import { db } from "../database";
import { channelConfig } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { buildAuditLogEmbed } from "../utils/embeds";

export async function logCommand(
  client: Client,
  params: {
    command: string;
    user: User | GuildMember;
    guildId: string;
    channelId: string;
    options?: Record<string, string>;
  }
): Promise<void> {
  try {
    const { command, user, guildId, channelId, options } = params;
    const config = await db
      .select()
      .from(channelConfig)
      .where(
        and(
          eq(channelConfig.guildId, guildId),
          eq(channelConfig.configKey, "audit_log")
        )
      )
      .limit(1);

    if (!config[0]) return;

    const logChannel = await client.channels.fetch(config[0].channelId).catch(() => null);
    if (!logChannel || !logChannel.isTextBased() || !("send" in logChannel)) return;

    const embed = buildAuditLogEmbed({
      command,
      user,
      channel: channelId,
      options,
    });

    await (logChannel as { send: Function }).send({ embeds: [embed] });
  } catch {
  }
}
