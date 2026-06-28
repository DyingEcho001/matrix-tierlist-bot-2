import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  ChannelType,
} from "discord.js";
import { db } from "../database";
import { categoryConfig } from "../database/schema";
import { requireSuperAdmin } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const setCategoryCommand = {
  data: new SlashCommandBuilder()
    .setName("set-category")
    .setDescription("Set a category channel for testing tickets (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Category type")
        .setRequired(true)
        .addChoices(
          { name: "Testing Tickets", value: "testing_category" },
          { name: "HT3 Tests", value: "ht3_category" }
        )
    )
    .addChannelOption((o) =>
      o
        .setName("category")
        .setDescription("The category channel")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireSuperAdmin(interaction))) return;

    const type = interaction.options.getString("type", true);
    const category = interaction.options.getChannel("category", true);

    await db
      .insert(categoryConfig)
      .values({
        guildId: interaction.guildId!,
        configKey: type,
        categoryId: category.id,
      })
      .onConflictDoUpdate({
        target: [categoryConfig.guildId, categoryConfig.configKey],
        set: { categoryId: category.id, updatedAt: new Date() },
      });

    const labels: Record<string, string> = {
      testing_category: "Testing Tickets",
      ht3_category: "HT3 Tests",
    };

    await interaction.reply({
      content: `✅ **${labels[type] ?? type}** category set to **${category.name}**.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "set-category",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { type, category: category.id },
    });
  },
};
