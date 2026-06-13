import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { gamemodeRoles } from "../database/schema";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const waitlistRoleSetCommand = {
  data: new SlashCommandBuilder()
    .setName("waitlist-role-set")
    .setDescription("Set the waitlist role for a gamemode and region (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region")
        .setRequired(true)
        .addChoices(
          { name: "EU/NA", value: "EU/NA" },
          { name: "AS/AU", value: "AS/AU" }
        )
    )
    .addRoleOption((o) =>
      o
        .setName("role")
        .setDescription("The role players receive when joining this gamemode/region waitlist")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const region = interaction.options.getString("region", true);
    const role = interaction.options.getRole("role", true);

    await db
      .insert(gamemodeRoles)
      .values({
        guildId: interaction.guildId!,
        gamemode,
        region,
        roleId: role.id,
      })
      .onConflictDoUpdate({
        target: [gamemodeRoles.guildId, gamemodeRoles.gamemode, gamemodeRoles.region],
        set: { roleId: role.id, updatedAt: new Date() },
      });

    await interaction.reply({
      content: `✅ **${GAMEMODES[gamemode]}** (${region}) waitlist role set to <@&${role.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "waitlist-role-set",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region, role: role.id },
    });
  },
};
