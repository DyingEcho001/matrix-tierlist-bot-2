import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { restrictions, tiers, shameRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";
import { buildUnrestrictDmEmbed } from "../utils/embeds";

export const unrestrictCommand = {
  data: new SlashCommandBuilder()
    .setName("unrestrict")
    .setDescription("Remove a restriction from a player and restore their tiers (Regulator+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to unrestrict").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const targetUser = interaction.options.getUser("user", true);

    await interaction.deferReply();

    const activeRestriction = await db
      .select()
      .from(restrictions)
      .where(
        and(
          eq(restrictions.discordId, targetUser.id),
          eq(restrictions.isActive, true)
        )
      )
      .limit(1);

    if (!activeRestriction[0]) {
      await interaction.editReply({
        content: "❌ This user has no active restriction.",
      });
      return;
    }

    const restriction = activeRestriction[0];

    await db
      .update(restrictions)
      .set({ isActive: false })
      .where(eq(restrictions.id, restriction.id));

    const prevTiers = restriction.previousTiers as
      | Array<{ gamemode: string; tier: string }>
      | null;

    if (prevTiers && prevTiers.length > 0) {
      for (const t of prevTiers) {
        await db
          .insert(tiers)
          .values({
            discordId: targetUser.id,
            gamemode: t.gamemode,
            tier: t.tier,
            givenBy: member.id,
          })
          .onConflictDoUpdate({
            target: [tiers.discordId, tiers.gamemode],
            set: { tier: t.tier, givenBy: member.id, updatedAt: new Date() },
          });
      }
    }

    const targetMember = await interaction.guild!.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (targetMember) {
      const shameRoleRow = await db
        .select()
        .from(shameRoles)
        .where(
          and(
            eq(shameRoles.guildId, interaction.guildId!),
            eq(shameRoles.category, restriction.type)
          )
        )
        .limit(1);

      if (shameRoleRow[0]) {
        await targetMember.roles
          .remove(shameRoleRow[0].roleId, "Unrestricted by staff")
          .catch(() => null);
      }
    }

    await targetUser
      .send({
        embeds: [
          buildUnrestrictDmEmbed({
            type: restriction.type,
            tiersRestored: prevTiers?.length ?? 0,
          }),
        ],
      })
      .catch(() => null);

    await interaction.editReply({
      content: [
        `✅ **${targetUser.username}** has been unrestricted.`,
        `**Tiers restored:** ${prevTiers?.length ?? 0} gamemode(s)`,
      ].join("\n"),
    });

    await logCommand(client, {
      command: "unrestrict",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id },
    });
  },
};
