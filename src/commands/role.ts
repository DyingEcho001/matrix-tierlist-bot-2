import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { requireStaff, getMemberStaffLevel } from "../utils/permissions";
import { buildRoleActionEmbed } from "../utils/embeds";
import { logCommand } from "../handlers/audit";

export const roleCommand = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a permanent role (Regulator+)")
    .setDefaultMemberPermissions(null)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Permanently add a role to a user")
        .addUserOption((o) =>
          o.setName("user").setDescription("Target user").setRequired(true)
        )
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to add").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Permanently remove a role from a user")
        .addUserOption((o) =>
          o.setName("user").setDescription("Target user").setRequired(true)
        )
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to remove").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);

    const targetMember = await interaction.guild!.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!targetMember) {
      await interaction.reply({
        content: "❌ Could not find that user in the server.",
        ephemeral: true,
      });
      return;
    }

    const myLevel = await getMemberStaffLevel(member, interaction.guildId!);
    const theirLevel = await getMemberStaffLevel(targetMember, interaction.guildId!);

    if (theirLevel >= myLevel && !member.permissions.has(8n)) {
      await interaction.reply({
        content: "❌ You cannot manage roles for users at or above your staff level.",
        ephemeral: true,
      });
      return;
    }

    const embed = buildRoleActionEmbed({
      action: sub as "add" | "remove",
      roleId: role.id,
      targetUserId: targetUser.id,
      moderatorId: member.id,
    });

    if (sub === "add") {
      await targetMember.roles.add(role.id, `Role added by ${member.user.tag}`);
    } else {
      await targetMember.roles.remove(role.id, `Role removed by ${member.user.tag}`);
    }

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });

    await logCommand(client, {
      command: `role ${sub}`,
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id, role: role.id },
    });
  },
};
