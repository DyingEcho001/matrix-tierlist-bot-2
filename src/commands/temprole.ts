import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { tempRoles, staffRoles, testerRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireStaff, getMemberStaffLevel, parseDuration } from "../utils/permissions";
import { buildTempRoleEmbed } from "../utils/embeds";
import { logCommand } from "../handlers/audit";

export const temproleCommand = {
  data: new SlashCommandBuilder()
    .setName("temprole")
    .setDescription("Add or remove a temporary role (Senior Moderator+)")
    .setDefaultMemberPermissions(null)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a temporary role to a user")
        .addUserOption((o) =>
          o.setName("user").setDescription("Target user").setRequired(true)
        )
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to add").setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("duration")
            .setDescription("Duration (e.g. 30d, 1h, 24h)")
            .setRequired(true)
        )
        .addBooleanOption((o) =>
          o
            .setName("ephemeral")
            .setDescription("Send the confirmation as ephemeral (only you can see it)?")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a temporary role from a user")
        .addUserOption((o) =>
          o.setName("user").setDescription("Target user").setRequired(true)
        )
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to remove").setRequired(true)
        )
        .addBooleanOption((o) =>
          o
            .setName("ephemeral")
            .setDescription("Send the confirmation as ephemeral (only you can see it)?")
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? false;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "senior_moderator"))) return;

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);

    const targetMember = await interaction.guild!.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!targetMember) {
      await interaction.editReply({
        content: "❌ Could not find that user in the server.",
      });
      return;
    }

    const guildId = interaction.guildId!;

    const allStaffRoles = await db
      .select({ roleId: staffRoles.roleId })
      .from(staffRoles)
      .where(eq(staffRoles.guildId, guildId));

    const allTesterRoles = await db
      .select({ roleId: testerRoles.roleId })
      .from(testerRoles)
      .where(eq(testerRoles.guildId, guildId));

    const protectedRoleIds = new Set([
      ...allStaffRoles.map((r) => r.roleId),
      ...allTesterRoles.map((r) => r.roleId),
    ]);

    if (protectedRoleIds.has(role.id)) {
      await interaction.editReply({
        content: "❌ You cannot use `/temprole` to give or remove staff roles or tester roles.",
      });
      return;
    }

    const myLevel = await getMemberStaffLevel(member, guildId);
    const theirLevel = await getMemberStaffLevel(targetMember, guildId);

    if (theirLevel >= myLevel && !member.permissions.has(8n)) {
      await interaction.editReply({
        content: "❌ You cannot manage roles for users at or above your staff level.",
      });
      return;
    }

    if (sub === "add") {
      const durationStr = interaction.options.getString("duration", true);
      const ms = parseDuration(durationStr);

      if (!ms) {
        await interaction.editReply({
          content: "❌ Invalid duration format. Use formats like `30d`, `1h`, `24h`.",
        });
        return;
      }

      const expiresAt = new Date(Date.now() + ms);

      await targetMember.roles.add(role.id, `Temp role by ${member.user.tag}`);

      await db
        .insert(tempRoles)
        .values({
          guildId: interaction.guildId!,
          discordId: targetUser.id,
          roleId: role.id,
          expiresAt,
          assignedBy: member.id,
        });

      const embed = buildTempRoleEmbed({
        action: "add",
        roleId: role.id,
        targetUserId: targetUser.id,
        moderatorId: member.id,
        expiresAt,
      });

      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { parse: [] },
      });
    } else {
      await targetMember.roles.remove(role.id, `Temp role removed by ${member.user.tag}`);

      await db
        .delete(tempRoles)
        .where(
          and(
            eq(tempRoles.discordId, targetUser.id),
            eq(tempRoles.roleId, role.id),
            eq(tempRoles.guildId, guildId)
          )
        );

      const embed = buildTempRoleEmbed({
        action: "remove",
        roleId: role.id,
        targetUserId: targetUser.id,
        moderatorId: member.id,
      });

      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { parse: [] },
      });
    }

    await logCommand(client, {
      command: `temprole ${sub}`,
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id, role: role.id },
    });
  },
};
