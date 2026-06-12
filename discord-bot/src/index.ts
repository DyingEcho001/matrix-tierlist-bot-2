import "./config";
import * as dotenv from "dotenv";
dotenv.config();

import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config";
import { registerReadyEvent } from "./events/ready";
import { registerInteractionEvent } from "./events/interactionCreate";
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

client.login(config.token).catch((err) => {
  console.error("Failed to login:", err);
  process.exit(1);
});
