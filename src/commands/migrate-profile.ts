import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { players, tiers, cooldowns, restrictions } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const migrateProfileCommand = {
  data: new SlashCommandBuilder()
    .setName("migrate-profile")
    .setDescription("Migrate a player's data to another account (Manager only)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o
        .setName("from")
        .setDescription("Source user to migrate from")
        .setRequired(true)
    )
    .addUserOption((o) =>
      o
        .setName("to")
        .setDescription("Target user to migrate to")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const fromUser = interaction.options.getUser("from", true);
    const toUser = interaction.options.getUser("to", true);

    if (fromUser.id === toUser.id) {
      await interaction.reply({
        content: "❌ Source and target users cannot be the same.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const fromPlayer = await db
      .select()
      .from(players)
      .where(eq(players.discordId, fromUser.id))
      .limit(1);

    if (!fromPlayer[0]) {
      await interaction.editReply({
        content: "❌ Source user has no registered profile.",
      });
      return;
    }

    const toMember = await interaction.guild!.members
      .fetch(toUser.id)
      .catch(() => null);

    const toUsername = toMember?.user.username ?? toUser.username;

    await db
      .delete(players)
      .where(eq(players.discordId, toUser.id))
      .catch(() => null);
    await db
      .delete(tiers)
      .where(eq(tiers.discordId, toUser.id))
      .catch(() => null);
    await db
      .delete(cooldowns)
      .where(eq(cooldowns.discordId, toUser.id))
      .catch(() => null);
    await db
      .delete(restrictions)
      .where(eq(restrictions.discordId, toUser.id))
      .catch(() => null);

    await db
      .update(players)
      .set({
        discordId: toUser.id,
        discordUsername: toUsername,
        updatedAt: new Date(),
      })
      .where(eq(players.discordId, fromUser.id));

    await db
      .update(tiers)
      .set({ discordId: toUser.id })
      .where(eq(tiers.discordId, fromUser.id));

    await db
      .update(cooldowns)
      .set({ discordId: toUser.id })
      .where(eq(cooldowns.discordId, fromUser.id));

    await db
      .update(restrictions)
      .set({ discordId: toUser.id })
      .where(eq(restrictions.discordId, fromUser.id));

    await interaction.editReply({
      content: [
        `✅ Profile migrated from <@${fromUser.id}> → <@${toUser.id}>`,
        `**Migrated:** Profile, tiers, cooldowns, and restrictions`,
      ].join("\n"),
    });

    await logCommand(client, {
      command: "migrate-profile",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { from: fromUser.id, to: toUser.id },
    });
  },
};
