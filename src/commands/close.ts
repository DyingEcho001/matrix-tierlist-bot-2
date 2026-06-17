import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { tickets } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { TIERS, Tier } from "../utils/constants";
import { getTicketByChannel, closeTicket, incrementTesterStats } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const closeCommand = {
  data: new SlashCommandBuilder()
    .setName("close")
    .setDescription("Give a tier and close the current testing ticket")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("tier")
        .setDescription("The tier to assign to the testee")
        .setRequired(true)
        .addChoices(
          { name: "LT5", value: "LT5" },
          { name: "HT5", value: "HT5" },
          { name: "LT4", value: "LT4" },
          { name: "HT4", value: "HT4" },
          { name: "LT3", value: "LT3" },
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const tier = interaction.options.getString("tier", true) as Tier;

    const ticket = await getTicketByChannel(interaction.channelId);

    if (!ticket) {
      await interaction.reply({
        content: "❌ This command can only be used in an active testing ticket.",
        ephemeral: true,
      });
      return;
    }

    if (ticket.testerId !== member.id) {
      await interaction.reply({
        content: "❌ Only the tester who opened this ticket can close it.",
        ephemeral: true,
      });
      return;
    }

    if (ticket.isEvalPending) {
      await interaction.reply({
        content: "❌ This ticket has a pending HT3 evaluation. Use `/pass-eval` or `/fail-eval`.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Closing ticket and assigning **${tier}** to <@${ticket.testeeId}>...`,
    });

    await incrementTesterStats(member.id);

    await closeTicket({
      client,
      ticket,
      tier,
      closedBy: member.id,
    });

    await logCommand(client, {
      command: "close",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { tier, testee: ticket.testeeId, gamemode: ticket.gamemode },
    });
  },
};
