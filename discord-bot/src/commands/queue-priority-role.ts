import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../database";
import { queuePriorityRoles } from "../database/schema";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const queuePriorityRoleCommand = {
  data: new SlashCommandBuilder()
    .setName("queue-priority-role")
    .setDescription("Set the role that gets pulled from the queue first regardless of position")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) =>
      o
        .setName("role")
        .setDescription("The role that receives priority in the queue (e.g. Server Booster)")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!(await requireStaff(interaction, "manager"))) return;

    const role = interaction.options.getRole("role", true);
    const guildId = interaction.guildId!;

    await db
      .insert(queuePriorityRoles)
      .values({ guildId, roleId: role.id })
      .onConflictDoUpdate({
        target: queuePriorityRoles.guildId,
        set: { roleId: role.id, updatedAt: new Date() },
      });

    await interaction.reply({
      content: `✅ Queue priority role set to <@&${role.id}>. Members with this role will always be pulled first, regardless of their queue position.`,
      flags: ["Ephemeral"],
    });

    await logCommand(client, {
      command: "queue-priority-role",
      user: interaction.member as GuildMember,
      guildId,
      channelId: interaction.channelId,
      options: { role: role.id },
    });
  },
};
