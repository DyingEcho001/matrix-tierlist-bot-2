import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  bigint,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull().unique(),
    discordUsername: text("discord_username").notNull(),
    ign: text("ign").notNull(),
    region: text("region").notNull(),
    preferredServer: text("preferred_server").notNull(),
    uuid: text("uuid"),
    isPremium: boolean("is_premium").default(true),
    registeredAt: timestamp("registered_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("players_discord_id_idx").on(t.discordId)]
);

export const tiers = pgTable(
  "tiers",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    gamemode: text("gamemode").notNull(),
    tier: text("tier").notNull(),
    givenBy: text("given_by"),
    givenAt: timestamp("given_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("tiers_discord_gamemode_unique").on(t.discordId, t.gamemode),
    index("tiers_discord_id_idx").on(t.discordId),
  ]
);

export const cooldowns = pgTable(
  "cooldowns",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    gamemode: text("gamemode").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    warnDmSent: boolean("warn_dm_sent").default(false),
    expiredDmSent: boolean("expired_dm_sent").default(false),
  },
  (t) => [
    unique("cooldowns_discord_gamemode_unique").on(t.discordId, t.gamemode),
    index("cooldowns_discord_id_idx").on(t.discordId),
  ]
);

export const restrictions = pgTable(
  "restrictions",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    type: text("type").notNull(),
    restrictedBy: text("restricted_by").notNull(),
    reason: text("reason").default("manual"),
    isPermanent: boolean("is_permanent").default(false),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true),
    previousTiers: jsonb("previous_tiers"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("restrictions_discord_id_idx").on(t.discordId)]
);

export const queues = pgTable(
  "queues",
  {
    id: serial("id").primaryKey(),
    gamemode: text("gamemode").notNull(),
    region: text("region").notNull(),
    isActive: boolean("is_active").default(true),
    channelId: text("channel_id"),
    messageId: text("message_id"),
    lastSessionEnd: timestamp("last_session_end"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("queues_gamemode_region_unique").on(t.gamemode, t.region),
    index("queues_gamemode_region_idx").on(t.gamemode, t.region),
  ]
);

export const queueTesters = pgTable(
  "queue_testers",
  {
    id: serial("id").primaryKey(),
    queueId: integer("queue_id").notNull(),
    discordId: text("discord_id").notNull(),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => [
    unique("queue_testers_queue_tester_unique").on(t.queueId, t.discordId),
    index("queue_testers_queue_id_idx").on(t.queueId),
  ]
);

export const queueMembers = pgTable(
  "queue_members",
  {
    id: serial("id").primaryKey(),
    queueId: integer("queue_id").notNull(),
    discordId: text("discord_id").notNull(),
    position: integer("position").notNull(),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => [
    unique("queue_members_queue_user_unique").on(t.queueId, t.discordId),
    index("queue_members_queue_id_idx").on(t.queueId),
  ]
);

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    gamemode: text("gamemode").notNull(),
    region: text("region").notNull(),
    testerId: text("tester_id").notNull(),
    testeeId: text("testee_id").notNull(),
    channelId: text("channel_id").notNull(),
    guildId: text("guild_id").notNull(),
    status: text("status").default("open"),
    isEvalPending: boolean("is_eval_pending").default(false),
    assignedHT3Tester: text("assigned_ht3_tester"),
    closedAt: timestamp("closed_at"),
    closedBy: text("closed_by"),
    tierGiven: text("tier_given"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("tickets_channel_id_idx").on(t.channelId),
    index("tickets_tester_id_idx").on(t.testerId),
    index("tickets_testee_id_idx").on(t.testeeId),
  ]
);

export const testerStats = pgTable(
  "tester_stats",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull().unique(),
    allTimeTests: integer("all_time_tests").default(0),
    monthlyTests: integer("monthly_tests").default(0),
    monthlyResetAt: timestamp("monthly_reset_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  }
);

export const staffRoles = pgTable(
  "staff_roles",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    staffRole: text("staff_role").notNull(),
    roleId: text("role_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("staff_roles_guild_staff_unique").on(t.guildId, t.staffRole),
  ]
);

export const gamemodeRoles = pgTable(
  "gamemode_roles",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    gamemode: text("gamemode").notNull(),
    region: text("region").notNull().default(""),
    roleId: text("role_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("gamemode_roles_guild_gamemode_region_unique").on(t.guildId, t.gamemode, t.region),
  ]
);

export const testerRoles = pgTable(
  "tester_roles",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    gamemode: text("gamemode").notNull(),
    roleId: text("role_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("tester_roles_guild_gamemode_unique").on(t.guildId, t.gamemode),
  ]
);

export const tierRoles = pgTable(
  "tier_roles",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    tier: text("tier").notNull(),
    gamemode: text("gamemode").notNull(),
    roleId: text("role_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("tier_roles_guild_tier_gamemode_unique").on(
      t.guildId,
      t.tier,
      t.gamemode
    ),
  ]
);

export const channelConfig = pgTable(
  "channel_config",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    configKey: text("config_key").notNull(),
    channelId: text("channel_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("channel_config_guild_key_unique").on(t.guildId, t.configKey),
  ]
);

export const categoryConfig = pgTable(
  "category_config",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    configKey: text("config_key").notNull(),
    categoryId: text("category_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("category_config_guild_key_unique").on(t.guildId, t.configKey),
  ]
);

export const tempRoles = pgTable(
  "temp_roles",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    discordId: text("discord_id").notNull(),
    roleId: text("role_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    assignedBy: text("assigned_by").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("temp_roles_discord_id_idx").on(t.discordId),
    index("temp_roles_expires_at_idx").on(t.expiresAt),
  ]
);

export const voluntaryTesterRole = pgTable(
  "voluntary_tester_role",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull().unique(),
    roleId: text("role_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  }
);

export const queuePriorityRoles = pgTable(
  "queue_priority_roles",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull().unique(),
    roleId: text("role_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  }
);

export const shameRoles = pgTable(
  "shame_roles",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    category: text("category").notNull(),
    roleId: text("role_id").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("shame_roles_guild_category_unique").on(t.guildId, t.category),
  ]
);

export const commandBypasses = pgTable(
  "command_bypasses",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    discordId: text("discord_id").notNull(),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    unique("command_bypasses_guild_user_unique").on(t.guildId, t.discordId),
    index("command_bypasses_discord_id_idx").on(t.discordId),
  ]
);
