import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
} from "discord.js";
import { requireStaff } from "../utils/permissions";
import { getTicketByChannel } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const removeCommand = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a user's access to the current testing ticket (Senior Mod+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to remove from the ticket").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "senior_moderator"))) return;

    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) {
      await interaction.reply({
        content: "❌ This command can only be used inside a bot-generated testing ticket.",
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser("user", true);
    const targetMember = await interaction.guild!.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!targetMember) {
      await interaction.reply({
        content: "❌ Could not find that user in the server.",
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(targetMember, {
      ViewChannel: false,
      SendMessages: false,
    });

    await interaction.reply({
      content: `✅ <@${targetUser.id}> has been removed from this ticket.`,
    });

    await logCommand(client, {
      command: "remove",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id },
    });
  },
};
