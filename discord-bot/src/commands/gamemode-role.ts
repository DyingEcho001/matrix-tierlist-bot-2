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

export const gamemodeRoleCommand = {
  data: new SlashCommandBuilder()
    .setName("gamemode-role")
    .setDescription("Set the waitlist role for a gamemode (Manager only)")
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
    .addRoleOption((o) =>
      o
        .setName("role")
        .setDescription("The role players receive when joining this gamemode's waitlist")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const role = interaction.options.getRole("role", true);

    await db
      .insert(gamemodeRoles)
      .values({
        guildId: interaction.guildId!,
        gamemode,
        roleId: role.id,
      })
      .onConflictDoUpdate({
        target: [gamemodeRoles.guildId, gamemodeRoles.gamemode],
        set: { roleId: role.id, updatedAt: new Date() },
      });

    await interaction.reply({
      content: `✅ **${GAMEMODES[gamemode]}** waitlist role set to <@&${role.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "gamemode-role",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, role: role.id },
    });
  },
};
