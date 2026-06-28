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
  TIER_ORDER,
  EMBED_COLORS,
  Gamemode,
  Tier,
  GAMEMODE_EMOJIS,
  GAMEMODE_BUTTON_EMOJIS,
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

function makeButtonEmoji(gm: Gamemode): { id: string; name: string } | { name: string } | undefined {
  const e = GAMEMODE_BUTTON_EMOJIS[gm];
  if (typeof e === "string") {
    return { name: e };
  }
  if (e && typeof e === "object" && "id" in e && e.id) {
    return { id: e.id, name: e.name };
  }
  return undefined;
}

export function buildRegistrationPanelRows(skipGamemodeEmoji = false): ActionRowBuilder<ButtonBuilder>[] {
  const gamemodeKeys = Object.keys(GAMEMODES) as Gamemode[];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const registerBtn = new ButtonBuilder()
    .setCustomId("register_profile")
    .setLabel("Register / Update Profile")
    .setStyle(ButtonStyle.Danger)
    .setEmoji({ id: "1475200135108628523", name: "BOOK_QUILL" });

  const registerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(registerBtn);
  rows.push(registerRow);

  for (let i = 0; i < gamemodeKeys.length; i += 5) {
    const chunk = gamemodeKeys.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...chunk.map((gm) => {
        const btn = new ButtonBuilder()
          .setCustomId(`join_gamemode_${gm}`)
          .setLabel(GAMEMODES[gm])
          .setStyle(ButtonStyle.Secondary);
        if (!skipGamemodeEmoji) {
          const emoji = makeButtonEmoji(gm);
          if (emoji) btn.setEmoji(emoji);
        }
        return btn;
      })
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
  activeTests: Array<{ testeeId: string; testerId: string }>;
}): EmbedBuilder {
  const { gamemode, region, members, testers, activeTests } = params;

  const memberList =
    members.length > 0
      ? members.map((m, i) => `${i + 1}. <@${m.discordId}>`).join("\n")
      : "*No one in queue yet*";

  const testerList =
    testers.length > 0
      ? testers.map((t, i) => `${i + 1}. <@${t.discordId}>`).join("\n")
      : "*None*";

  const activeTestList =
    activeTests.length > 0
      ? activeTests
          .map((t) => `<@${t.testeeId}> is being tested by <@${t.testerId}>`)
          .join("\n")
      : "*None*";

  const gamemodeName = GAMEMODES[gamemode];
  const gamemodeEmoji = GAMEMODE_EMOJIS[gamemode] ?? "";

  return new EmbedBuilder()
    .setTitle(`${gamemodeEmoji} ${gamemodeName} Queue — Tester(s) Available!`)
    .setDescription(
      [
        "The queue updates every 10 seconds.",
        "Use `/leave` if you wish to be removed from the waitlist or queue.",
        "",
        "**Queue:**",
        memberList,
        "",
        "**Active Testers:**",
        testerList,
        ...(activeTests.length > 0
          ? ["", "**Active Tests:**", activeTestList]
          : []),
      ].join("\n")
    )
    .setColor(EMBED_COLORS.primary)
    .setFooter({
      text: `${gamemodeName} | ${region} | Matrix tierlist Dev - DyingEcho`,
    })
    .setTimestamp();
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
  const gamemodeName = GAMEMODES[gamemode];
  const gamemodeEmoji = GAMEMODE_EMOJIS[gamemode] ?? "";

  const lastSessionText = lastSession
    ? `<t:${Math.floor(lastSession.getTime() / 1000)}:f>`
    : "Never";

  return new EmbedBuilder()
    .setTitle(`${gamemodeEmoji} ${gamemodeName} Queue Is Now Closed`)
    .setDescription(
      [
        `No ${gamemodeName} Tester Currently Online <:Tester:1512790870775300227>`,
        "",
        "This queue has been closed. You will be notified when a new queue is opened",
        "",
        "**Session Ended**",
        lastSessionText,
      ].join("\n")
    )
    .setColor(EMBED_COLORS.error)
    .setFooter({ text: `${gamemodeName} | ${region} | Matrix tierlist Dev - DyingEcho` })
    .setTimestamp();
}

export function buildTicketInfoEmbed(params: {
  testee: GuildMember | User;
  tester: GuildMember | User;
  gamemode: string;
  ign: string;
  region: string;
  preferredServer: string;
  isPremium?: boolean | null;
  previousTier?: string | null;
}): EmbedBuilder {
  const { testee, tester, gamemode, ign, region, isPremium } = params;

  const testeeId = testee instanceof GuildMember ? testee.id : testee.id;
  const testerId = tester instanceof GuildMember ? tester.id : tester.id;
  const accountType = isPremium === false ? "Cracked" : "Premium";

  const gamemodeName =
    GAMEMODES[gamemode as Gamemode] ?? gamemode;

  return new EmbedBuilder()
    .setTitle("Tier Testing Session")
    .setDescription("Tier Testing Session started. Have a good time testing in Matrix Tierlist")
    .setColor(EMBED_COLORS.primary)
    .addFields(
      { name: "Player", value: `<@${testeeId}>`, inline: true },
      { name: "Username", value: ign, inline: true },
      { name: "Gamemode", value: gamemodeName, inline: true },
      { name: "Region", value: region, inline: true },
      { name: "Account Type", value: accountType, inline: true },
      { name: "Tester", value: `<@${testerId}>`, inline: true },
    )
    .setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`)
    .setFooter({ text: "Matrix tierlist Dev - DyingEcho" })
    .setTimestamp();
}

function getResultColor(tier: Tier): number {
  const order = TIER_ORDER[tier];
  if (order >= TIER_ORDER["LT3"]) return 0x9B59B6;  // Purple: LT3 and above
  return 0x95A5A6;                                    // Grey: HT4 and below
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
  isHt3Eval?: boolean;
  ht3Passed?: boolean;
}): EmbedBuilder {
  const { testeeId, testerId, testeeAvatarURL, ign, region, gamemode, tier, previousTier, cooldownDays, isHt3Eval, ht3Passed } = params;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${ign}'s Test Results`,
      iconURL: testeeAvatarURL,
    })
    .setDescription("🏆")
    .setColor(getResultColor(tier))
    .setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`)
    .addFields(
      { name: "Tester:", value: `<@${testerId}>`, inline: false },
      { name: "Region:", value: region, inline: false },
      { name: "Gamemode:", value: GAMEMODES[gamemode] ?? gamemode, inline: false },
      { name: "Username:", value: ign, inline: false },
      { name: "Previous Rank:", value: previousTier ? TIER_LABELS[previousTier as Tier] ?? previousTier : "Unranked", inline: false },
      { name: "Rank Earned:", value: TIER_LABELS[tier], inline: false }
    );

  if (isHt3Eval) {
    embed.addFields({
      name: "HT3 Evaluation:",
      value: ht3Passed ? "✅ Passed" : "❌ Failed",
      inline: false,
    });
  }

  return embed;
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
    reason?: string | null;
  } | null;
  queriedBy?: string;
}): EmbedBuilder {
  const { player, tiers: playerTiers, cooldowns, testerStats, restriction } = params;

  const tierText =
    playerTiers.length > 0
      ? playerTiers
          .map((t) => `${GAMEMODES[t.gamemode as Gamemode] ?? t.gamemode}: ${TIER_LABELS[t.tier as Tier] ?? t.tier}`)
          .join("\n")
      : "*No tiers*";

  const cooldownText =
    cooldowns.length > 0
      ? cooldowns
          .map(
            (c) =>
              `${GAMEMODES[c.gamemode as Gamemode] ?? c.gamemode}: <t:${Math.floor(c.expiresAt.getTime() / 1000)}:R>`
          )
          .join("\n")
      : "*None*";

  const profileLines = [
    `**IGN:** ${player.ign}`,
    `**Region:** ${player.region}`,
    `**Account:** ${player.isPremium === false ? "Cracked" : "Premium"}`,
  ];
  if (player.uuid) profileLines.push(`**UUID:** ${player.uuid}`);

  const embed = new EmbedBuilder()
    .setTitle(`Player Data: ${player.ign}`)
    .setColor(0xed4245)
    .setDescription(
      `<@${player.discordId}> | ${player.region} | ${player.discordUsername} |\n${player.discordId}`
    )
    .setThumbnail(`https://visage.surgeplay.com/bust/128/${player.ign}`)
    .addFields(
      {
        name: "Profile",
        value: profileLines.join("\n"),
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

    const typeName = restriction.type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const restrictionLines = [
      `**Restricted:** <t:${Math.floor(restriction.createdAt.getTime() / 1000)}:f>`,
      `**Expires:** ${expiresText}`,
      `**Reason:** ${restriction.reason && restriction.reason !== "manual" ? restriction.reason : "manual"}`,
      `**Shame Role:** ${typeName}`,
    ];
    embed.addFields({
      name: "Active Restriction",
      value: restrictionLines.join("\n"),
      inline: false,
    });
  }

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

  return embed;
}

export function buildEvalEmbed(params: {
  testeeId: string;
  gamemode: Gamemode;
  region: string;
}): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
} {
  const { testeeId, gamemode, region } = params;
  const gamemodeName = GAMEMODES[gamemode] ?? gamemode;

  const embed = new EmbedBuilder()
    .setTitle("⚖️ Evaluation Result")
    .setColor(0x6C3483)
    .setDescription(
      [
        `**User:** <@${testeeId}>`,
        `**Gamemode:** ${gamemodeName}`,
        `**Region:** ${region}`,
        "",
        "**Choose an option below:**",
        "",
        "🟢 **Choose LT3** — Rank as Low Tier 3 with a 5-day cooldown.",
        "🔵 **Go for HT3** — Transfer to HT3 Tests for further evaluation.",
      ].join("\n")
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("eval_lt3")
      .setLabel("Choose LT3")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("eval_ht3")
      .setLabel("Go for HT3")
      .setStyle(ButtonStyle.Primary)
  );

  return { embed, row };
}

export function buildPullConfirmEmbed(channelId: string): {
  content: string;
  row: ActionRowBuilder<ButtonBuilder>;
} {
  const content = `⚠️ You already have an active ticket open (<#${channelId}>).\nDo you want to **close it** and pull a new user instead?`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("pull_close_and_pull_new")
      .setLabel("Close & Pull New")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("pull_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );

  return { content, row };
}

export function buildCloseConfirmEmbed(gamemode: Gamemode, tier: string): {
  content: string;
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
} {
  const gamemodeName = GAMEMODES[gamemode] ?? gamemode;

  const content = "Please confirm you want to close this ticket and apply the rank.";

  const embed = new EmbedBuilder()
    .setTitle("Close Ticket Confirmation")
    .setDescription(
      `Are you sure you want to close this ticket for the **${gamemodeName}** queue and assign rank\n**${tier}**?`
    )
    .setColor(0x2B2D31);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`close_confirm:${tier}`)
      .setLabel("Confirm Close")
      .setStyle(ButtonStyle.Danger)
  );

  return { content, embed, row };
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

export function buildRoleActionEmbed(params: {
  action: "add" | "remove";
  roleId: string;
  targetUserId: string;
  moderatorId: string;
}): EmbedBuilder {
  const { action, roleId, targetUserId, moderatorId } = params;
  const isAdd = action === "add";

  return new EmbedBuilder()
    .setTitle(isAdd ? "✅ Role Added" : "✅ Role Removed")
    .setDescription(
      isAdd
        ? `<@${moderatorId}> has given the <@&${roleId}> role to <@${targetUserId}>.`
        : `<@${moderatorId}> has removed the <@&${roleId}> role from <@${targetUserId}>.`
    )
    .setColor(isAdd ? EMBED_COLORS.success : EMBED_COLORS.error)
    .setTimestamp();
}

export function buildTempRoleEmbed(params: {
  action: "add" | "remove";
  roleId: string;
  targetUserId: string;
  moderatorId: string;
  expiresAt?: Date;
}): EmbedBuilder {
  const { action, roleId, targetUserId, moderatorId, expiresAt } = params;
  const isAdd = action === "add";

  const embed = new EmbedBuilder()
    .setTitle(isAdd ? "✅ Temporary Role Added" : "✅ Temporary Role Removed")
    .setDescription(
      isAdd
        ? `<@${moderatorId}> has given the <@&${roleId}> role to <@${targetUserId}>.`
        : `<@${moderatorId}> has removed the <@&${roleId}> role from <@${targetUserId}>.`
    )
    .setColor(isAdd ? EMBED_COLORS.success : EMBED_COLORS.error)
    .addFields(
      { name: "User", value: `<@${targetUserId}> (${targetUserId})`, inline: false },
      { name: "Moderator", value: `<@${moderatorId}> (${moderatorId})`, inline: false }
    );

  if (isAdd && expiresAt) {
    embed.addFields({
      name: "Expires",
      value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R> (on <t:${Math.floor(expiresAt.getTime() / 1000)}:f>)`,
      inline: false,
    });
  }

  embed.setTimestamp();
  return embed;
}

const PURPLE = 0x9B59B6;

export function buildCooldownWarnDmEmbed(gamemode: Gamemode, expiresAt: Date): EmbedBuilder {
  const gamemodeName = GAMEMODES[gamemode] ?? gamemode;
  const gamemodeEmoji = GAMEMODE_EMOJIS[gamemode] ?? "";
  const expiryUnix = Math.floor(expiresAt.getTime() / 1000);

  return new EmbedBuilder()
    .setTitle("⏳ Cooldown Expiring Soon")
    .setDescription(
      [
        `Your ${gamemodeEmoji} **${gamemodeName}** cooldown runs out <t:${expiryUnix}:R>.`,
        "",
        `You can wait it out, or remove it early using your server invites via \`/rewards\`.`,
        `**Check your balance:** \`/rewards-view\``,
      ].join("\n")
    )
    .setColor(PURPLE)
    .setFooter({ text: "Matrix Tierlist | Dev — DyingEcho" })
    .setTimestamp();
}

export function buildCooldownExpiredDmEmbed(gamemode: Gamemode): EmbedBuilder {
  const gamemodeName = GAMEMODES[gamemode] ?? gamemode;
  const gamemodeEmoji = GAMEMODE_EMOJIS[gamemode] ?? "";

  return new EmbedBuilder()
    .setTitle("✅ Cooldown Lifted")
    .setDescription(
      [
        `Your ${gamemodeEmoji} **${gamemodeName}** cooldown has ended — you're all clear!`,
        "",
        `Head to the waitlist panel to re-register, or use \`/rewards\` to remove future cooldowns early.`,
      ].join("\n")
    )
    .setColor(PURPLE)
    .setFooter({ text: "Matrix Tierlist | Dev — DyingEcho" })
    .setTimestamp();
}

export function buildUnrestrictDmEmbed(params: {
  type: string;
  tiersRestored: number;
}): EmbedBuilder {
  const { type, tiersRestored } = params;
  const typeName = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return new EmbedBuilder()
    .setTitle("✅ Restriction Lifted")
    .setDescription(
      [
        `Your **${typeName}** restriction in **Matrix Tierlist** has been removed.`,
        "",
        tiersRestored > 0
          ? `Your previous rank${tiersRestored > 1 ? "s" : ""} (${tiersRestored} gamemode${tiersRestored > 1 ? "s" : ""}) have been restored.`
          : "No previous ranks were on record to restore.",
        "",
        "You are free to participate in testing again.",
      ].join("\n")
    )
    .setColor(0x57F287)
    .setFooter({ text: "Matrix Tierlist | Dev — DyingEcho" })
    .setTimestamp();
}

export function buildRestrictionDmEmbed(params: {
  type: string;
  isPermanent: boolean;
  expiresAt: Date | null;
  restrictedBy: string;
  reason?: string | null;
}): EmbedBuilder {
  const { type, isPermanent, expiresAt, reason } = params;
  const typeName = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const durationText = isPermanent
    ? "**Permanent** — this restriction does not expire."
    : expiresAt
    ? `Expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R> — on <t:${Math.floor(expiresAt.getTime() / 1000)}:D>.`
    : "Duration unknown.";

  const lines = [
    `You have received a **${typeName}** restriction in **Matrix Tierlist**.`,
    `**Shame Role:** ${typeName}`,
    "",
    durationText,
  ];

  if (reason && reason !== "manual") {
    lines.push("", `**Reason:** ${reason}`);
  }

  lines.push("", "If you believe this is an error, please reach out to a staff member.");

  return new EmbedBuilder()
    .setTitle("⛔ You Have Been Restricted")
    .setDescription(lines.join("\n"))
    .setColor(0xED4245)
    .setFooter({ text: "Matrix Tierlist | Dev — DyingEcho" })
    .setTimestamp();
}

export function buildRedeemEmbed(params: {
  testerId: string;
  reward: string;
  testsCost: number;
  testsRemaining: number;
  ign?: string | null;
}): EmbedBuilder {
  const { testerId, reward, testsCost, testsRemaining, ign } = params;

  const embed = new EmbedBuilder()
    .setTitle("Reward Redeemed")
    .setColor(EMBED_COLORS.primary)
    .addFields(
      { name: "Tester", value: `<@${testerId}>`, inline: false },
      { name: "Reward Redeemed", value: reward, inline: false },
      { name: "Tests Spent", value: `${testsCost}`, inline: false },
      { name: "Tests Remaining", value: `${testsRemaining}`, inline: false },
    )
    .setFooter({ text: "Ping a Regulator or above to get your reward | Matrix tierlist Dev - DyingEcho" })
    .setTimestamp();

  if (ign) {
    embed.setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`);
  }

  return embed;
}
