import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import { db } from "../database";
import { tiers, tierRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { GAMEMODES, GAMEMODE_KEYS, Gamemode, TIERS, TIER_LABELS, Tier } from "../utils/constants";
import { logCommand } from "../handlers/audit";

export const tierRemoveCommand = {
  data: new SlashCommandBuilder()
    .setName("tier-remove")
    .setDescription("Remove a specific tier from a player (Manager only)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("The player to remove the tier from").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode tier to remove")
        .setRequired(true)
        .addChoices(...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm })))
    )
    .addStringOption((o) =>
      o
        .setName("tier")
        .setDescription("The specific tier to remove")
        .setRequired(true)
        .addChoices(...TIERS.map((t) => ({ name: t, value: t })))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const targetUser = interaction.options.getUser("user", true);
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const tier = interaction.options.getString("tier", true) as Tier;

    await interaction.deferReply({ ephemeral: true });

    const existingTier = await db
      .select()
      .from(tiers)
      .where(
        and(
          eq(tiers.discordId, targetUser.id),
          eq(tiers.gamemode, gamemode),
          eq(tiers.tier, tier)
        )
      )
      .limit(1);

    if (existingTier.length === 0) {
      await interaction.editReply({
        content: `❌ <@${targetUser.id}> does not have **${TIER_LABELS[tier] ?? tier}** in **${GAMEMODES[gamemode]}**.`,
      });
      return;
    }

    await db
      .delete(tiers)
      .where(
        and(
          eq(tiers.discordId, targetUser.id),
          eq(tiers.gamemode, gamemode),
          eq(tiers.tier, tier)
        )
      );

    const tierRoleRow = await db
      .select()
      .from(tierRoles)
      .where(
        and(
          eq(tierRoles.guildId, interaction.guildId!),
          eq(tierRoles.gamemode, gamemode),
          eq(tierRoles.tier, tier)
        )
      )
      .limit(1);

    let roleRemoved = false;
    if (tierRoleRow.length > 0) {
      const targetMember = await interaction.guild!.members
        .fetch(targetUser.id)
        .catch(() => null);
      if (targetMember) {
        await targetMember.roles.remove(tierRoleRow[0].roleId, "Tier removed by manager").catch(() => null);
        roleRemoved = true;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🗑️ Tier Removed")
      .setColor(0x6C3483)
      .addFields(
        { name: "Player", value: `<@${targetUser.id}>`, inline: true },
        { name: "Gamemode", value: GAMEMODES[gamemode], inline: true },
        { name: "Tier Removed", value: TIER_LABELS[tier] ?? tier, inline: true },
        { name: "Role Removed", value: roleRemoved ? "✅ Yes" : "➖ No role configured", inline: true },
        { name: "Removed By", value: `<@${member.id}>`, inline: true },
      )
      .setFooter({ text: "Matrix Tierlist" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logCommand(client, {
      command: "tier-remove",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id, gamemode, tier },
    });
  },
};
