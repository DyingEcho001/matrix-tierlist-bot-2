import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import {
  players,
  tiers,
  cooldowns,
  testerStats,
  restrictions,
} from "../database/schema";
import { eq, and, gt } from "drizzle-orm";
import { buildPlayerDataEmbed } from "../utils/embeds";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const playerDataCommand = {
  data: new SlashCommandBuilder()
    .setName("player-data")
    .setDescription("View a player's full profile and tier data (Helper+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("Discord user to look up")
        .setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("ign")
        .setDescription("Look up by IGN instead")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "helper"))) return;

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user");
    const ignQuery = interaction.options.getString("ign");

    let playerRow: typeof players.$inferSelect | undefined;

    if (targetUser) {
      const rows = await db
        .select()
        .from(players)
        .where(eq(players.discordId, targetUser.id))
        .limit(1);
      playerRow = rows[0];
    } else if (ignQuery) {
      const rows = await db
        .select()
        .from(players)
        .where(eq(players.ign, ignQuery))
        .limit(1);
      playerRow = rows[0];
    } else {
      await interaction.editReply({
        content: "❌ Please provide a user or IGN to look up.",
      });
      return;
    }

    if (!playerRow) {
      await interaction.editReply({
        content: "❌ No registered profile found for this player.",
      });
      return;
    }

    const playerTiers = await db
      .select()
      .from(tiers)
      .where(eq(tiers.discordId, playerRow.discordId));

    const now = new Date();
    const activeCooldowns = await db
      .select()
      .from(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, playerRow.discordId),
          gt(cooldowns.expiresAt, now)
        )
      );

    const stats = await db
      .select()
      .from(testerStats)
      .where(eq(testerStats.discordId, playerRow.discordId))
      .limit(1);

    const activeRestriction = await db
      .select()
      .from(restrictions)
      .where(
        and(
          eq(restrictions.discordId, playerRow.discordId),
          eq(restrictions.isActive, true)
        )
      )
      .limit(1);

    const embed = buildPlayerDataEmbed({
      player: playerRow,
      tiers: playerTiers,
      cooldowns: activeCooldowns,
      testerStats: stats[0] ?? null,
      restriction: activeRestriction[0]
        ? {
            type: activeRestriction[0].type,
            createdAt: activeRestriction[0].createdAt!,
            expiresAt: activeRestriction[0].expiresAt,
            isPermanent: activeRestriction[0].isPermanent ?? false,
          }
        : null,
      queriedBy: member.id,
    });

    await interaction.editReply({ embeds: [embed] });

    await logCommand(client, {
      command: "player-data",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: {
        user: targetUser?.id ?? "N/A",
        ign: ignQuery ?? "N/A",
      },
    });
  },
};
