import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { voluntaryTesterRole } from "../database/schema";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const voluntaryTesterRoleCommand = {
  data: new SlashCommandBuilder()
    .setName("voluntary-tester-role")
    .setDescription("Set the @Voluntary Tester role (Manager only)")
    .setDefaultMemberPermissions(null)
    .addRoleOption((o) =>
      o
        .setName("role")
        .setDescription("The Voluntary Tester role")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const role = interaction.options.getRole("role", true);

    await db
      .insert(voluntaryTesterRole)
      .values({ guildId: interaction.guildId!, roleId: role.id })
      .onConflictDoUpdate({
        target: [voluntaryTesterRole.guildId],
        set: { roleId: role.id, updatedAt: new Date() },
      });

    await interaction.reply({
      content: `✅ **@Voluntary Tester** role set to <@&${role.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "voluntary-tester-role",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { role: role.id },
    });
  },
};
