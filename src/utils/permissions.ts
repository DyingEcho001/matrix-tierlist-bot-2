import {
  GuildMember,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../database";
import { staffRoles, commandBypasses } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { StaffRole, STAFF_ROLE_HIERARCHY, STAFF_ROLES, SUPER_ADMIN_ID } from "./constants";

export async function getStaffRoleId(
  guildId: string,
  staffRole: StaffRole
): Promise<string | null> {
  const row = await db
    .select()
    .from(staffRoles)
    .where(
      and(eq(staffRoles.guildId, guildId), eq(staffRoles.staffRole, staffRole))
    )
    .limit(1);
  return row[0]?.roleId ?? null;
}

export async function getMemberStaffLevel(
  member: GuildMember,
  guildId: string
): Promise<number> {
  let highest = -1;
  for (const sr of STAFF_ROLES) {
    const roleId = await getStaffRoleId(guildId, sr);
    if (roleId && member.roles.cache.has(roleId)) {
      const level = STAFF_ROLE_HIERARCHY[sr];
      if (level > highest) highest = level;
    }
  }
  return highest;
}

export async function hasStaffRole(
  member: GuildMember,
  guildId: string,
  required: StaffRole
): Promise<boolean> {
  const level = await getMemberStaffLevel(member, guildId);
  return level >= STAFF_ROLE_HIERARCHY[required];
}

export function isOwner(member: GuildMember): boolean {
  return member.id === member.guild.ownerId;
}

export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

export function isSuperAdmin(member: GuildMember): boolean {
  return member.id === SUPER_ADMIN_ID;
}

export async function hasCommandBypass(
  discordId: string,
  guildId: string
): Promise<boolean> {
  const row = await db
    .select()
    .from(commandBypasses)
    .where(
      and(eq(commandBypasses.guildId, guildId), eq(commandBypasses.discordId, discordId))
    )
    .limit(1);
  return row.length > 0;
}

async function replyOrEdit(
  interaction: ChatInputCommandInteraction,
  content: string
): Promise<void> {
  const payload = { content, ephemeral: true };
  if (interaction.deferred) {
    await interaction.editReply(payload);
  } else if (interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

export async function requireStaff(
  interaction: ChatInputCommandInteraction,
  required: StaffRole
): Promise<boolean> {
  const member = interaction.member as GuildMember;
  if (isSuperAdmin(member)) return true;
  if (isAdmin(member) || isOwner(member)) return true;
  if (await hasCommandBypass(member.id, interaction.guildId!)) return true;
  const ok = await hasStaffRole(member, interaction.guildId!, required);
  if (!ok) {
    await replyOrEdit(interaction, "❌ You don't have the required permissions to use this command.");
  }
  return ok;
}

export async function requireSuperAdmin(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const member = interaction.member as GuildMember;
  if (isSuperAdmin(member)) return true;
  await replyOrEdit(interaction, "❌ This command is restricted and cannot be used.");
  return false;
}

export async function getVoluntaryTesterRoleId(
  guildId: string
): Promise<string | null> {
  const { voluntaryTesterRole } = await import("../database/schema");
  const row = await db
    .select()
    .from(voluntaryTesterRole)
    .where(eq(voluntaryTesterRole.guildId, guildId))
    .limit(1);
  return row[0]?.roleId ?? null;
}

export async function getTesterRoleId(
  guildId: string,
  gamemode: string
): Promise<string | null> {
  const { testerRoles } = await import("../database/schema");
  const row = await db
    .select()
    .from(testerRoles)
    .where(
      and(eq(testerRoles.guildId, guildId), eq(testerRoles.gamemode, gamemode))
    )
    .limit(1);
  return row[0]?.roleId ?? null;
}

export async function isVoluntaryTester(
  member: GuildMember,
  guildId: string,
  gamemode?: string
): Promise<boolean> {
  if (isSuperAdmin(member)) return true;
  if (isAdmin(member) || isOwner(member)) return true;
  if (await hasCommandBypass(member.id, guildId)) return true;
  if (await hasStaffRole(member, guildId, "regulator")) return true;
  const vtRoleId = await getVoluntaryTesterRoleId(guildId);
  if (!vtRoleId || !member.roles.cache.has(vtRoleId)) return false;
  if (gamemode) {
    const gmRoleId = await getTesterRoleId(guildId, gamemode);
    if (!gmRoleId || !member.roles.cache.has(gmRoleId)) return false;
  }
  return true;
}

export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)(d|h|m)$/i);
  if (!match) return null;
  const [, amount, unit] = match;
  const n = parseInt(amount);
  switch (unit.toLowerCase()) {
    case "d":
      return n * 24 * 60 * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "m":
      return n * 60 * 1000;
    default:
      return null;
  }
}
