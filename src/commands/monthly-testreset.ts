import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../database";
import { testerStats } from "../database/schema";
import { logCommand } from "../handlers/audit";

export const monthlyTestResetCommand = {
  data: new SlashCommandBuilder()
    .setName("monthly-testreset")
    .setDescription("Reset monthly test counts for all users (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Only administrators can use this command.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await db
      .update(testerStats)
      .set({ monthlyTests: 0, monthlyResetAt: new Date(), updatedAt: new Date() });

    await interaction.editReply({
      content: `✅ Monthly test counts have been reset to **0** for all users.`,
    });

    await logCommand(client, {
      command: "monthly-testreset",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: {},
    });
  },
};
