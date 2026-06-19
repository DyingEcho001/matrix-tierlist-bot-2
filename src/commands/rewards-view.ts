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
  Gamemode,
  INVITE_COSTS,
  GAMEMODE_EMOJIS,
  TIER_ORDER,
  Tier,
} from "../utils/constants";

export const rewardsViewCommand = {
  data: new SlashCommandBuilder()
    .setName("rewards-view")
    .setDescription("Check your invite balance and cooldown removal costs"),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply({ ephemeral: true });

    const inviteRow = await db
      .select()
      .from(playerInvites)
      .where(eq(playerInvites.discordId, interaction.user.id))
      .limit(1);

    const balance = inviteRow[0]?.balance ?? 0;

    const activeCooldowns = await db
      .select()
      .from(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, interaction.user.id),
          gt(cooldowns.expiresAt, new Date())
        )
      );

    const playerTiers = await db
      .select()
      .from(tiers)
      .where(eq(tiers.discordId, interaction.user.id));

    const tierMap = new Map(playerTiers.map((t) => [t.gamemode, t.tier as Tier]));

    const costLines = activeCooldowns.map((c) => {
      const gm = c.gamemode as Gamemode;
      const tier = tierMap.get(gm) ?? null;
      const emoji = GAMEMODE_EMOJIS[gm] ?? "";
      const name = GAMEMODES[gm] ?? gm;
      const expiryUnix = Math.floor(c.expiresAt.getTime() / 1000);

      let cost: number;
      if (!tier) {
        cost = INVITE_COSTS.lt3_and_below;
      } else if (TIER_ORDER[tier] >= TIER_ORDER["LT2"]) {
        cost = INVITE_COSTS.lt2_and_above;
      } else if (tier === "HT3") {
        cost = INVITE_COSTS.ht3;
      } else {
        cost = INVITE_COSTS.lt3_and_below;
      }

      return `${emoji} **${name}** — expires <t:${expiryUnix}:R> — **${cost} invite${cost !== 1 ? "s" : ""}** to remove`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Invite Rewards")
      .setColor(0x9B59B6)
      .addFields(
        {
          name: "Your Balance",
          value: `**${balance}** invite${balance !== 1 ? "s" : ""}`,
          inline: false,
        },
        {
          name: "Cooldown Removal Costs",
          value: [
            "**LT3 & Below** → 2 invites",
            "**HT3** → 10 invites",
            "**LT2 & Above** → 25 invites",
          ].join("\n"),
          inline: false,
        },
        {
          name: "Your Active Cooldowns",
          value:
            costLines.length > 0
              ? costLines.join("\n")
              : "*None — you have no active cooldowns.*",
          inline: false,
        }
      )
      .setFooter({ text: "Use /rewards to remove a cooldown • Matrix Tierlist" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
