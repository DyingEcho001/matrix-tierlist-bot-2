import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { shameRoles } from "../database/schema";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const shameroleAssignCommand = {
  data: new SlashCommandBuilder()
    .setName("shamerole-assign")
    .setDescription("Set the Discord role for a restriction category (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("category")
        .setDescription("The restriction category")
        .setRequired(true)
        .addChoices(
          { name: "Test Cheater", value: "test_cheater" },
          { name: "Hacking Subhuman", value: "hacking_subhuman" }
        )
    )
    .addRoleOption((o) =>
      o
        .setName("role")
        .setDescription("The role to assign when a player is restricted in this category")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const category = interaction.options.getString("category", true);
    const role = interaction.options.getRole("role", true);

    await db
      .insert(shameRoles)
      .values({
        guildId: interaction.guildId!,
        category,
        roleId: role.id,
      })
      .onConflictDoUpdate({
        target: [shameRoles.guildId, shameRoles.category],
        set: { roleId: role.id, updatedAt: new Date() },
      });

    const categoryLabel =
      category === "test_cheater" ? "Test Cheater" : "Hacking Subhuman";

    await interaction.reply({
      content: `✅ **${categoryLabel}** shame role set to <@&${role.id}>. Players restricted under this category will automatically receive this role.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "shamerole-assign",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { category, role: role.id },
    });
  },
};
