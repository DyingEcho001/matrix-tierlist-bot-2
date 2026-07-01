import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
} from "discord.js";
import { db } from "../database";
import { playerInvites, cooldowns, tiers } from "../database/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  GAMEMODES,
  GAMEMODE_KEYS,
  Gamemode,
  TIER_ORDER,
  INVITE_COSTS,
  GAMEMODE_EMOJIS,
  Tier,
} from "../utils/constants";
import { logCommand } from "../handlers/audit";

function getInviteCost(tier: Tier | null): { cost: number; label: string } {
  if (!tier) return { cost: INVITE_COSTS.lt3_and_below, label: "LT3 & Below" };
  if (TIER_ORDER[tier] >= TIER_ORDER["LT2"]) return { cost: INVITE_COSTS.lt2_and_above, label: "LT2 & Above" };
  if (tier === "HT3") return { cost: INVITE_COSTS.ht3, label: "HT3" };
  return { cost: INVITE_COSTS.lt3_and_below, label: "LT3 & Below" };
}

export const rewardsCommand = {
  data: new SlashCommandBuilder()
    .setName("rewards")
    .setDescription("Use your invites to remove an active cooldown")
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode cooldown you want to remove")
        .setRequired(true)
        .addChoices(...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm })))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;

    await interaction.deferReply({ ephemeral: true });

    const cooldownRow = await db
      .select()
      .from(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, interaction.user.id),
          eq(cooldowns.gamemode, gamemode),
          gt(cooldowns.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!cooldownRow[0]) {
      await interaction.editReply({
        content: `❌ You have no active **${GAMEMODES[gamemode]}** cooldown to remove.`,
      });
      return;
    }

    const tierRow = await db
      .select()
      .from(tiers)
      .where(
        and(
          eq(tiers.discordId, interaction.user.id),
          eq(tiers.gamemode, gamemode)
        )
      )
      .limit(1);

    const tier = (tierRow[0]?.tier ?? null) as Tier | null;
    const { cost, label } = getInviteCost(tier);

    const inviteRow = await db
      .select()
      .from(playerInvites)
      .where(eq(playerInvites.discordId, interaction.user.id))
      .limit(1);

    const balance = inviteRow[0]?.balance ?? 0;

    if (balance < cost) {
      await interaction.editReply({
        content: [
          `❌ You need **${cost} invites** to remove your **${GAMEMODES[gamemode]}** cooldown (${label} rate).`,
          `Your balance: **${balance} invite${balance !== 1 ? "s" : ""}**.`,
        ].join("\n"),
      });
      return;
    }

    const newBalance = balance - cost;

    await db
      .delete(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, interaction.user.id),
          eq(cooldowns.gamemode, gamemode)
        )
      );

    if (inviteRow[0]) {
      await db
        .update(playerInvites)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(playerInvites.discordId, interaction.user.id));
    }

    const gamemodeEmoji = GAMEMODE_EMOJIS[gamemode] ?? "";

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Cooldown Removed!")
      .setDescription(
        [
          `Your ${gamemodeEmoji} **${GAMEMODES[gamemode]}** cooldown has been removed.`,
          "",
          `**Cost:** ${cost} invite${cost !== 1 ? "s" : ""}`,
          `**Remaining balance:** ${newBalance} invite${newBalance !== 1 ? "s" : ""}`,
          "",
          "You can now re-register for testing in this gamemode.",
        ].join("\n")
      )
      .setColor(0x57F287)
      .setFooter({ text: "Matrix Tierlist" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logCommand(client, {
      command: "rewards",
      user: interaction.member as import("discord.js").GuildMember,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, cost: String(cost), remaining: String(newBalance) },
    });
  },
};
