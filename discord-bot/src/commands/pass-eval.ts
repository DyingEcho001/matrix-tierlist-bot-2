import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { getTicketByChannel, closeTicket, incrementTesterStats } from "../handlers/ticket";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const passEvalCommand = {
  data: new SlashCommandBuilder()
    .setName("pass-eval")
    .setDescription("Pass an HT3 evaluation — rank testee as HT3 with no cooldown")
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
      content: `Passing HT3 eval — ranking <@${ticket.testeeId}> as **HT3** with no cooldown...`,
    });

    await incrementTesterStats(ticket.testerId);

    await closeTicket({
      client,
      ticket,
      tier: "HT3",
      closedBy: member.id,
      skipCooldown: true,
    });

    await logCommand(client, {
      command: "pass-eval",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { testee: ticket.testeeId },
    });
  },
};
