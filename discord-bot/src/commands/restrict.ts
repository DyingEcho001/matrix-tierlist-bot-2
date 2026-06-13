import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import {
  restrictions,
  tiers,
  shameRoles,
} from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireStaff, hasStaffRole } from "../utils/permissions";
import { logCommand } from "../handlers/audit";
import { parseDuration } from "../utils/permissions";

export const restrictCommand = {
  data: new SlashCommandBuilder()
    .setName("restrict")
    .setDescription("Restrict a player (Regulator+; permanent requires Tierlist Administrator+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to restrict").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("category")
        .setDescription("Restriction type")
        .setRequired(true)
        .addChoices(
          { name: "Test Cheater", value: "test_cheater" },
          { name: "Hacking Subhuman", value: "hacking_subhuman" }
        )
    )
    .addBooleanOption((o) =>
      o
        .setName("permanent")
        .setDescription("Is this restriction permanent?")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("duration")
        .setDescription("Duration (e.g. 30d, 1h) — required if not permanent")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const targetUser = interaction.options.getUser("user", true);
    const category = interaction.options.getString("category", true);
    const isPermanent = interaction.options.getBoolean("permanent", true);
    const durationStr = interaction.options.getString("duration");

    if (isPermanent) {
      const canPermanent = await hasStaffRole(
        member,
        interaction.guildId!,
        "tierlist_administrator"
      );
      if (!canPermanent) {
        await interaction.reply({
          content: "❌ Only **Tierlist Administrator** or higher can issue permanent restrictions.",
          ephemeral: true,
        });
        return;
      }
    }

    if (!isPermanent && !durationStr) {
      await interaction.reply({
        content: "❌ You must provide a duration if the restriction is not permanent.",
        ephemeral: true,
      });
      return;
    }

    let expiresAt: Date | null = null;
    if (!isPermanent && durationStr) {
      const ms = parseDuration(durationStr);
      if (!ms) {
        await interaction.reply({
          content: "❌ Invalid duration format. Use formats like `30d`, `1h`, `360d`.",
          ephemeral: true,
        });
        return;
      }
      expiresAt = new Date(Date.now() + ms);
    }

    await interaction.deferReply();

    const playerTiers = await db
      .select()
      .from(tiers)
      .where(eq(tiers.discordId, targetUser.id));

    const previousTiers = playerTiers.map((t) => ({
      gamemode: t.gamemode,
      tier: t.tier,
    }));

    await db.delete(tiers).where(eq(tiers.discordId, targetUser.id));

    await db
      .update(restrictions)
      .set({ isActive: false })
      .where(
        and(
          eq(restrictions.discordId, targetUser.id),
          eq(restrictions.isActive, true)
        )
      );

    await db.insert(restrictions).values({
      discordId: targetUser.id,
      type: category,
      restrictedBy: member.id,
      isPermanent,
      expiresAt,
      isActive: true,
      previousTiers: previousTiers.length > 0 ? previousTiers : null,
    });

    const shameRoleName =
      category === "test_cheater" ? "Test Cheater" : "Hacking Subhuman";

    const targetMember = await interaction.guild!.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (targetMember) {
      const shameRoleRow = await db
        .select()
        .from(shameRoles)
        .where(
          and(
            eq(shameRoles.guildId, interaction.guildId!),
            eq(shameRoles.category, category)
          )
        )
        .limit(1);

      if (shameRoleRow[0]) {
        await targetMember.roles
          .add(shameRoleRow[0].roleId, "Restricted by staff")
          .catch(() => null);
      }
    }

    const expiresText = isPermanent
      ? "Never (permanent)"
      : `<t:${Math.floor(expiresAt!.getTime() / 1000)}:f>`;

    await interaction.editReply({
      content: [
        `✅ **${targetUser.username}** has been restricted.`,
        `**Type:** ${shameRoleName}`,
        `**Expires:** ${expiresText}`,
        `**Tiers wiped:** ${previousTiers.length} gamemode(s)`,
      ].join("\n"),
    });

    await logCommand(client, {
      command: "restrict",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: {
        user: targetUser.id,
        category,
        permanent: String(isPermanent),
        duration: durationStr ?? "N/A",
      },
    });
  },
};
