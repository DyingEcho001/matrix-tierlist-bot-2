import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../database";
import { testerStats } from "../database/schema";
import { eq } from "drizzle-orm";
import { logCommand } from "../handlers/audit";

export const removeTestsCommand = {
  data: new SlashCommandBuilder()
    .setName("remove-tests")
    .setDescription("Remove a certain amount of tests from a user (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to remove tests from").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("count")
        .setDescription("Number of tests to remove")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10000)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Only administrators can use this command.",
        ephemeral: true,
      });
      return;
    }

    const target = interaction.options.getUser("user", true);
    const count = interaction.options.getInteger("count", true);

    await interaction.deferReply({ ephemeral: true });

    const existing = await db
      .select()
      .from(testerStats)
      .where(eq(testerStats.discordId, target.id))
      .limit(1);

    if (!existing[0]) {
      await interaction.editReply({
        content: `❌ <@${target.id}> has no test stats on record.`,
      });
      return;
    }

    const currentTotal = existing[0].allTimeTests ?? 0;
    const currentMonthly = existing[0].monthlyTests ?? 0;

    const newTotal = Math.max(0, currentTotal - count);
    const newMonthly = Math.max(0, currentMonthly - count);

    await db
      .update(testerStats)
      .set({ allTimeTests: newTotal, monthlyTests: newMonthly, updatedAt: new Date() })
      .where(eq(testerStats.discordId, target.id));

    await interaction.editReply({
      content: `✅ Removed **${count}** test(s) from <@${target.id}>.\nAll-time: **${currentTotal}** → **${newTotal}** | Monthly: **${currentMonthly}** → **${newMonthly}**`,
    });

    await logCommand(client, {
      command: "remove-tests",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: target.id, count: String(count), newTotal: String(newTotal) },
    });
  },
};
