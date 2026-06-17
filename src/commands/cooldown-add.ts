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
import { parseDuration } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const cooldownAddCommand = {
  data: new SlashCommandBuilder()
    .setName("cooldown-add")
    .setDescription("Manually add a cooldown for a player (Manager only)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("The player to add a cooldown for").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode to add the cooldown for")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("duration")
        .setDescription("Duration of the cooldown (e.g. 7d, 24h, 30m)")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const targetUser = interaction.options.getUser("user", true);
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const durationStr = interaction.options.getString("duration", true);

    const ms = parseDuration(durationStr);
    if (!ms) {
      await interaction.reply({
        content: "❌ Invalid duration format. Use formats like `7d`, `24h`, `30m`.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const expiresAt = new Date(Date.now() + ms);

    await db
      .insert(cooldowns)
      .values({ discordId: targetUser.id, gamemode, expiresAt })
      .onConflictDoUpdate({
        target: [cooldowns.discordId, cooldowns.gamemode],
        set: { expiresAt, createdAt: new Date() },
      });

    const days = Math.round(ms / (1000 * 60 * 60 * 24) * 10) / 10;

    await interaction.editReply({
      content: [
        `✅ Cooldown added for <@${targetUser.id}> in **${GAMEMODES[gamemode]}**.`,
        `**Duration:** ${durationStr} (~${days} day${days !== 1 ? "s" : ""})`,
        `**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:f>`,
      ].join("\n"),
    });

    await logCommand(client, {
      command: "cooldown-add",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id, gamemode, duration: durationStr },
    });
  },
};
