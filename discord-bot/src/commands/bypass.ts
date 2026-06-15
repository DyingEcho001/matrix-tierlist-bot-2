import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../database";
import { commandBypasses } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { logCommand } from "../handlers/audit";

export const bypassCommand = {
  data: new SlashCommandBuilder()
    .setName("bypass")
    .setDescription("Allow a user to use all bot commands without required roles (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Grant a user bypass access")
        .addUserOption((o) =>
          o.setName("user").setDescription("User to bypass").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove bypass access from a user")
        .addUserOption((o) =>
          o.setName("user").setDescription("User to remove bypass from").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all users with bypass access")
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

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "add") {
      const target = interaction.options.getUser("user", true);

      await db
        .insert(commandBypasses)
        .values({ guildId, discordId: target.id, addedBy: member.id })
        .onConflictDoNothing();

      await interaction.reply({
        content: `✅ <@${target.id}> can now use all bot commands without required roles.`,
        ephemeral: true,
      });

      await logCommand(client, {
        command: "bypass add",
        user: member,
        guildId,
        channelId: interaction.channelId,
        options: { user: target.id },
      });
    } else if (sub === "remove") {
      const target = interaction.options.getUser("user", true);

      await db
        .delete(commandBypasses)
        .where(
          and(
            eq(commandBypasses.guildId, guildId),
            eq(commandBypasses.discordId, target.id)
          )
        );

      await interaction.reply({
        content: `✅ Bypass removed from <@${target.id}>.`,
        ephemeral: true,
      });

      await logCommand(client, {
        command: "bypass remove",
        user: member,
        guildId,
        channelId: interaction.channelId,
        options: { user: target.id },
      });
    } else if (sub === "list") {
      const rows = await db
        .select()
        .from(commandBypasses)
        .where(eq(commandBypasses.guildId, guildId));

      if (rows.length === 0) {
        await interaction.reply({
          content: "No users currently have bypass access.",
          ephemeral: true,
        });
        return;
      }

      const list = rows.map((r) => `<@${r.discordId}>`).join("\n");
      await interaction.reply({
        content: `**Bypass Users:**\n${list}`,
        ephemeral: true,
      });
    }
  },
};
