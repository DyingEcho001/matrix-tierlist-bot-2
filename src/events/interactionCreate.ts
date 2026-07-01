import {
  Client,
  Events,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  GuildMember,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { commands } from "../commands";
import { db } from "../database";
import {
  players,
  queueMembers,
  queueTesters,
  tickets,
  gamemodeRoles,
  cooldowns,
  categoryConfig,
  staffRoles as staffRolesTable,
} from "../database/schema";
import { eq, and, sql } from "drizzle-orm";
import { getOrCreateQueue, addToQueue, popFromQueueWithPriority } from "../handlers/queue";
import { getTicketByChannel, closeTicket, incrementTesterStats, createTestingTicket } from "../handlers/ticket";
import { GAMEMODES, GAMEMODE_KEYS, Gamemode, Tier } from "../utils/constants";
import { hasCommandBypass } from "../utils/permissions";
import { getPendingPull, deletePendingPull } from "../handlers/pending-pull";

const buttonRateLimit = new Map<string, number>();
const BUTTON_COOLDOWN_MS = 3000;

function isRateLimited(userId: string, action: string): boolean {
  const key = `${userId}:${action}`;
  const last = buttonRateLimit.get(key) ?? 0;
  const now = Date.now();
  if (now - last < BUTTON_COOLDOWN_MS) return true;
  buttonRateLimit.set(key, now);
  if (buttonRateLimit.size > 5000) {
    const oldest = [...buttonRateLimit.entries()].sort((a, b) => a[1] - b[1]).slice(0, 1000);
    for (const [k] of oldest) buttonRateLimit.delete(k);
  }
  return false;
}

export function registerInteractionEvent(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.guildId) return;

    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`Error executing /${interaction.commandName}:`, err);
        const msg = { content: "❌ An error occurred while running this command.", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => null);
        } else {
          await interaction.reply(msg).catch(() => null);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        await handleButtonInteraction(interaction as ButtonInteraction, client);
      } catch (err) {
        console.error(`Error handling button ${(interaction as ButtonInteraction).customId}:`, err);
        const btn = interaction as ButtonInteraction;
        const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
        if (btn.replied || btn.deferred) {
          await btn.followUp(msg).catch(() => null);
        } else {
          await btn.reply(msg).catch(() => null);
        }
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectMenuInteraction(interaction as StringSelectMenuInteraction, client);
      } catch (err) {
        console.error(`Error handling select menu ${(interaction as StringSelectMenuInteraction).customId}:`, err);
        const sel = interaction as StringSelectMenuInteraction;
        const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
        if (sel.replied || sel.deferred) {
          await sel.followUp(msg).catch(() => null);
        } else {
          await sel.reply(msg).catch(() => null);
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      try {
        await handleModalSubmit(interaction as ModalSubmitInteraction, client);
      } catch (err) {
        console.error(`Error handling modal ${(interaction as ModalSubmitInteraction).customId}:`, err);
        const modal = interaction as ModalSubmitInteraction;
        const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
        if (modal.replied || modal.deferred) {
          await modal.followUp(msg).catch(() => null);
        } else {
          await modal.reply(msg).catch(() => null);
        }
      }
      return;
    }
  });
}

async function handleButtonInteraction(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const { customId } = interaction;

  if (customId === "register_profile") {
    if (isRateLimited(interaction.user.id, "register_profile")) {
      await interaction.reply({ content: "❌ Please wait a moment before doing that again.", ephemeral: true });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId("register_modal")
      .setTitle("Register Your Profile");

    const ignInput = new TextInputBuilder()
      .setCustomId("ign")
      .setLabel("Your In-Game Name (IGN)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. Notch")
      .setRequired(true);

    const regionInput = new TextInputBuilder()
      .setCustomId("region")
      .setLabel("Your Region (EU/NA or AS/AU)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("EU/NA or AS/AU")
      .setRequired(true);

    const serverInput = new TextInputBuilder()
      .setCustomId("preferred_server")
      .setLabel("Your Preferred PvP Server")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. Hypixel, CatPvP, Minemen")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(ignInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(regionInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (customId.startsWith("join_gamemode_")) {
    if (isRateLimited(interaction.user.id, "join_gamemode")) {
      await interaction.reply({ content: "❌ Please wait a moment before doing that again.", ephemeral: true });
      return;
    }
    const rawGamemode = customId.replace("join_gamemode_", "");
    if (!GAMEMODE_KEYS.includes(rawGamemode as Gamemode)) {
      await interaction.reply({ content: "❌ Invalid gamemode.", ephemeral: true });
      return;
    }
    const gamemode = rawGamemode as Gamemode;
    const member = interaction.member as GuildMember;

    const playerData = await db
      .select()
      .from(players)
      .where(eq(players.discordId, member.id))
      .limit(1);

    if (!playerData[0]) {
      const notRegisteredEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("❌ Profile Required")
        .setDescription(
          "You need to register your profile before joining any waitlist.\n\nClick **Register / Update Profile** in this panel to set up your IGN, region, and account type."
        )
        .setFooter({ text: "Matrix Tierlist" });
      await interaction.reply({ embeds: [notRegisteredEmbed], ephemeral: true });
      return;
    }

    const playerRegion = playerData[0].region;

    const gamemodeRoleRow = await db
      .select()
      .from(gamemodeRoles)
      .where(
        and(
          eq(gamemodeRoles.guildId, interaction.guildId!),
          eq(gamemodeRoles.gamemode, gamemode),
          eq(gamemodeRoles.region, playerRegion)
        )
      )
      .limit(1);

    if (!gamemodeRoleRow[0]) {
      await interaction.reply({
        content: `❌ No waitlist role configured for **${GAMEMODES[gamemode] ?? gamemode}** (${playerRegion}) yet. Ask an admin to set one up with \`/waitlist-role-set\`.`,
        ephemeral: true,
      });
      return;
    }

    const roleId = gamemodeRoleRow[0].roleId;

    // If the user already has the role, allow them to remove it (leave waitlist)
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, "Left gamemode waitlist");
      const leaveEmbed = new EmbedBuilder()
        .setTitle("👋 Left Waitlist")
        .setColor(0x95a5a6)
        .setDescription(`You have been removed from the **${GAMEMODES[gamemode]}** (${playerRegion}) waitlist.`)
        .setFooter({ text: "Matrix Tierlist" })
        .setTimestamp();
      await interaction.reply({ embeds: [leaveEmbed], ephemeral: true });
      return;
    }

    // Check for active cooldown before allowing them to re-join the waitlist
    const now = new Date();
    const activeCooldown = await db
      .select()
      .from(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, member.id),
          eq(cooldowns.gamemode, gamemode)
        )
      )
      .limit(1);

    if (activeCooldown[0] && activeCooldown[0].expiresAt > now) {
      const expiryUnix = Math.floor(activeCooldown[0].expiresAt.getTime() / 1000);
      await interaction.reply({
        content: `⏳ You are on a cooldown for **${GAMEMODES[gamemode]}**.\nYou can rejoin the waitlist <t:${expiryUnix}:R> — on <t:${expiryUnix}:D>.`,
        ephemeral: true,
      });
      return;
    }

    await member.roles.add(roleId, "Joined gamemode waitlist");
    const joinEmbed = new EmbedBuilder()
      .setTitle("✅ Waitlist Role Granted")
      .setColor(0x6C3483)
      .setDescription(`You now have the **${GAMEMODES[gamemode]}** (${playerRegion}) waitlist role.\nYou'll be pinged when a tester is available!`)
      .setFooter({ text: "Matrix Tierlist" })
      .setTimestamp();
    await interaction.reply({ embeds: [joinEmbed], ephemeral: true });
    return;
  }

  if (customId === "join_queue") {
    if (isRateLimited(interaction.user.id, "join_queue")) {
      await interaction.reply({ content: "❌ Please wait a moment before doing that again.", ephemeral: true });
      return;
    }
    const member = interaction.member as GuildMember;

    const playerData = await db
      .select()
      .from(players)
      .where(eq(players.discordId, member.id))
      .limit(1);

    if (!playerData[0]) {
      await interaction.reply({
        content: "❌ You need to register your profile first. Click **Register / Update Profile**.",
        ephemeral: true,
      });
      return;
    }

    const message = interaction.message;
    const embed = message.embeds[0];
    if (!embed?.footer?.text) {
      await interaction.reply({
        content: "❌ Could not determine queue info from this message.",
        ephemeral: true,
      });
      return;
    }

    const footerParts = embed.footer.text.split(" | ");
    const gamemodeName = footerParts[0];
    const region = footerParts[1];

    const gamemodeEntry = Object.entries(GAMEMODES).find(
      ([, v]) => v === gamemodeName
    );
    if (!gamemodeEntry) {
      await interaction.reply({
        content: "❌ Could not determine the gamemode for this queue.",
        ephemeral: true,
      });
      return;
    }
    const gamemode = gamemodeEntry[0] as Gamemode;

    const queue = await getOrCreateQueue(gamemode, region);

    const isBypass = await hasCommandBypass(member.id, interaction.guildId!);

    if (!isBypass) {
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

      if (isTester.length > 0) {
        await interaction.reply({
          content: "❌ You cannot join a queue you are currently hosting as a tester.",
          ephemeral: true,
        });
        return;
      }
    }

    const alreadyIn = await db
      .select()
      .from(queueMembers)
      .where(
        and(
          eq(queueMembers.queueId, queue.id),
          eq(queueMembers.discordId, member.id)
        )
      )
      .limit(1);

    if (alreadyIn.length > 0) {
      await interaction.reply({
        content: "❌ You are already in this queue.",
        ephemeral: true,
      });
      return;
    }

    const now = new Date();
    const activeCooldown = await db
      .select()
      .from(cooldowns)
      .where(
        and(
          eq(cooldowns.discordId, member.id),
          eq(cooldowns.gamemode, gamemode)
        )
      )
      .limit(1);

    if (activeCooldown[0] && activeCooldown[0].expiresAt > now) {
      await interaction.reply({
        content: `❌ You have an active cooldown for **${GAMEMODES[gamemode]}**. It expires <t:${Math.floor(activeCooldown[0].expiresAt.getTime() / 1000)}:R>.`,
        ephemeral: true,
      });
      return;
    }

    const position = await addToQueue(queue.id, member.id);

    await interaction.reply({
      content: `✅ You have joined the **${GAMEMODES[gamemode]}** (${region}) queue at position **#${position}**.`,
      ephemeral: true,
    });
    return;
  }

  if (customId === "eval_ht3") {
    await handleEvalHT3(interaction, client);
    return;
  }

  if (customId === "eval_lt3") {
    await handleEvalLT3(interaction, client);
    return;
  }

  if (customId === "pull_close_and_pull_new") {
    await handlePullCloseAndPullNew(interaction, client);
    return;
  }

  if (customId === "pull_cancel") {
    deletePendingPull(interaction.user.id);
    await interaction.update({ content: "Cancelled.", components: [] });
    return;
  }

  if (customId.startsWith("close_confirm:")) {
    await handleCloseConfirm(interaction, client);
    return;
  }
}

async function handleEvalHT3(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const member = interaction.member as GuildMember;

  const ticket = await getTicketByChannel(interaction.channelId);
  const isBypass = await hasCommandBypass(member.id, interaction.guildId!);
  if (!ticket || (ticket.testeeId !== member.id && !isBypass)) {
    await interaction.reply({
      content: "❌ Only the testee can use this button.",
      ephemeral: true,
    });
    return;
  }

  const ht3CategoryRow = await db
    .select()
    .from(categoryConfig)
    .where(
      and(
        eq(categoryConfig.guildId, interaction.guildId!),
        eq(categoryConfig.configKey, "ht3_category")
      )
    )
    .limit(1);

  const channel = interaction.channel as TextChannel;

  await channel.permissionOverwrites.edit(member.id, {
    ViewChannel: false,
  });

  if (ht3CategoryRow[0]) {
    await channel.setParent(ht3CategoryRow[0].categoryId, {
      lockPermissions: false,
    });
  }

  const allStaffRoleRows = await db
    .select()
    .from(staffRolesTable)
    .where(eq(staffRolesTable.guildId, interaction.guildId!));

  for (const row of allStaffRoleRows) {
    await channel.permissionOverwrites.edit(row.roleId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    }).catch(() => null);
  }

  await db
    .update(tickets)
    .set({ type: "ht3", isEvalPending: true })
    .where(eq(tickets.id, ticket.id));

  await interaction.reply({
    content: `✅ Ticket transferred to HT3 testing. <@${ticket.testerId}>, you are free to pull another testee.\n\nStaff: use \`/pass-eval\` or \`/fail-eval\` in this channel after testing.`,
  });
}

async function handleEvalLT3(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const member = interaction.member as GuildMember;

  const ticket = await getTicketByChannel(interaction.channelId);
  const isBypass = await hasCommandBypass(member.id, interaction.guildId!);
  if (!ticket || (ticket.testeeId !== member.id && !isBypass)) {
    await interaction.reply({
      content: "❌ Only the testee can use this button.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `Closing ticket — ranking <@${ticket.testeeId}> as **LT3**...`,
  });

  const { closeTicket, incrementTesterStats } = await import("../handlers/ticket");
  await incrementTesterStats(ticket.testerId);
  await closeTicket({ client, ticket, tier: "LT3", closedBy: member.id });
}

async function handlePullCloseAndPullNew(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const member = interaction.member as GuildMember;
  const pending = getPendingPull(member.id);

  if (!pending) {
    await interaction.update({ content: "❌ No pending pull found. Please run `/pull` again.", components: [] });
    return;
  }

  deletePendingPull(member.id);

  await interaction.update({ content: "⏳ Closing old ticket and pulling a new user...", components: [] });

  // Close the existing ticket
  const existingChannel = (await client.channels
    .fetch(pending.existingChannelId)
    .catch(() => null)) as TextChannel | null;
  if (existingChannel) {
    await existingChannel.delete("Tester closed and pulled new").catch(() => null);
  }
  await db
    .update(tickets)
    .set({ status: "skipped", closedAt: new Date() })
    .where(eq(tickets.id, pending.existingTicketId));

  // Pull next from queue
  const testeeId = await popFromQueueWithPriority(pending.queueId, pending.guildId, client);
  if (!testeeId) {
    await interaction.editReply({ content: "❌ The queue is empty. No one to pull." });
    return;
  }

  const guild = await client.guilds.fetch(pending.guildId).catch(() => null);
  if (!guild) {
    await interaction.editReply({ content: "❌ Could not resolve the server." });
    return;
  }

  const testee = await guild.members.fetch(testeeId).catch(() => null);
  if (!testee) {
    await interaction.editReply({ content: "❌ Could not find the next testee in the server. They may have left." });
    return;
  }

  const ticketChannel = await createTestingTicket({
    guild,
    tester: member,
    testee,
    gamemode: pending.gamemode,
    region: pending.region,
  });

  if (!ticketChannel) {
    await interaction.editReply({ content: "❌ Failed to create the testing ticket. Check bot permissions." });
    return;
  }

  await interaction.editReply({
    content: `✅ Pulled <@${testeeId}> from the **${GAMEMODES[pending.gamemode]}** queue. Ticket created: ${ticketChannel}`,
  });
}

async function handleCloseConfirm(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const member = interaction.member as GuildMember;
  const tier = interaction.customId.replace("close_confirm:", "") as Tier;

  const ticket = await getTicketByChannel(interaction.channelId);

  if (!ticket) {
    await interaction.update({ content: "❌ Could not find the ticket for this channel.", embeds: [], components: [] });
    return;
  }

  if (ticket.testerId !== member.id) {
    await interaction.reply({ content: "❌ Only the tester who opened this ticket can confirm closing it.", ephemeral: true });
    return;
  }

  await interaction.update({
    content: `✅ Closing ticket and assigning **${tier}** to <@${ticket.testeeId}>...`,
    embeds: [],
    components: [],
  });

  await incrementTesterStats(member.id);

  await closeTicket({
    client,
    ticket,
    tier,
    closedBy: member.id,
  });
}

async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  client: Client
): Promise<void> {
  if (interaction.customId !== "select_gamemode_waitlist") return;

  if (isRateLimited(interaction.user.id, "join_gamemode")) {
    await interaction.reply({ content: "❌ Please wait a moment before doing that again.", ephemeral: true });
    return;
  }

  const rawGamemode = interaction.values[0];
  if (!GAMEMODE_KEYS.includes(rawGamemode as Gamemode)) {
    await interaction.reply({ content: "❌ Invalid gamemode.", ephemeral: true });
    return;
  }
  const gamemode = rawGamemode as Gamemode;
  const member = interaction.member as GuildMember;

  const playerData = await db
    .select()
    .from(players)
    .where(eq(players.discordId, member.id))
    .limit(1);

  if (!playerData[0]) {
    const notRegisteredEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("❌ Profile Required")
      .setDescription(
        "You need to register your profile before joining any waitlist.\n\nClick **Register / Update Profile** in this panel to set up your IGN, region, and account type."
      )
      .setFooter({ text: "Matrix Tierlist" });
    await interaction.reply({ embeds: [notRegisteredEmbed], ephemeral: true });
    return;
  }

  const playerRegion = playerData[0].region;

  const gamemodeRoleRow = await db
    .select()
    .from(gamemodeRoles)
    .where(
      and(
        eq(gamemodeRoles.guildId, interaction.guildId!),
        eq(gamemodeRoles.gamemode, gamemode),
        eq(gamemodeRoles.region, playerRegion)
      )
    )
    .limit(1);

  if (!gamemodeRoleRow[0]) {
    await interaction.reply({
      content: `❌ No waitlist role configured for **${GAMEMODES[gamemode] ?? gamemode}** (${playerRegion}) yet. Ask an admin to set one up with \`/waitlist-role-set\`.`,
      ephemeral: true,
    });
    return;
  }

  const roleId = gamemodeRoleRow[0].roleId;

  // If the user already has the role, remove it (leave waitlist)
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId, "Left gamemode waitlist");
    const leaveEmbed = new EmbedBuilder()
      .setTitle("👋 Left Waitlist")
      .setColor(0x95a5a6)
      .setDescription(`You have been removed from the **${GAMEMODES[gamemode]}** (${playerRegion}) waitlist.`)
      .setFooter({ text: "Matrix Tierlist" })
      .setTimestamp();
    await interaction.reply({ embeds: [leaveEmbed], ephemeral: true });
    return;
  }

  // Check for active cooldown
  const now = new Date();
  const activeCooldown = await db
    .select()
    .from(cooldowns)
    .where(
      and(
        eq(cooldowns.discordId, member.id),
        eq(cooldowns.gamemode, gamemode)
      )
    )
    .limit(1);

  if (activeCooldown[0] && activeCooldown[0].expiresAt > now) {
    const expiryUnix = Math.floor(activeCooldown[0].expiresAt.getTime() / 1000);
    await interaction.reply({
      content: `⏳ You are on a cooldown for **${GAMEMODES[gamemode]}**.\nYou can rejoin the waitlist <t:${expiryUnix}:R> — on <t:${expiryUnix}:D>.`,
      ephemeral: true,
    });
    return;
  }

  await member.roles.add(roleId, "Joined gamemode waitlist");
  const joinEmbed = new EmbedBuilder()
    .setTitle("✅ Waitlist Role Granted")
    .setColor(0x6C3483)
    .setDescription(`You now have the **${GAMEMODES[gamemode]}** (${playerRegion}) waitlist role.\nYou'll be pinged when a tester is available!`)
    .setFooter({ text: "Matrix Tierlist" })
    .setTimestamp();
  await interaction.reply({ embeds: [joinEmbed], ephemeral: true });
}

async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  if (interaction.customId === "register_modal") {
    const ign = interaction.fields.getTextInputValue("ign").trim();

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(ign)) {
      await interaction.reply({
        content: "❌ Invalid IGN. Minecraft usernames must be **3–16 characters** and can only contain **letters, numbers, and underscores**.",
        ephemeral: true,
      });
      return;
    }

    const preferredServer = interaction.fields
      .getTextInputValue("preferred_server")
      .trim()
      .slice(0, 100);

    const regionRaw = interaction.fields
      .getTextInputValue("region")
      .trim()
      .toUpperCase()
      .replace(" ", "/");

    const normalizedRegion =
      regionRaw === "EU/NA" || regionRaw === "EUNA" || regionRaw === "EU" || regionRaw === "NA"
        ? "EU/NA"
        : regionRaw === "AS/AU" || regionRaw === "ASAU" || regionRaw === "AS" || regionRaw === "AU"
        ? "AS/AU"
        : null;

    if (!normalizedRegion) {
      await interaction.reply({
        content: `❌ Invalid region **"${regionRaw}"**. Please enter **EU/NA** or **AS/AU**.`,
        ephemeral: true,
      });
      return;
    }

    const takenByOther = await db
      .select()
      .from(players)
      .where(sql`LOWER(${players.ign}) = LOWER(${ign})`)
      .limit(1);

    if (takenByOther[0] && takenByOther[0].discordId !== interaction.user.id) {
      const takenEmbed = new EmbedBuilder()
        .setTitle("❌ IGN Already Taken")
        .setColor(0xe74c3c)
        .setDescription(`The IGN **${ign}** is already registered by <@${takenByOther[0].discordId}>.\n\nPlease use a different IGN or contact staff if you believe this is an error.`)
        .setFooter({ text: "Matrix Tierlist" })
        .setTimestamp();

      await interaction.reply({ embeds: [takenEmbed], ephemeral: true });
      return;
    }

    await db
      .insert(players)
      .values({
        discordId: interaction.user.id,
        discordUsername: interaction.user.username,
        ign,
        region: normalizedRegion,
        preferredServer,
      })
      .onConflictDoUpdate({
        target: [players.discordId],
        set: {
          discordUsername: interaction.user.username,
          ign,
          region: normalizedRegion,
          preferredServer,
          updatedAt: new Date(),
        },
      });

    const registrationEmbed = new EmbedBuilder()
      .setTitle("✅ Profile Registered!")
      .setColor(0x6C3483)
      .setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`)
      .addFields(
        { name: "IGN", value: ign, inline: true },
        { name: "Region", value: normalizedRegion, inline: true },
        { name: "Preferred Server", value: preferredServer, inline: true },
      )
      .setDescription("You can now join a queue by clicking a gamemode button.")
      .setFooter({ text: "Matrix Tierlist" })
      .setTimestamp();

    await interaction.reply({ embeds: [registrationEmbed], ephemeral: true });
  }
}
