import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { players } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const unregisterCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Remove a player's registered profile (Manager+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("Discord user to unregister")
        .setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("ign")
        .setDescription("Unregister by IGN instead")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const targetUser = interaction.options.getUser("user");
    const ignQuery = interaction.options.getString("ign");

    if (!targetUser && !ignQuery) {
      await interaction.editReply({
        content: "❌ Please provide a user or IGN to unregister.",
      });
      return;
    }

    let discordId: string | null = null;
    let displayName: string | null = null;

    if (targetUser) {
      const row = await db
        .select()
        .from(players)
        .where(eq(players.discordId, targetUser.id))
        .limit(1);

      if (!row[0]) {
        await interaction.editReply({
          content: `❌ No registered profile found for <@${targetUser.id}>.`,
        });
        return;
      }
      discordId = targetUser.id;
      displayName = `<@${targetUser.id}> (${row[0].ign})`;
    } else if (ignQuery) {
      const row = await db
        .select()
        .from(players)
        .where(eq(players.ign, ignQuery))
        .limit(1);

      if (!row[0]) {
        await interaction.editReply({
          content: `❌ No registered profile found for IGN **${ignQuery}**.`,
        });
        return;
      }
      discordId = row[0].discordId;
      displayName = `<@${row[0].discordId}> (${ignQuery})`;
    }

    if (!discordId) {
      await interaction.editReply({ content: "❌ Could not resolve player." });
      return;
    }

    await db.delete(players).where(eq(players.discordId, discordId));

    await interaction.editReply({
      content: `✅ Profile for ${displayName} has been removed. Their tiers and cooldowns remain in the database.`,
    });

    await logCommand(client, {
      command: "unregister",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: {
        user: targetUser?.id ?? "N/A",
        ign: ignQuery ?? "N/A",
      },
    });
  },
};
