import * as dotenv from "dotenv";
dotenv.config({ override: false });

import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config";
import { registerReadyEvent } from "./events/ready";
import { registerInteractionEvent } from "./events/interactionCreate";
import { deployCommands } from "./deploy-commands";
import "./commands";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

registerReadyEvent(client);
registerInteractionEvent(client);

client.on("error", (err) => {
  console.error("[Discord Client Error]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception]", err);
});

deployCommands()
  .then(() => client.login(config.token))
  .catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
