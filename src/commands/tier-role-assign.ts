import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { tierRoles } from "../database/schema";
import { TIERS, GAMEMODE_KEYS, GAMEMODES, Tier, Gamemode } from "../utils/constants";
import { requireSuperAdmin } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const tierRoleAssignCommand = {
  data: new SlashCommandBuilder()
    .setName("tier-role-assign")
    .setDescription("Set which Discord role corresponds to a tier in a gamemode (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("tier")
        .setDescription("The tier")
        .setRequired(true)
        .addChoices(...TIERS.map((t) => ({ name: t, value: t })))
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addRoleOption((o) =>
      o
        .setName("role")
        .setDescription("The Discord role to assign for this tier")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireSuperAdmin(interaction))) return;

    const tier = interaction.options.getString("tier", true) as Tier;
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const role = interaction.options.getRole("role", true);

    await db
      .insert(tierRoles)
      .values({
        guildId: interaction.guildId!,
        tier,
        gamemode,
        roleId: role.id,
      })
      .onConflictDoUpdate({
        target: [tierRoles.guildId, tierRoles.tier, tierRoles.gamemode],
        set: { roleId: role.id, updatedAt: new Date() },
      });

    await interaction.reply({
      content: `✅ **${tier}** in **${GAMEMODES[gamemode]}** is now mapped to <@&${role.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "tier-role-assign",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { tier, gamemode, role: role.id },
    });
  },
};
