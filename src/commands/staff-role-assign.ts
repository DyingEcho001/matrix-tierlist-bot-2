import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { staffRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { STAFF_ROLES, STAFF_ROLE_LABELS, StaffRole } from "../utils/constants";
import { requireSuperAdmin } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const staffRoleCommand = {
  data: new SlashCommandBuilder()
    .setName("staff-role")
    .setDescription("Assign a Discord role to a staff position (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("staff-role")
        .setDescription("The staff position to configure")
        .setRequired(true)
        .addChoices(
          ...STAFF_ROLES.map((r) => ({
            name: STAFF_ROLE_LABELS[r],
            value: r,
          }))
        )
    )
    .addRoleOption((o) =>
      o
        .setName("role")
        .setDescription("The Discord role to assign to this staff position")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireSuperAdmin(interaction))) return;

    const staffRole = interaction.options.getString("staff-role", true) as StaffRole;
    const role = interaction.options.getRole("role", true);

    await db
      .insert(staffRoles)
      .values({
        guildId: interaction.guildId!,
        staffRole,
        roleId: role.id,
      })
      .onConflictDoUpdate({
        target: [staffRoles.guildId, staffRoles.staffRole],
        set: { roleId: role.id, updatedAt: new Date() },
      });

    await interaction.reply({
      content: `✅ **${STAFF_ROLE_LABELS[staffRole]}** is now mapped to <@&${role.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "staff-role",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { staffRole, role: role.id },
    });
  },
};
