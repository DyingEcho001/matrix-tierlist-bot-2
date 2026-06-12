import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { db } from "../database";
import { tickets, categoryConfig } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { buildEvalEmbed } from "../utils/embeds";
import { getTicketByChannel } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const evalCommand = {
  data: new SlashCommandBuilder()
    .setName("eval")
    .setDescription("Trigger HT3 evaluation for the current testee")
    .setDefaultMemberPermissions(null),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;

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
        content: "❌ Only the tester who opened this ticket can use /eval.",
        ephemeral: true,
      });
      return;
    }

    const { embed, row } = buildEvalEmbed();
    await interaction.reply({ embeds: [embed], components: [row] });

    await db
      .update(tickets)
      .set({ isEvalPending: true })
      .where(eq(tickets.id, ticket.id));

    await logCommand(client, {
      command: "eval",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { testee: ticket.testeeId },
    });
  },
};
