import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import { db } from "../database";
import { tickets, players, tiers } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { buildTicketInfoEmbed } from "../utils/embeds";
import { getTicketByChannel } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const convertWaitlistTicketCommand = {
  data: new SlashCommandBuilder()
    .setName("convert-waitlist-ticket")
    .setDescription("Convert a channel to/from a testing ticket (Administrator only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("The channel to convert")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Conversion direction")
        .setRequired(true)
        .addChoices(
          { name: "Normal → Testing Ticket", value: "to_ticket" },
          { name: "Testing Ticket → Normal", value: "to_normal" }
        )
    )
    .addUserOption((o) =>
      o
        .setName("testee")
        .setDescription("The testee (required when converting to ticket)")
        .setRequired(false)
    )
    .addUserOption((o) =>
      o
        .setName("tester")
        .setDescription("The tester (required when converting to ticket)")
        .setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("Gamemode (required when converting to ticket)")
        .setRequired(false)
        .addChoices(...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm })))
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member as GuildMember;

    // Double-check administrator permission
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({ content: "❌ You need Administrator permission to use this command." });
      return;
    }

    const type = interaction.options.getString("type", true);
    const targetChannel = interaction.options.getChannel("channel", true);

    const channel = (await client.channels.fetch(targetChannel.id).catch(() => null)) as TextChannel | null;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: "❌ The specified channel must be a text channel." });
      return;
    }

    // ── Convert Normal → Testing Ticket ──────────────────────────────────────
    if (type === "to_ticket") {
      const testeeUser = interaction.options.getUser("testee");
      const testerUser = interaction.options.getUser("tester");
      const gamemode = interaction.options.getString("gamemode") as Gamemode | null;

      if (!testeeUser || !testerUser || !gamemode) {
        await interaction.editReply({
          content: "❌ **testee**, **tester**, and **gamemode** are all required when converting to a ticket.",
        });
        return;
      }

      // Prevent duplicate tickets in the same channel
      const existing = await getTicketByChannel(channel.id);
      if (existing) {
        await interaction.editReply({ content: "❌ This channel already has an active testing ticket." });
        return;
      }

      const guild = interaction.guild!;
      const [testeeMember, testerMember] = await Promise.all([
        guild.members.fetch(testeeUser.id).catch(() => null),
        guild.members.fetch(testerUser.id).catch(() => null),
      ]);

      if (!testeeMember || !testerMember) {
        await interaction.editReply({ content: "❌ Could not find one or both users in this server." });
        return;
      }

      // Fetch testee profile and previous tier
      const [playerData, previousTierRow] = await Promise.all([
        db.select().from(players).where(eq(players.discordId, testeeUser.id)).limit(1),
        db.select().from(tiers).where(and(eq(tiers.discordId, testeeUser.id), eq(tiers.gamemode, gamemode))).limit(1),
      ]);
      const playerInfo = playerData[0];
      const previousTier = previousTierRow[0]?.tier ?? null;
      const region = playerInfo?.region ?? "EU/NA";

      // Apply ticket channel permissions
      await channel.permissionOverwrites.set([
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: testeeMember.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: testerMember.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: guild.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ]);

      // Insert ticket record
      await db.insert(tickets).values({
        type: "normal",
        gamemode,
        region,
        testerId: testerUser.id,
        testeeId: testeeUser.id,
        channelId: channel.id,
        guildId: interaction.guildId!,
        status: "open",
      });

      // Send the ticket info embeds (matches the standard pull flow)
      const embeds = buildTicketInfoEmbed({
        testee: testeeMember,
        tester: testerMember,
        gamemode,
        ign: playerInfo?.ign ?? testeeUser.username,
        region,
        preferredServer: playerInfo?.preferredServer ?? "Unknown",
        isPremium: playerInfo?.isPremium,
        previousTier,
      });

      await channel.send({
        content: `<@${testerUser.id}> <@${testeeUser.id}>`,
        embeds,
      });

      await interaction.editReply({
        content: `✅ <#${channel.id}> has been converted into a testing ticket.\n**Testee:** <@${testeeUser.id}> | **Tester:** <@${testerUser.id}> | **Gamemode:** ${GAMEMODES[gamemode]}`,
      });

      await logCommand(client, {
        command: "convert-waitlist-ticket",
        user: member,
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        options: {
          channel: channel.id,
          type,
          testee: testeeUser.id,
          tester: testerUser.id,
          gamemode,
        },
      });

    // ── Convert Testing Ticket → Normal ──────────────────────────────────────
    } else {
      const ticket = await getTicketByChannel(channel.id);
      if (!ticket) {
        await interaction.editReply({ content: "❌ No active testing ticket found in that channel." });
        return;
      }

      // Close the ticket record
      await db
        .update(tickets)
        .set({ status: "closed", closedAt: new Date(), closedBy: member.id })
        .where(eq(tickets.id, ticket.id));

      // Restore channel to @everyone-visible (removes all custom overwrites)
      await channel.permissionOverwrites.set([
        {
          id: interaction.guild!.id,
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ]).catch(() => null);

      await channel.send({
        content: `🔓 This channel has been converted back to a normal channel by <@${member.id}>.`,
      });

      await interaction.editReply({
        content: `✅ <#${channel.id}> has been converted back to a normal channel and its ticket has been closed.`,
      });

      await logCommand(client, {
        command: "convert-waitlist-ticket",
        user: member,
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        options: { channel: channel.id, type },
      });
    }
  },
};
