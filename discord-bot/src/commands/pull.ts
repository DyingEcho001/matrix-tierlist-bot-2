import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
} from "discord.js";
import { db } from "../database";
import {
  queues,
  queueTesters,
  queueMembers,
  tickets,
} from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { isVoluntaryTester } from "../utils/permissions";
import {
  getOrCreateQueue,
  getQueueMembers,
  popFromQueue,
} from "../handlers/queue";
import { createTestingTicket, getTicketByChannel } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const pullCommand = {
  data: new SlashCommandBuilder()
    .setName("pull")
    .setDescription("Pull a testee from the queue and create a testing ticket")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode queue to pull from")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region queue to pull from")
        .setRequired(true)
        .addChoices(
          { name: "NA", value: "NA" },
          { name: "EU", value: "EU" },
          { name: "AS", value: "AS" },
          { name: "SA", value: "SA" },
          { name: "AU", value: "AU" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemode = interaction.options.getString("gamemode", true);
    const region = interaction.options.getString("region", true);

    const canTest = await isVoluntaryTester(member, interaction.guildId!, gamemode);
    if (!canTest) {
      await interaction.reply({
        content: `❌ You need the **@Voluntary Tester** and **@${GAMEMODES[gamemode as Gamemode]}Tester** roles to pull testees.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const queue = await getOrCreateQueue(gamemode, region);

    const isTester = await db
      .select()
      .from(queueTesters)
      .where(
        and(
          eq(queueTesters.queueId, queue.id),
          eq(queueTesters.discordId, member.id)
        )
      )
      .limit(1);

    if (isTester.length === 0) {
      await interaction.editReply({
        content:
          "❌ You are not an active tester in this queue. Use `/start` first.",
      });
      return;
    }

    const existingTicket = await db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.testerId, member.id),
          eq(tickets.status, "open"),
          eq(tickets.gamemode, gamemode)
        )
      )
      .limit(1);

    if (existingTicket.length > 0) {
      const channel = (await client.channels
        .fetch(existingTicket[0].channelId)
        .catch(() => null)) as TextChannel | null;
      if (channel) {
        await channel
          .delete("Tester skipped testee")
          .catch(() => null);
      }

      await db
        .update(tickets)
        .set({ status: "skipped", closedAt: new Date() })
        .where(eq(tickets.id, existingTicket[0].id));
    }

    const testeeId = await popFromQueue(queue.id);
    if (!testeeId) {
      await interaction.editReply({
        content: "❌ The queue is empty. No one to pull.",
      });
      return;
    }

    const testee = await interaction.guild!.members
      .fetch(testeeId)
      .catch(() => null);

    if (!testee) {
      await interaction.editReply({
        content:
          "❌ Could not find the next testee in the server. They may have left.",
      });
      return;
    }

    const ticketChannel = await createTestingTicket({
      guild: interaction.guild!,
      tester: member,
      testee,
      gamemode: gamemode as Gamemode,
      region,
    });

    if (!ticketChannel) {
      await interaction.editReply({
        content: "❌ Failed to create the testing ticket. Check bot permissions.",
      });
      return;
    }

    await interaction.editReply({
      content: `✅ Pulled <@${testeeId}> from the queue. Ticket created: ${ticketChannel}`,
    });

    await logCommand(client, {
      command: "pull",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region, testee: testeeId },
    });
  },
};
