import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { testerRoles, voluntaryTesterRole } from "../database/schema";
import { eq } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const testerRoleCommand = {
  data: new SlashCommandBuilder()
    .setName("tester-role")
    .setDescription("Configure tester roles (Manager only)")
    .setDefaultMemberPermissions(null)
    .addSubcommand((sub) =>
      sub
        .setName("gamemode")
        .setDescription("Set the tester role for a specific gamemode")
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
          o.setName("role").setDescription("The gamemode tester role").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("voluntary")
        .setDescription("Set the global @Voluntary Tester role")
        .addRoleOption((o) =>
          o.setName("role").setDescription("The Voluntary Tester role").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const sub = interaction.options.getSubcommand();

    if (sub === "gamemode") {
      const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
      const role = interaction.options.getRole("role", true);

      await db
        .insert(testerRoles)
        .values({
          guildId: interaction.guildId!,
          gamemode,
          roleId: role.id,
        })
        .onConflictDoUpdate({
          target: [testerRoles.guildId, testerRoles.gamemode],
          set: { roleId: role.id, updatedAt: new Date() },
        });

      await interaction.reply({
        content: `✅ **${GAMEMODES[gamemode]}** tester role set to <@&${role.id}>.`,
        ephemeral: true,
      });
    } else {
      const role = interaction.options.getRole("role", true);

      await db
        .insert(voluntaryTesterRole)
        .values({ guildId: interaction.guildId!, roleId: role.id })
        .onConflictDoUpdate({
          target: [voluntaryTesterRole.guildId],
          set: { roleId: role.id, updatedAt: new Date() },
        });

      await interaction.reply({
        content: `✅ **@Voluntary Tester** role set to <@&${role.id}>.`,
        ephemeral: true,
      });
    }

    await logCommand(client, {
      command: `tester-role ${sub}`,
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { sub },
    });
  },
};
