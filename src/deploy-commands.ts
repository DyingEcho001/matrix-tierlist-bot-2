import * as dotenv from "dotenv";
dotenv.config({ override: false });

import { REST, Routes } from "discord.js";
import { config } from "./config";
import { commands } from "./commands";

const rest = new REST({ version: "10" }).setToken(config.token);

export async function deployCommands(): Promise<void> {
  const commandData = [...commands.values()].map((cmd) => cmd.data.toJSON());

  console.log(`🚀 Deploying ${commandData.length} commands to guild ${config.guildId}...`);

  try {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commandData }
    );
    console.log("✅ Commands deployed successfully!");
  } catch (err) {
    console.error("❌ Failed to deploy commands:", err);
  }
}

// Allow running directly: ts-node src/deploy-commands.ts
if (require.main === module) {
  deployCommands();
}
