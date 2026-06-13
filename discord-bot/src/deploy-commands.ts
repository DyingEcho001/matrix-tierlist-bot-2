import * as dotenv from "dotenv";
dotenv.config({ override: false });

import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config";
import { commands } from "./commands";

const rest = new REST({ version: "10" }).setToken(config.token);

async function deployCommands(): Promise<void> {
  const commandData = [...commands.values()].map((cmd) => cmd.data.toJSON());

  console.log(`🚀 Deploying ${commandData.length} commands to guild ${config.guildId}...`);

  try {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commandData }
    );
    console.log("✅ Commands deployed successfully!");
    console.log("Commands deployed:");
    commandData.forEach((cmd) => console.log(`  /${(cmd as { name: string }).name}`));
  } catch (err) {
    console.error("❌ Failed to deploy commands:", err);
    process.exit(1);
  }
}

deployCommands();
