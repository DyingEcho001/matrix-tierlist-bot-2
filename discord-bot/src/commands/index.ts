import { Collection } from "discord.js";
import { ChatInputCommandInteraction, Client } from "discord.js";

export interface Command {
  data: { name: string; toJSON(): unknown };
  execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
}

export const commands = new Collection<string, Command>();

import { startCommand } from "./start";
import { pullCommand } from "./pull";
import { endCommand } from "./end";
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
import { waitlistRoleSetCommand } from "./waitlist-role-set";
import { testerRoleCommand } from "./tester-role";
import { setChannelCommand } from "./set-channel";
import { setCategoryCommand } from "./set-category";
import { registrationPanelSendCommand } from "./registration-panel-send";
import { waitlistPostCommand } from "./waitlist-post";
import { voluntaryTesterRoleCommand } from "./voluntary-tester-role";
import { resetCooldownCommand } from "./reset-cooldown";
import { cooldownAddCommand } from "./cooldown-add";
import { shameroleAssignCommand } from "./shamerole-assign";
import { sendEmbedCommand } from "./send-embed";
import { queueChannelSetCommand } from "./queue-channel-set";
import { alltimeLeaderboardCommand } from "./alltime-leaderboard";
import { monthlyLeaderboardCommand } from "./monthly-leaderboard";
import { statsCommand } from "./stats";
import { queuePriorityRoleCommand } from "./queue-priority-role";
import { tierWipeCommand } from "./tier-wipe";
import { redeemCommand } from "./redeem";
import { bypassCommand } from "./bypass";
import { addTestsCommand } from "./add-tests";

const allCommands: Command[] = [
  startCommand,
  pullCommand,
  endCommand,
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
  waitlistRoleSetCommand,
  testerRoleCommand,
  setChannelCommand,
  setCategoryCommand,
  registrationPanelSendCommand,
  waitlistPostCommand,
  voluntaryTesterRoleCommand,
  resetCooldownCommand,
  cooldownAddCommand,
  shameroleAssignCommand,
  sendEmbedCommand,
  queueChannelSetCommand,
  alltimeLeaderboardCommand,
  monthlyLeaderboardCommand,
  statsCommand,
  queuePriorityRoleCommand,
  tierWipeCommand,
  redeemCommand,
  bypassCommand,
  addTestsCommand,
];

for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}
