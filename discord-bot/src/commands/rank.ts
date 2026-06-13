import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { tiers, cooldowns } from "../database/schema";
import { eq, and } from "drizzle-orm";
import {
  TIERS,
  Tier,
  GAMEMODE_KEYS,
  GAMEMODES,
  Gamemode,
  COOLDOWNS,
  HT3_PLUS_TIERS,
} from "../utils/constants";
import { requireStaff } from "../utils/permissions";
import { sendResultToChannel, incrementTesterStats } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const rankCommand = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Manually assign a tier to a player (Regulator+)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("tier")
        .setDescription("The tier to assign")
        .setRequired(true)
        .addChoices(...TIERS.map((t) => ({ name: t, value: t })))
    )
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("Discord user to rank")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode to rank in")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("ign")
        .setDescription("Player's IGN (optional)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const tier = interaction.options.getString("tier", true) as Tier;
    const targetUser = interaction.options.getUser("user", true);
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const ign = interaction.options.getString("ign");

    await interaction.deferReply({ ephemeral: true });

    const isHT3Plus = HT3_PLUS_TIERS.includes(tier);
    const cooldownMs = isHT3Plus ? COOLDOWNS.ht3 : COOLDOWNS.normal;
    const cooldownDays = isHT3Plus ? 15 : 5;

    await db
      .insert(tiers)
      .values({
        discordId: targetUser.id,
        gamemode,
        tier,
        givenBy: member.id,
      })
      .onConflictDoUpdate({
        target: [tiers.discordId, tiers.gamemode],
        set: { tier, givenBy: member.id, updatedAt: new Date() },
      });

    const expiresAt = new Date(Date.now() + cooldownMs);
    await db
      .insert(cooldowns)
      .values({ discordId: targetUser.id, gamemode, expiresAt })
      .onConflictDoUpdate({
        target: [cooldowns.discordId, cooldowns.gamemode],
        set: { expiresAt, createdAt: new Date() },
      });

    await sendResultToChannel({
      client,
      guildId: interaction.guildId!,
      testeeId: targetUser.id,
      testerId: member.id,
      gamemode,
      tier,
      cooldownDays,
    });

    await interaction.editReply({
      content: `✅ Ranked <@${targetUser.id}> as **${tier}** in **${GAMEMODES[gamemode]}**. Result posted to the results channel.`,
    });

    await logCommand(client, {
      command: "rank",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { tier, user: targetUser.id, gamemode, ign: ign ?? "not provided" },
    });
  },
};
