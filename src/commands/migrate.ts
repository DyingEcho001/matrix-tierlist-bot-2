import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { GAMEMODES, GAMEMODE_KEYS, TIERS } from "../utils/constants";

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
    )
    .addStringOption((o) =>
      o.setName("region").setDescription("Player's region").setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("minecraft_username").setDescription("Player's Minecraft username").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: Client) {
    await interaction.reply({
      content: "This command is disabled<:crosspng:1520783021677084812> ,Log migrations manually in <#1513991982198948011> and follow <#1520891489255948298>",
      ephemeral: true,
    });
  },
};
