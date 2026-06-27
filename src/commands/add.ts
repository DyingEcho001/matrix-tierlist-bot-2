import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { db } from "../database";
import { tickets } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { getTicketByChannel } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const addCommand = {
  data: new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add a user to the current testing ticket (Helper+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to add to the ticket").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply();

    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "helper"))) return;

    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) {
      await interaction.editReply({
        content: "❌ This command can only be used inside a bot-generated testing ticket.",
      });
      return;
    }

    const targetUser = interaction.options.getUser("user", true);
    const targetMember = await interaction.guild!.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!targetMember) {
      await interaction.editReply({
        content: "❌ Could not find that user in the server.",
      });
      return;
    }

    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(targetMember, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    await interaction.editReply({
      content: `✅ <@${targetUser.id}> has been added to this ticket.`,
    });

    await logCommand(client, {
      command: "add",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id },
    });
  },
};
