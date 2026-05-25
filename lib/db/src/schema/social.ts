import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const socialAccountsTable = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name"),
  profileUrl: text("profile_url").notNull(),
  externalAccountId: text("external_account_id"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const socialStatsSnapshotsTable = pgTable("social_stats_snapshots", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => socialAccountsTable.id, { onDelete: "cascade" }),
  followers: integer("followers"),
  following: integer("following"),
  postsCount: integer("posts_count"),
  raw: jsonb("raw").$type<Record<string, unknown>>().default({}),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialPostsTable = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  contentTa: text("content_ta"),
  mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const socialPostTargetsTable = pgTable("social_post_targets", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => socialPostsTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => socialAccountsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("pending"),
  platformPostId: text("platform_post_id"),
  platformPostUrl: text("platform_post_url"),
  error: text("error"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
});

export type SocialAccount = typeof socialAccountsTable.$inferSelect;
export type NewSocialAccount = typeof socialAccountsTable.$inferInsert;
export type SocialStatsSnapshot = typeof socialStatsSnapshotsTable.$inferSelect;
export type SocialPost = typeof socialPostsTable.$inferSelect;
export type NewSocialPost = typeof socialPostsTable.$inferInsert;
export type SocialPostTarget = typeof socialPostTargetsTable.$inferSelect;

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "twitter", "youtube", "linkedin", "telegram", "whatsapp", "threads", "other"] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

export const POST_STATUSES = ["draft", "scheduled", "publishing", "published", "partial", "failed"] as const;
export type PostStatus = typeof POST_STATUSES[number];

export const TARGET_STATUSES = ["pending", "publishing", "posted", "failed", "skipped"] as const;
export type TargetStatus = typeof TARGET_STATUSES[number];
