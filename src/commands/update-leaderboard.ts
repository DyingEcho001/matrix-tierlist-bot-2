import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { requireStaff } from "../utils/permissions";
import { postOrUpdateLeaderboard } from "../handlers/leaderboard";
import { logCommand } from "../handlers/audit";

export const updateLeaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("update-leaderboard")
    .setDescription("Force-refresh the testing leaderboard (Regulator+)")
    .setDefaultMemberPermissions(null),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    await interaction.deferReply({ ephemeral: true });

    await postOrUpdateLeaderboard(client, interaction.guildId!);

    await interaction.editReply({
      content: "✅ Testing leaderboard has been updated.",
    });

    await logCommand(client, {
      command: "update-leaderboard",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
    });
  },
};
