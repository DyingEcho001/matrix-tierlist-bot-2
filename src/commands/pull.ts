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
  tickets,
} from "../database/schema";
import { eq, and } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { isVoluntaryTester } from "../utils/permissions";
import {
  getOrCreateQueue,
  popFromQueueWithPriority,
} from "../handlers/queue";
import { createTestingTicket } from "../handlers/ticket";
import { logCommand } from "../handlers/audit";

export const pullCommand = {
  data: new SlashCommandBuilder()
    .setName("pull")
    .setDescription("Pull a testee from your active queue and create a testing ticket")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("Only needed if you have multiple queues open — auto-detected otherwise")
        .setRequired(false)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("Region — auto-detected from your active queue if not provided")
        .setRequired(false)
        .addChoices(
          { name: "EU/NA", value: "EU/NA" },
          { name: "AS/AU", value: "AS/AU" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemodeInput = interaction.options.getString("gamemode");
    const regionInput = interaction.options.getString("region");

    await interaction.deferReply({ ephemeral: true });

    // Find all queues where this tester is currently active
    const activeTesterRows = await db
      .select({ queue: queues })
      .from(queueTesters)
      .innerJoin(queues, eq(queueTesters.queueId, queues.id))
      .where(eq(queueTesters.discordId, member.id));

    if (activeTesterRows.length === 0) {
      await interaction.editReply({
        content: "❌ You are not an active tester in any queue. Use `/start` first.",
      });
      return;
    }

    // Filter by gamemode if provided
    let matchedRow: (typeof activeTesterRows)[number] | undefined;

    if (gamemodeInput) {
      matchedRow = activeTesterRows.find((r) => r.queue.gamemode === gamemodeInput);
      if (!matchedRow) {
        await interaction.editReply({
          content: `❌ You are not an active tester in the **${GAMEMODES[gamemodeInput as Gamemode]}** queue. Use \`/start\` to open that queue first.`,
        });
        return;
      }
    } else {
      if (activeTesterRows.length > 1) {
        const list = activeTesterRows
          .map((r) => `**${GAMEMODES[r.queue.gamemode as Gamemode]}** (${r.queue.region})`)
          .join(", ");
        await interaction.editReply({
          content: `❌ You are active in multiple queues (${list}). Specify the \`gamemode\` option to choose one.`,
        });
        return;
      }
      matchedRow = activeTesterRows[0];
    }

    const queue = matchedRow.queue;
    const gamemode = queue.gamemode as Gamemode;
    const region = regionInput ?? queue.region;

    // Permission check against the resolved gamemode
    const canTest = await isVoluntaryTester(member, interaction.guildId!, gamemode);
    if (!canTest) {
      await interaction.editReply({
        content: `❌ You need the **@Voluntary Tester** and **@${GAMEMODES[gamemode]} Tester** roles to pull testees.`,
      });
      return;
    }

    // Close any existing non-HT3 open ticket for this tester in this gamemode
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

    if (existingTicket.length > 0 && existingTicket[0].type !== "ht3") {
      const channel = (await client.channels
        .fetch(existingTicket[0].channelId)
        .catch(() => null)) as TextChannel | null;
      if (channel) {
        await channel.delete("Tester skipped testee").catch(() => null);
      }
      await db
        .update(tickets)
        .set({ status: "skipped", closedAt: new Date() })
        .where(eq(tickets.id, existingTicket[0].id));
    }

    const testeeId = await popFromQueueWithPriority(queue.id, interaction.guildId!, client);
    if (!testeeId) {
      await interaction.editReply({
        content: "❌ The queue is empty. No one to pull.",
      });
      return;
    }

    const testee = await interaction.guild!.members.fetch(testeeId).catch(() => null);
    if (!testee) {
      await interaction.editReply({
        content: "❌ Could not find the next testee in the server. They may have left.",
      });
      return;
    }

    const ticketChannel = await createTestingTicket({
      guild: interaction.guild!,
      tester: member,
      testee,
      gamemode,
      region,
    });

    if (!ticketChannel) {
      await interaction.editReply({
        content: "❌ Failed to create the testing ticket. Check bot permissions.",
      });
      return;
    }

    await interaction.editReply({
      content: `✅ Pulled <@${testeeId}> from the **${GAMEMODES[gamemode]}** queue. Ticket created: ${ticketChannel}`,
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
