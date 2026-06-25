import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { db } from "../database";
import { players } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "../utils/permissions";
import { getChannelId } from "../handlers/ticket";
import { TIERS, GAMEMODES, GAMEMODE_KEYS, Gamemode, TIER_LABELS, Tier } from "../utils/constants";
import { logCommand } from "../handlers/audit";

const MIGRATE_SOURCES = [
  { name: "PvPTiers", value: "pvptiers" },
  { name: "MCTiers", value: "mctiers" },
  { name: "SubTiers", value: "subtiers" },
] as const;

export const migrateCommand = {
  data: new SlashCommandBuilder()
    .setName("migrate")
    .setDescription("Log a player migration from another tierlist (Regulator+)")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) =>
      o.setName("user").setDescription("Discord user being migrated").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("region").setDescription("Player's region — leave blank to use registered profile").setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("minecraft_username").setDescription("Player's Minecraft username — leave blank to use registered profile").setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName("gamemode")
        .setDescription("Gamemode being migrated")
        .setRequired(true)
        .addChoices(...GAMEMODE_KEYS.map((gm) => ({ name: GAMEMODES[gm], value: gm })))
    )
    .addStringOption((o) =>
      o
        .setName("tier")
        .setDescription("Tier being migrated (up to HT1)")
        .setRequired(true)
        .addChoices(...TIERS.map((t) => ({ name: t, value: t })))
    )
    .addStringOption((o) =>
      o
        .setName("migrating_from")
        .setDescription("Source tierlist")
        .setRequired(true)
        .addChoices(...MIGRATE_SOURCES)
    )
    .addStringOption((o) =>
      o
        .setName("result")
        .setDescription("Discord message link of the result proof")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const member = interaction.member as GuildMember;
    if (!(await requireStaff(interaction, "regulator"))) return;

    const targetUser = interaction.options.getUser("user", true);
    const regionInput = interaction.options.getString("region");
    const ignInput = interaction.options.getString("minecraft_username");
    const gamemode = interaction.options.getString("gamemode", true) as Gamemode;
    const tier = interaction.options.getString("tier", true) as Tier;
    const source = interaction.options.getString("migrating_from", true);
    const resultLink = interaction.options.getString("result", true);

    await interaction.deferReply({ ephemeral: true });

    const playerRow = await db
      .select()
      .from(players)
      .where(eq(players.discordId, targetUser.id))
      .limit(1);

    const playerData = playerRow[0] ?? null;

    const ign = ignInput ?? playerData?.ign ?? null;
    const region = regionInput ?? playerData?.region ?? null;

    if (!ign || !region) {
      await interaction.editReply({
        content: `❌ Could not determine ${!ign ? "Minecraft username" : "region"} for <@${targetUser.id}>. They have no registered profile — please provide the value manually.`,
      });
      return;
    }

    const migrateChannelId = await getChannelId(interaction.guildId!, "migrate");
    if (!migrateChannelId) {
      await interaction.editReply({
        content: "❌ No migrate channel configured. Use `/set-channel` to set one.",
      });
      return;
    }

    const migrateChannel = (await client.channels
      .fetch(migrateChannelId)
      .catch(() => null)) as TextChannel | null;

    if (!migrateChannel) {
      await interaction.editReply({
        content: "❌ Migrate channel not found or inaccessible.",
      });
      return;
    }

    const sourceLabel =
      MIGRATE_SOURCES.find((s) => s.value === source)?.name ?? source;

    const nowUnix = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setTitle("📦 Player Migration")
      .setColor(0xc39bd3)
      .setThumbnail(`https://visage.surgeplay.com/bust/128/${ign}`)
      .addFields(
        { name: "User", value: `<@${targetUser.id}>`, inline: false },
        { name: "Minecraft Username", value: ign, inline: false },
        { name: "Migrating From", value: sourceLabel, inline: false },
        { name: "Tier", value: TIER_LABELS[tier] ?? tier, inline: false },
        { name: "Gamemode", value: GAMEMODES[gamemode] ?? gamemode, inline: false },
        { name: "Region", value: region, inline: false },
        { name: "Result", value: resultLink, inline: false },
        { name: "Date", value: `<t:${nowUnix}:F>`, inline: false },
        { name: "Used By", value: `<@${member.id}>`, inline: false },
      )
      .setFooter({ text: "Matrix Tierlist | Dev — DyingEcho" })
      .setTimestamp();

    await migrateChannel.send({ embeds: [embed] });

    await interaction.editReply({
      content: `✅ Migration logged in <#${migrateChannelId}>.`,
    });

    await logCommand(client, {
      command: "migrate",
      user: member,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      options: { user: targetUser.id, tier, gamemode, source, ign },
    });
  },
};
