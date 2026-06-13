export const GAMEMODES = {
  nethpot: "Nethpot",
  potion: "Potion",
  mace: "Mace",
  axe_shield: "Axe & Shield",
  smp: "SMP",
  diamond_smp: "Diamond SMP",
  cart_pvp: "Cart PvP",
  creeper: "Creeper",
  sword: "Sword",
  uhc: "UHC",
  vanilla: "Vanilla",
} as const;

export type Gamemode = keyof typeof GAMEMODES;
export const GAMEMODE_KEYS = Object.keys(GAMEMODES) as Gamemode[];

export const REGIONS = {
  NA: "North America",
  EU: "Europe",
  AS: "Asia",
  SA: "South America",
  AU: "Australia",
} as const;

export type Region = keyof typeof REGIONS;
export const REGION_KEYS = Object.keys(REGIONS) as Region[];

export const TIERS = [
  "LT5",
  "HT5",
  "LT4",
  "HT4",
  "LT3",
  "HT3",
  "HT2",
  "HT1",
] as const;

export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  LT5: "Low Tier 5",
  HT5: "High Tier 5",
  LT4: "Low Tier 4",
  HT4: "High Tier 4",
  LT3: "Low Tier 3",
  HT3: "High Tier 3",
  HT2: "High Tier 2",
  HT1: "High Tier 1",
};

export const TIER_ORDER: Record<Tier, number> = {
  LT5: 0,
  HT5: 1,
  LT4: 2,
  HT4: 3,
  LT3: 4,
  HT3: 5,
  HT2: 6,
  HT1: 7,
};

export const STAFF_ROLES = [
  "helper",
  "discord_moderator",
  "senior_moderator",
  "regulator",
  "tierlist_administrator",
  "tierlist_overseer",
  "manager",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  helper: "Helper",
  discord_moderator: "Discord Moderator",
  senior_moderator: "Senior Moderator",
  regulator: "Regulator",
  tierlist_administrator: "Tierlist Administrator",
  tierlist_overseer: "Tierlist Overseer",
  manager: "Manager",
};

export const STAFF_ROLE_HIERARCHY: Record<StaffRole, number> = {
  helper: 0,
  discord_moderator: 1,
  senior_moderator: 2,
  regulator: 3,
  tierlist_administrator: 4,
  tierlist_overseer: 5,
  manager: 6,
};

export const RESTRICTION_TYPES = {
  test_cheater: "Test Cheater",
  hacking_subhuman: "Hacking Subhuman",
} as const;

export type RestrictionType = keyof typeof RESTRICTION_TYPES;

export const COOLDOWNS = {
  normal: 5 * 24 * 60 * 60 * 1000,
  ht3: 15 * 24 * 60 * 60 * 1000,
  fail_eval: 15 * 24 * 60 * 60 * 1000,
} as const;

export const CONFIG_KEYS = {
  TESTING_CATEGORY: "testing_category",
  HT3_CATEGORY: "ht3_category",
  TRANSCRIPT_CHANNEL: "transcript_channel",
  AUDIT_LOG_CHANNEL: "audit_log_channel",
} as const;

export const CHANNEL_TYPES = {
  transcript: "transcript",
  audit_log: "audit_log",
  waitlist: "waitlist",
} as const;

export const EMBED_COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  dark: 0x2b2d31,
  red_border: 0xed4245,
} as const;
