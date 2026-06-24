import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
} from "discord.js";
import { db } from "../database";
import { channelConfig } from "../database/schema";
import { requireStaff } from "../utils/permissions";
import { logCommand } from "../handlers/audit";

export const setChannelCommand = {
  data: new SlashCommandBuilder()
    .setName("set-channel")
    .setDescription("Configure a bot channel (Manager only)")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("The channel type to configure")
        .setRequired(true)
        .addChoices(
          { name: "Transcript", value: "transcript" },
          { name: "Audit Log", value: "audit_log" },
          { name: "Results", value: "results" },
          { name: "Commands", value: "commands" },
          { name: "Redeem", value: "redeem" },
          { name: "Migrate", value: "migrate" },
          { name: "Testing Leaderboard", value: "testing_leaderboard" },
        )
    )
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("The channel to assign")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "manager"))) return;

    const type = interaction.options.getString("type", true);
    const channel = interaction.options.getChannel("channel", true);

    await db
      .insert(channelConfig)
      .values({
        guildId: interaction.guildId!,
        configKey: type,
        channelId: channel.id,
      })
      .onConflictDoUpdate({
        target: [channelConfig.guildId, channelConfig.configKey],
        set: { channelId: channel.id, updatedAt: new Date() },
      });

    const labels: Record<string, string> = {
      transcript: "Transcript",
      audit_log: "Audit Log",
      results: "Results",
      commands: "Commands",
      redeem: "Redeem",
      migrate: "Migrate",
      testing_leaderboard: "Testing Leaderboard",
    };

    await interaction.reply({
      content: `✅ **${labels[type] ?? type}** channel set to <#${channel.id}>.`,
      ephemeral: true,
    });

    await logCommand(client, {
      command: "set-channel",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { type, channel: channel.id },
    });
  },
};
