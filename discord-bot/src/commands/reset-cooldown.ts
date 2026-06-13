import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { cooldowns } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const resetCooldownCommand = {
  data: new SlashCommandBuilder()
    .setName("reset-cooldown")
    .setDescription("Reset a player's test cooldown for a gamemode (Regulator+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("The player to reset the cooldown for").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode to reset the cooldown for")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const targetUser = interaction.options.getUser("user", true);
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;

    await interaction.deferReply({ ephemeral: true });

    const existing = await db
      .select()
      .from(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, targetUser.id),
          eq(cooldowns.gamemode, gamemode)
        )
      )
      .limit(1);

    if (!existing[0]) {
      await interaction.editReply({
        content: `❌ <@${targetUser.id}> has no active cooldown for **${GAMEMODES[gamemode]}**.`,
      });
      return;
    }

    await db
      .delete(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, targetUser.id),
          eq(cooldowns.gamemode, gamemode)
        )
      );

    await interaction.editReply({
      content: `✅ Cooldown for <@${targetUser.id}> in **${GAMEMODES[gamemode]}** has been reset.`,
    });

    await logCommand(client, {
      command: "reset-cooldown",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id, gamemode },
    });
  },
};
