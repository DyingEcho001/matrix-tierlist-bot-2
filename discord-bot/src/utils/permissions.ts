import {
  GuildMember,
  Guild,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../database";
import { staffRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { StaffRole, STAFF_ROLE_HIERARCHY, STAFF_ROLES } from "./constants";

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

export async function requireStaff(
  interaction: ChatInputCommandInteraction,
  required: StaffRole
): Promise<boolean> {
  const member = interaction.member as GuildMember;
  if (isAdmin(member) || isOwner(member)) return true;
  const ok = await hasStaffRole(member, interaction.guildId!, required);
  if (!ok) {
    await interaction.reply({
      content: `❌ You need the **${required
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())}** role or higher to use this command.`,
      ephemeral: true,
    });
  }
  return ok;
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
