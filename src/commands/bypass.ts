import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { commandBypasses } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { logCommand } from "../handlers/audit";

const BYPASS_OWNER_ID = "1327527060234702871";

export const bypassCommand = {
  data: new SlashCommandBuilder()
    .setName("bypass")
    .setDescription("Allow a user to use all bot commands without required roles")
    .setDefaultMemberPermissions(null)
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
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;

    if (member.id !== BYPASS_OWNER_ID) {
      await interaction.editReply({
        content: "❌ You don't have permission to use this command.",
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

      await interaction.editReply({
        content: `✅ <@${target.id}> can now use all bot commands without required roles.`,
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

      await interaction.editReply({
        content: `✅ Bypass removed from <@${target.id}>.`,
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
        await interaction.editReply({
          content: "No users currently have bypass access.",
        });
        return;
      }

      const list = rows.map((r) => `<@${r.discordId}>`).join("\n");
      await interaction.editReply({
        content: `**Bypass Users:**\n${list}`,
      });
    }
  },
};
