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

export const addTestsCommand = {
  data: new SlashCommandBuilder()
    .setName("add-tests")
    .setDescription("Manually add all-time tests to a user (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to add tests to").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("count")
        .setDescription("Number of tests to add")
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

    let newTotal: number;

    if (existing[0]) {
      newTotal = (existing[0].allTimeTests ?? 0) + count;
      await db
        .update(testerStats)
        .set({ allTimeTests: newTotal, updatedAt: new Date() })
        .where(eq(testerStats.discordId, target.id));
    } else {
      newTotal = count;
      await db
        .insert(testerStats)
        .values({ discordId: target.id, allTimeTests: count, monthlyTests: 0 });
    }

    await interaction.editReply({
      content: `✅ Added **${count}** test(s) to <@${target.id}>. They now have **${newTotal}** all-time tests.`,
    });

    await logCommand(client, {
      command: "add-tests",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: target.id, count: String(count), newTotal: String(newTotal) },
    });
  },
};
