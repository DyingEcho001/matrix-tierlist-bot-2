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
  spearmace: "SpearMace",
  ogvanilla: "OGVanilla",
} as const;

export type Gamemode = keyof typeof GAMEMODES;
export const GAMEMODE_KEYS = Object.keys(GAMEMODES) as Gamemode[];

export const GAMEMODE_EMOJIS: Record<Gamemode, string> = {
  nethpot:    "<:NETHOP:1516067844830527529>",
  potion:     "<:Potion:1515671878029803530>",
  mace:       "<:MACE:1515434532499619942>",
  axe_shield: "<:AXE:1516066987615457372>",
  smp:        "<:SMP:1516066537977679872>",
  diamond_smp:"<:DIA_SMP:1515671730457153616>",
  cart_pvp:   "<:TNT_CART:1515671953040474122>",
  creeper:    "<:creeper:1516064576116887552>",
  sword:      "<:SWORD:1516066339284975827>",
  uhc:        "<:UHC:1516067484179103856>",
  vanilla:    "<:VANILLA:1516067734926917813>",
  spearmace:  "<:spear:1520131818798448671>",
  ogvanilla:  "<:OGV:1520508829693907124>",
};

export const GAMEMODE_BUTTON_EMOJIS: Record<Gamemode, { id?: string; name: string } | string> = {
  nethpot:    { id: "1516067844830527529", name: "NETHOP" },
  potion:     { id: "1515671878029803530", name: "Potion" },
  mace:       { id: "1515434532499619942", name: "MACE" },
  axe_shield: { id: "1516066987615457372", name: "AXE" },
  smp:        { id: "1516066537977679872", name: "SMP" },
  diamond_smp:{ id: "1515671730457153616", name: "DIA_SMP" },
  cart_pvp:   { id: "1515671953040474122", name: "TNT_CART" },
  creeper:    { id: "1516064576116887552", name: "creeper" },
  sword:      { id: "1516066339284975827", name: "SWORD" },
  uhc:        { id: "1516067484179103856", name: "UHC" },
  vanilla:    { id: "1516067734926917813", name: "VANILLA" },
  spearmace:  { id: "1520131818798448671", name: "spear" },
  ogvanilla:  { id: "1520508829693907124", name: "OGV" },
};

export const REGIONS = {
  "EU/NA": "EU/NA",
  "AS/AU": "AS/AU",
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
  "LT2",
  "HT2",
  "LT1",
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
  LT2: "Low Tier 2",
  HT2: "High Tier 2",
  LT1: "Low Tier 1",
  HT1: "High Tier 1",
};

export const TIER_ORDER: Record<Tier, number> = {
  LT5: 0,
  HT5: 1,
  LT4: 2,
  HT4: 3,
  LT3: 4,
  HT3: 5,
  LT2: 6,
  HT2: 7,
  LT1: 8,
  HT1: 9,
};

export const HT3_PLUS_TIERS: Tier[] = ["HT3", "LT2", "HT2", "LT1", "HT1"];

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
  RESULTS_CHANNEL: "results",
  COMMANDS_CHANNEL: "commands",
  REDEEM_CHANNEL: "redeem",
} as const;

export const CHANNEL_TYPES = {
  transcript: "transcript",
  audit_log: "audit_log",
  waitlist: "waitlist",
  results: "results",
  commands: "commands",
  redeem: "redeem",
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

export const INVITE_COSTS: Record<string, number> = {
  lt3_and_below: 2,
  ht3: 10,
  lt2_and_above: 25,
};

export function getInviteCostForTier(tier: Tier | null): { cost: number; label: string } {
  if (!tier) return { cost: 2, label: "LT3 & Below" };
  const order = TIER_ORDER[tier];
  if (order >= TIER_ORDER["LT2"]) return { cost: 25, label: "LT2 & Above" };
  if (tier === "HT3") return { cost: 10, label: "HT3" };
  return { cost: 2, label: "LT3 & Below" };
}

export const REDEEM_REWARDS = [
  { value: "lt3_cooldown_removal",  label: "LT3 & Below Cooldown Removal (10 tests)",    cost: 10 },
  { value: "custom_role_7d",        label: "Custom Role — 7 Days (15 tests)",             cost: 15 },
  { value: "ht3_cooldown_removal",  label: "HT3+ Cooldown Removal (30 tests)",            cost: 30 },
  { value: "custom_head_emoji",     label: "Custom Minecraft Head Emoji — Permanent (45 tests)", cost: 45 },
  { value: "veteran_tester",        label: "Veteran Tester (55 tests)",                   cost: 55 },
  { value: "custom_role_permanent", label: "Custom Role of Your Choice — Permanent (80 tests)", cost: 80 },
] as const;
