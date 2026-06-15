import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { testerStats, channelConfig } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { REDEEM_REWARDS } from "../utils/constants";
import { buildRedeemEmbed } from "../utils/embeds";
import { getVoluntaryTesterRoleId } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const redeemCommand = {
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Redeem a reward using your all-time test count")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("reward")
        .setDescription("Choose a reward to redeem")
        .setRequired(true)
        .addChoices(
          ...REDEEM_REWARDS.map((r) => ({ name: r.label, value: r.value }))
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const guildId = interaction.guildId!;

    const redeemChannelRow = await db
      .select()
      .from(channelConfig)
      .where(
        and(
          eq(channelConfig.guildId, guildId),
          eq(channelConfig.configKey, "redeem")
        )
      )
      .limit(1);

    if (redeemChannelRow[0] && interaction.channelId !== redeemChannelRow[0].channelId) {
      await interaction.reply({
        content: `❌ This command can only be used in <#${redeemChannelRow[0].channelId}>.`,
        ephemeral: true,
      });
      return;
    }

    const vtRoleId = await getVoluntaryTesterRoleId(guildId);
    if (!vtRoleId || !member.roles.cache.has(vtRoleId)) {
      await interaction.reply({
        content: "❌ Only Voluntary Testers can use this command.",
        ephemeral: true,
      });
      return;
    }

    const rewardKey = interaction.options.getString("reward", true);
    const reward = REDEEM_REWARDS.find((r) => r.value === rewardKey);

    if (!reward) {
      await interaction.reply({ content: "❌ Invalid reward.", ephemeral: true });
      return;
    }

    const statsRow = await db
      .select()
      .from(testerStats)
      .where(eq(testerStats.discordId, member.id))
      .limit(1);

    const currentTests = statsRow[0]?.allTimeTests ?? 0;

    if (currentTests < reward.cost) {
      await interaction.reply({
        content: `❌ You need **${reward.cost}** all-time tests to redeem this reward. You currently have **${currentTests}**.`,
        ephemeral: true,
      });
      return;
    }

    const newTotal = currentTests - reward.cost;

    if (statsRow[0]) {
      await db
        .update(testerStats)
        .set({ allTimeTests: newTotal, updatedAt: new Date() })
        .where(eq(testerStats.discordId, member.id));
    } else {
      await db
        .insert(testerStats)
        .values({ discordId: member.id, allTimeTests: 0, monthlyTests: 0 });
    }

    const embed = buildRedeemEmbed({
      testerId: member.id,
      reward: reward.label,
      testsCost: reward.cost,
      testsRemaining: newTotal,
    });

    await interaction.reply({ embeds: [embed], ephemeral: false });

    await logCommand(client, {
      command: "redeem",
      user: member,
      guildId,
      channelId: interaction.channelId,
      options: { reward: reward.label, cost: String(reward.cost), remaining: String(newTotal) },
    });
  },
};
