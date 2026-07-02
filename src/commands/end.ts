import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
} from "discord.js";
import { db } from "../database";
import { queues, queueTesters, queueMembers, tickets } from "../database/schema";
import { eq, and, ne } from "drizzle-orm";
import { GAMEMODE_KEYS, GAMEMODES, Gamemode } from "../utils/constants";
import { isVoluntaryTester, hasStaffRole } from "../utils/permissions";
import { getOrCreateQueue, updateQueueEmbed } from "../handlers/queue";
import { logCommand } from "../handlers/audit";

export const endCommand = {
  data: new SlashCommandBuilder()
    .setName("end")
    .setDescription("Close the testing queue for a gamemode and region")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("The gamemode queue to close")
        .setRequired(true)
        .addChoices(
          ...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm }))
        )
    )
    .addStringOption((o) =>
      o
        .setName("region")
        .setDescription("The region queue to close")
        .setRequired(true)
        .addChoices(
          { name: "EU/NA", value: "EU/NA" },
          { name: "AS/AU", value: "AS/AU" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    const gamemode = interaction.options.getString("gamemode", true);
    const region = interaction.options.getString("region", true);

    await interaction.deferReply({ ephemeral: true });

    const isRegulatorPlus = await hasStaffRole(member, interaction.guildId!, "regulator");

    // Regulator+ always force-closes the queue regardless of tester count
    if (isRegulatorPlus) {
      const queue = await getOrCreateQueue(gamemode, region);

      const activeTesters = await db
        .select()
        .from(queueTesters)
        .where(eq(queueTesters.queueId, queue.id));

      await db.delete(queueTesters).where(eq(queueTesters.queueId, queue.id));
      await db.delete(queueMembers).where(eq(queueMembers.queueId, queue.id));
      await db
        .update(queues)
        .set({ isActive: false, lastSessionEnd: new Date(), updatedAt: new Date() })
        .where(eq(queues.id, queue.id));

      const closedQueue = { ...queue, isActive: false, lastSessionEnd: new Date() };
      await updateQueueEmbed(client, closedQueue as typeof queue);

      const openTickets = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.guildId, interaction.guildId!),
            eq(tickets.gamemode, gamemode),
            eq(tickets.region, region),
            eq(tickets.status, "open"),
            ne(tickets.type, "ht3")
          )
        );

      let deletedTickets = 0;
      for (const ticket of openTickets) {
        const ch = (await client.channels.fetch(ticket.channelId).catch(() => null)) as TextChannel | null;
        if (ch) { await ch.delete("Queue force-closed by Regulator+").catch(() => null); deletedTickets++; }
        await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.id, ticket.id));
      }

      await interaction.editReply({
        content: `✅ Force-closed the **${GAMEMODES[gamemode as Gamemode]}** (${region}) queue.${activeTesters.length > 0 ? ` Removed ${activeTesters.length} tester(s).` : ""} All members cleared.${deletedTickets > 0 ? `\n🗑️ ${deletedTickets} waitlist ticket(s) were also deleted.` : ""}`,
      });

      await logCommand(client, {
        command: "end",
        user: member,
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        options: { gamemode, region, forceClose: "true", testersRemoved: String(activeTesters.length) },
      });
      return;
    }

    // Non-regulator path — must have tester roles
    const canTest = await isVoluntaryTester(member, interaction.guildId!, gamemode);
    if (!canTest) {
      await interaction.editReply({
        content: `❌ You need the **@Voluntary Tester** and **@${GAMEMODES[gamemode as Gamemode]} Tester** roles to close a queue.`,
      });
      return;
    }

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
        content: "❌ You are not an active tester in this queue.",
      });
      return;
    }

    // Remove this tester from the pool
    await db
      .delete(queueTesters)
      .where(
        and(
          eq(queueTesters.queueId, queue.id),
          eq(queueTesters.discordId, member.id)
        )
      );

    const remainingTesters = await db
      .select()
      .from(queueTesters)
      .where(eq(queueTesters.queueId, queue.id));

    if (remainingTesters.length === 0) {
      await db
        .delete(queueMembers)
        .where(eq(queueMembers.queueId, queue.id));

      await db
        .update(queues)
        .set({ isActive: false, lastSessionEnd: new Date(), updatedAt: new Date() })
        .where(eq(queues.id, queue.id));

      const closedQueue = { ...queue, isActive: false, lastSessionEnd: new Date() };
      await updateQueueEmbed(client, closedQueue as typeof queue);

      const openTickets = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.guildId, interaction.guildId!),
            eq(tickets.gamemode, gamemode),
            eq(tickets.region, region),
            eq(tickets.status, "open"),
            ne(tickets.type, "ht3")
          )
        );

      let deletedTickets = 0;
      for (const ticket of openTickets) {
        const ch = (await client.channels.fetch(ticket.channelId).catch(() => null)) as TextChannel | null;
        if (ch) { await ch.delete("Queue closed").catch(() => null); deletedTickets++; }
        await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.id, ticket.id));
      }

      await interaction.editReply({
        content: `✅ Queue for **${GAMEMODES[gamemode as Gamemode]}** (${region}) has been closed. All members cleared.${deletedTickets > 0 ? `\n🗑️ ${deletedTickets} waitlist ticket(s) were also deleted.` : ""}`,
      });
    } else {
      await interaction.editReply({
        content: `✅ You have left the tester pool. ${remainingTesters.length} tester(s) still active — queue remains open.`,
      });
    }

    await logCommand(client, {
      command: "end",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { gamemode, region },
    });
  },
};
