import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { playerInvites } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const addInvitesCommand = {
  data: new SlashCommandBuilder()
    .setName("add-invites")
    .setDescription("Add invites to a player's balance (Regulator+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("Player to add invites to").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("Number of invites to add")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    await interaction.deferReply({ ephemeral: true });

    const existing = await db
      .select()
      .from(playerInvites)
      .where(eq(playerInvites.discordId, targetUser.id))
      .limit(1);

    let newBalance: number;

    if (existing[0]) {
      newBalance = existing[0].balance + amount;
      await db
        .update(playerInvites)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(playerInvites.discordId, targetUser.id));
    } else {
      newBalance = amount;
      await db
        .insert(playerInvites)
        .values({ discordId: targetUser.id, balance: amount });
    }

    await interaction.editReply({
      content: [
        `✅ Added **${amount} invite${amount !== 1 ? "s" : ""}** to <@${targetUser.id}>.`,
        `**New balance:** ${newBalance} invite${newBalance !== 1 ? "s" : ""}`,
      ].join("\n"),
    });

    await logCommand(client, {
      command: "add-invites",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id, amount: String(amount), newBalance: String(newBalance) },
    });
  },
};
