import { Gamemode } from "../utils/constants";

export interface PendingPull {
  memberId: string;
  guildId: string;
  queueId: number;
  gamemode: Gamemode;
  region: string;
  existingTicketId: number;
  existingChannelId: string;
}

const pendingPulls = new Map<string, PendingPull>();

export function setPendingPull(userId: string, state: PendingPull): void {
  pendingPulls.set(userId, state);
}

export function getPendingPull(userId: string): PendingPull | undefined {
  return pendingPulls.get(userId);
}

export function deletePendingPull(userId: string): void {
  pendingPulls.delete(userId);
}
