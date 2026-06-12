import { Collection, SlashCommandBuilder } from "discord.js";
import { ChatInputCommandInteraction, Client } from "discord.js";

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
}

export const commands = new Collection<string, Command>();

import { startCommand } from "./start";
import { pullCommand } from "./pull";
import { closeCommand } from "./close";
import { leaveCommand } from "./leave";
import { evalCommand } from "./eval";
import { failEvalCommand } from "./fail-eval";
import { passEvalCommand } from "./pass-eval";
import { rankCommand } from "./rank";
import { playerDataCommand } from "./player-data";
import { restrictCommand } from "./restrict";
import { unrestrictCommand } from "./unrestrict";
import { addCommand } from "./add";
import { migrateProfileCommand } from "./migrate-profile";
import { temproleCommand } from "./temprole";
import { roleCommand } from "./role";
import { joinTesterPoolCommand } from "./join-tester-pool";
import { staffRoleCommand } from "./staff-role-assign";
import { tierRoleAssignCommand } from "./tier-role-assign";
import { gamemodeRoleCommand } from "./gamemode-role";
import { testerRoleCommand } from "./tester-role";
import { setChannelCommand } from "./set-channel";
import { setCategoryCommand } from "./set-category";
import { waitlistPanelSendCommand } from "./waitlist-panel-send";
import { waitlistPostCommand } from "./waitlist-post";
import { voluntaryTesterRoleCommand } from "./voluntary-tester-role";

const allCommands: Command[] = [
  startCommand,
  pullCommand,
  closeCommand,
  leaveCommand,
  evalCommand,
  failEvalCommand,
  passEvalCommand,
  rankCommand,
  playerDataCommand,
  restrictCommand,
  unrestrictCommand,
  addCommand,
  migrateProfileCommand,
  temproleCommand,
  roleCommand,
  joinTesterPoolCommand,
  staffRoleCommand,
  tierRoleAssignCommand,
  gamemodeRoleCommand,
  testerRoleCommand,
  setChannelCommand,
  setCategoryCommand,
  waitlistPanelSendCommand,
  waitlistPostCommand,
  voluntaryTesterRoleCommand,
];

for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}
