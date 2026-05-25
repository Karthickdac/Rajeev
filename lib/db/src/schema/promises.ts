import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const promisesTable = pgTable("promises", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleTa: text("title_ta"),
  description: text("description"),
  descriptionTa: text("description_ta"),
  category: text("category").notNull().default("general"),
  status: text("status").notNull().default("announced"),
  progress: integer("progress").notNull().default(0),
  announcedAt: timestamp("announced_at", { withTimezone: true }),
  targetDate: timestamp("target_date", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  imageUrl: text("image_url"),
  proofUrl: text("proof_url"),
  wardId: integer("ward_id"),
  displayOrder: integer("display_order").notNull().default(0),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Promise = typeof promisesTable.$inferSelect;
export type NewPromise = typeof promisesTable.$inferInsert;

export const PROMISE_STATUSES = ["announced", "in_progress", "delivered", "on_hold", "dropped"] as const;
export type PromiseStatus = typeof PROMISE_STATUSES[number];

export const PROMISE_CATEGORIES = [
  "infrastructure", "water", "electricity", "education", "healthcare",
  "agriculture", "welfare", "transport", "employment", "general",
] as const;
export type PromiseCategory = typeof PROMISE_CATEGORIES[number];
