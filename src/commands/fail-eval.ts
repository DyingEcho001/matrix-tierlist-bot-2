import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { tickets } from "../database/schema";
import { eq } from "drizzle-orm";
import { getTicketByChannel, closeTicket, incrementTesterStats } from "../handlers/ticket";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const failEvalCommand = {
  data: new SlashCommandBuilder()
    .setName("fail-eval")
    .setDescription("Fail an HT3 evaluation — rank testee as LT3 with 15-day cooldown")
    .setDefaultMemberPermissions(null),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;

    if (!(await requireStaff(interaction, "regulator"))) return;

    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) {
      await interaction.reply({
        content: "❌ This command can only be used in an active HT3 testing ticket.",
        ephemeral: true,
      });
      return;
    }

    if (ticket.type !== "ht3") {
      await interaction.reply({
        content: "❌ This is not an HT3 evaluation ticket.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `Failing HT3 eval — ranking <@${ticket.testeeId}> as **LT3** with 15-day cooldown...`,
    });

    await incrementTesterStats(ticket.testerId);

    await closeTicket({
      client,
      ticket,
      tier: "LT3",
      closedBy: member.id,
      skipCooldown: false,
    });

    await logCommand(client, {
      command: "fail-eval",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { testee: ticket.testeeId },
    });
  },
};
