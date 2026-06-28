import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { tiers, cooldowns, players } from "../database/schema";
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
import { commandBypasses } from "../database/schema";
import { sendResultToChannel, incrementTesterStats, applyTierRole } from "../handlers/ticket";
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
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode to rank in")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("Discord user to rank")
        .setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("discord-id")
        .setDescription("Discord user ID to rank (alternative to @user)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const tier = interaction.options.getString("tier", true) as Tier;
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const targetUser = interaction.options.getUser("user");
    const rawDiscordId = interaction.options.getString("discord-id");

    await interaction.deferReply({ ephemeral: true });

    if (!targetUser && !rawDiscordId) {
      await interaction.editReply({
        content: "❌ Please provide a user (@mention) or a Discord ID.",
      });
      return;
    }

    const targetId = targetUser?.id ?? rawDiscordId!;

    const registrationRow = await db
      .select()
      .from(players)
      .where(eq(players.discordId, targetId))
      .limit(1);

    if (!registrationRow[0]) {
      await interaction.editReply({
        content: `❌ <@${targetId}> is not registered. They must register a profile before being ranked.`,
      });
      return;
    }

    const playerData = registrationRow[0];

    if (targetId === member.id) {
      const bypassRow = await db
        .select()
        .from(commandBypasses)
        .where(
          and(
            eq(commandBypasses.guildId, interaction.guildId!),
            eq(commandBypasses.discordId, member.id)
          )
        )
        .limit(1);

      if (!bypassRow[0]) {
        await interaction.editReply({
          content: "❌ You cannot use this command on yourself.",
        });
        return;
      }
    }

    const isHT3Plus = HT3_PLUS_TIERS.includes(tier);
    const cooldownMs = isHT3Plus ? COOLDOWNS.ht3 : COOLDOWNS.normal;
    const cooldownDays = isHT3Plus ? 15 : 5;

    const prevTierRow = await db
      .select()
      .from(tiers)
      .where(and(eq(tiers.discordId, targetId), eq(tiers.gamemode, gamemode)))
      .limit(1);
    const previousTier = prevTierRow[0]?.tier ?? null;

    await db
      .insert(tiers)
      .values({
        discordId: targetId,
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
      .values({ discordId: targetId, gamemode, expiresAt })
      .onConflictDoUpdate({
        target: [cooldowns.discordId, cooldowns.gamemode],
        set: { expiresAt, createdAt: new Date() },
      });

    await applyTierRole({
      client,
      guildId: interaction.guildId!,
      discordId: targetId,
      gamemode,
      tier,
    });

    await incrementTesterStats(member.id);

    await sendResultToChannel({
      client,
      guildId: interaction.guildId!,
      testeeId: targetId,
      testerId: member.id,
      gamemode,
      tier,
      cooldownDays,
      ign: playerData.ign,
      region: playerData.region,
      previousTier,
    });

    await interaction.editReply({
      content: `✅ Ranked <@${targetId}> as **${tier}** in **${GAMEMODES[gamemode]}**. Result posted to the results channel.`,
    });

    await logCommand(client, {
      command: "rank",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { tier, user: targetId, gamemode },
    });
  },
};
