import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  User,
} from "discord.js";
import {
  GAMEMODES,
  TIER_LABELS,
  EMBED_COLORS,
  Gamemode,
  Tier,
} from "./constants";

export function buildRegistrationPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📝 Evaluation Testing Waitlist")
    .setDescription(
      [
        "Upon applying, you will be added to a waitlist channel.",
        "Here you will be pinged when a tester of your region is available.",
        "If you are HT3 or higher, create a high ticket",
        "",
        "**Register Your Profile** 📖",
        "Click Register / Update Profile to set your in-game username, region, and account type before joining any queue.",
        "",
        "**Select a Gamemode** 📜",
        "Click any gamemode button below to receive the corresponding waitlist role. A tester will pick you up when they open a queue.",
        "",
        "**Testing Cooldown** ⏳",
        "Each Gamemode has a 5-day cooldown after each test",
        "",
        "**Validity** 👤",
        "Provide authentic information about your account and testing details",
      ].join("\n")
    )
    .setColor(EMBED_COLORS.primary);
}

export function buildRegistrationPanelRows(): ActionRowBuilder<ButtonBuilder>[] {
  const gamemodeKeys = Object.keys(GAMEMODES) as Gamemode[];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const registerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("register_profile")
      .setLabel("📝 Register / Update Profile")
      .setStyle(ButtonStyle.Primary)
  );
  rows.push(registerRow);

  for (let i = 0; i < gamemodeKeys.length; i += 5) {
    const chunk = gamemodeKeys.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...chunk.map((gm) =>
        new ButtonBuilder()
          .setCustomId(`join_gamemode_${gm}`)
          .setLabel(GAMEMODES[gm])
          .setStyle(ButtonStyle.Secondary)
      )
    );
    rows.push(row);
  }

  return rows;
}

export function buildQueueOpenEmbed(params: {
  gamemode: Gamemode;
  region: string;
  members: Array<{ discordId: string; username?: string }>;
  testers: Array<{ discordId: string; username?: string }>;
}): EmbedBuilder {
  const { gamemode, region, members, testers } = params;

  const memberList =
    members.length > 0
      ? members.map((m, i) => `${i + 1}. <@${m.discordId}>`).join("\n")
      : "*No one in queue yet*";

  const testerList =
    testers.length > 0
      ? testers.map((t, i) => `${i + 1}. <@${t.discordId}>`).join("\n")
      : "*None*";

  return new EmbedBuilder()
    .setTitle("Tester(s) Available!")
    .setDescription(
      [
        "🕐 The queue updates every 1 minute.",
        "Use `/leave` if you wish to be removed from the waitlist or queue.",
        "",
        "**Queue:**",
        memberList,
        "",
        "**Active Testers:**",
        testerList,
      ].join("\n")
    )
    .setColor(EMBED_COLORS.primary)
    .setFooter({
      text: `${GAMEMODES[gamemode]} | ${region} | Updates every 1 min`,
    });
}

export function buildQueueOpenRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("join_queue")
      .setLabel("Join Queue")
      .setStyle(ButtonStyle.Primary)
  );
}

export function buildQueueClosedEmbed(params: {
  gamemode: Gamemode;
  region: string;
  lastSession?: Date | null;
}): EmbedBuilder {
  const { gamemode, region, lastSession } = params;
  const lastSessionText = lastSession
    ? `<t:${Math.floor(lastSession.getTime() / 1000)}:f>`
    : "Never";

  return new EmbedBuilder()
    .setTitle("No Testers Online")
    .setDescription(
      [
        `No testers for your region are available at this time.`,
        `You will be pinged when a tester is available.`,
        `Check back later!`,
        "",
        `Last testing session: ${lastSessionText}`,
      ].join("\n")
    )
    .setColor(EMBED_COLORS.error)
    .setFooter({ text: `${GAMEMODES[gamemode]} | ${region}` });
}

export function buildTicketInfoEmbed(params: {
  testee: GuildMember | User;
  ign: string;
  region: string;
  preferredServer: string;
  isPremium?: boolean | null;
  previousTier?: string | null;
}): EmbedBuilder {
  const { testee, ign, region, preferredServer, isPremium, previousTier } = params;

  const displayName =
    testee instanceof GuildMember ? testee.displayName : testee.username;
  const id = testee instanceof GuildMember ? testee.id : testee.id;
  const accountType = isPremium === false ? "Cracked" : "Premium";

  return new EmbedBuilder()
    .setTitle(`${displayName}'s Information`)
    .setDescription(
      [
        `**User:** <@${id}>`,
        `**Region:** ${region}`,
        `**Server:** ${preferredServer}`,
        `**Username:** ${ign}`,
        `**Account:** ${accountType}`,
        `**Previous Rank:** ${previousTier ?? "Unranked"}`,
      ].join("\n")
    )
    .setColor(EMBED_COLORS.primary)
    .setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`);
}

export function buildTestResultEmbed(params: {
  testeeId: string;
  testerId: string;
  testeeAvatarURL: string;
  ign: string;
  region: string;
  gamemode: Gamemode;
  tier: Tier;
  previousTier?: string | null;
  cooldownDays: number;
}): EmbedBuilder {
  const { testeeId, testerId, testeeAvatarURL, ign, region, gamemode, tier, previousTier, cooldownDays } = params;

  return new EmbedBuilder()
    .setAuthor({
      name: `${ign}'s Test Results`,
      iconURL: testeeAvatarURL,
    })
    .setDescription("🏆")
    .setColor(0xed4245)
    .setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`)
    .addFields(
      { name: "Tester:", value: `<@${testerId}>`, inline: false },
      { name: "Region:", value: region, inline: false },
      { name: "Gamemode:", value: GAMEMODES[gamemode] ?? gamemode, inline: false },
      { name: "Username:", value: ign, inline: false },
      { name: "Previous Rank:", value: previousTier ? TIER_LABELS[previousTier as Tier] ?? previousTier : "Unranked", inline: false },
      { name: "Rank Earned:", value: TIER_LABELS[tier], inline: false }
    );
}

export function buildPlayerDataEmbed(params: {
  player: {
    discordId: string;
    discordUsername: string;
    ign: string;
    region: string;
    preferredServer: string;
    uuid?: string | null;
    isPremium?: boolean | null;
  };
  tiers: Array<{ gamemode: string; tier: string }>;
  cooldowns: Array<{ gamemode: string; expiresAt: Date }>;
  testerStats?: { allTimeTests: number | null; monthlyTests: number | null } | null;
  restriction?: {
    type: string;
    createdAt: Date;
    expiresAt?: Date | null;
    isPermanent: boolean;
  } | null;
  queriedBy?: string;
}): EmbedBuilder {
  const { player, tiers: playerTiers, cooldowns, testerStats, restriction, queriedBy } = params;

  const tierText =
    playerTiers.length > 0
      ? playerTiers
          .map((t) => `**${GAMEMODES[t.gamemode as Gamemode] ?? t.gamemode}:** ${TIER_LABELS[t.tier as Tier] ?? t.tier}`)
          .join("\n")
      : "*No tiers*";

  const cooldownText =
    cooldowns.length > 0
      ? cooldowns
          .map(
            (c) =>
              `**${GAMEMODES[c.gamemode as Gamemode] ?? c.gamemode}:** <t:${Math.floor(c.expiresAt.getTime() / 1000)}:R>`
          )
          .join("\n")
      : "*None*";

  const embed = new EmbedBuilder()
    .setTitle(`Player Data: ${player.ign}`)
    .setColor(EMBED_COLORS.red_border)
    .setThumbnail(`https://visage.surgeplay.com/bust/128/${player.ign}`)
    .addFields(
      {
        name: "\u200B",
        value: `<@${player.discordId}> | ${player.region} | ${player.discordUsername}\n${player.discordId}`,
        inline: false,
      },
      {
        name: "Profile",
        value: [
          `**IGN:** ${player.ign}`,
          `**Region:** ${player.region}`,
          `**Account:** ${player.isPremium === false ? "Cracked" : "Premium"}`,
          player.uuid ? `**UUID:** ${player.uuid}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        inline: false,
      }
    );

  if (testerStats) {
    embed.addFields({
      name: "Tester Statistics",
      value: `**All-Time Tests:** ${testerStats.allTimeTests ?? 0} | **Monthly:** ${testerStats.monthlyTests ?? 0}`,
      inline: false,
    });
  }

  embed.addFields(
    { name: "Ranks", value: tierText, inline: false },
    { name: "Active Cooldowns", value: cooldownText, inline: false }
  );

  if (restriction) {
    const expiresText = restriction.isPermanent
      ? "Never"
      : restriction.expiresAt
      ? `<t:${Math.floor(restriction.expiresAt.getTime() / 1000)}:R>`
      : "Unknown";

    embed.addFields({
      name: "⛔ Active Restriction",
      value: [
        `**Restricted:** <t:${Math.floor(restriction.createdAt.getTime() / 1000)}:f>`,
        `**Expires:** ${expiresText}`,
        `**Shame Role:** @${restriction.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      ].join("\n"),
      inline: false,
    });
  }

  if (queriedBy) {
    embed.setFooter({
      text: `Queried at ${new Date().toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`,
    });
  }

  return embed;
}

export function buildEvalEmbed(): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
} {
  const embed = new EmbedBuilder()
    .setTitle("⚖️ LT3+ Evaluation")
    .setDescription(
      [
        "The testee has performed well enough to qualify for HT3 evaluation.",
        "",
        "**Test for HT3** — The ticket will be transferred to the HT3 testing area. A qualified HT3 player will test the testee. You will be removed from this ticket and can pull another testee.",
        "",
        "**Stay as LT3** — The testee will be ranked as LT3 and the ticket will close normally.",
        "",
        "*Choose wisely — this decision affects the testee's tier.*",
      ].join("\n")
    )
    .setColor(EMBED_COLORS.warning);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("eval_ht3")
      .setLabel("Test for HT3")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("eval_lt3")
      .setLabel("Stay as LT3")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

export function buildAuditLogEmbed(params: {
  command: string;
  user: User | GuildMember;
  channel: string;
  options?: Record<string, string>;
}): EmbedBuilder {
  const { command, user, channel, options } = params;
  const userId = user instanceof GuildMember ? user.id : user.id;
  const username =
    user instanceof GuildMember ? user.displayName : user.username;

  const optionText = options
    ? Object.entries(options)
        .map(([k, v]) => `**${k}:** ${v}`)
        .join("\n")
    : "";

  return new EmbedBuilder()
    .setTitle(`Command Used: /${command}`)
    .addFields(
      { name: "User", value: `<@${userId}> (${username})`, inline: true },
      { name: "Channel", value: `<#${channel}>`, inline: true },
      { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
    )
    .setDescription(optionText || null)
    .setColor(EMBED_COLORS.info)
    .setTimestamp();
}
