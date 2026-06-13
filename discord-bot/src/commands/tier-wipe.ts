import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { tiers, players } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";
import { EMBED_COLORS } from "../utils/constants";
import { EmbedBuilder } from "discord.js";

export const tierWipeCommand = {
  data: new SlashCommandBuilder()
    .setName("tier-wipe")
    .setDescription("Wipe all tier data for a user (Manager+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("The user to wipe tiers for")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!(await requireStaff(interaction, "manager"))) return;

    const target = interaction.options.getUser("user", true);
    const member = interaction.member as GuildMember;

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const playerRow = await db
      .select()
      .from(players)
      .where(eq(players.discordId, target.id))
      .limit(1);

    if (playerRow.length === 0) {
      await interaction.editReply({
        content: `❌ <@${target.id}> has no registration in the database.`,
      });
      return;
    }

    const existingTiers = await db
      .select()
      .from(tiers)
      .where(eq(tiers.discordId, target.id));

    if (existingTiers.length === 0) {
      await interaction.editReply({
        content: `❌ <@${target.id}> has no tiers to wipe.`,
      });
      return;
    }

    await db.delete(tiers).where(eq(tiers.discordId, target.id));

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Tier Wipe — ${target.username}`,
        iconURL: target.displayAvatarURL({ size: 128 }),
      })
      .setColor(EMBED_COLORS.error)
      .setDescription(`All tiers for <@${target.id}> have been wiped.`)
      .addFields(
        { name: "User:", value: `<@${target.id}>`, inline: true },
        { name: "Wiped by:", value: `<@${member.id}>`, inline: true },
        { name: "Tiers removed:", value: `${existingTiers.length}`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logCommand(client, {
      command: "tier-wipe",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { target: target.id, tiersRemoved: String(existingTiers.length) },
    });
  },
};
