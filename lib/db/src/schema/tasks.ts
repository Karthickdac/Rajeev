import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

// Internal team to-do / task tracking for the Minister, PA, and admin team.
// Status / priority / category are stored as text with exported const arrays
// (same pattern as promises) so values stay flexible and easy to validate
// with Zod on the API layer without enum-migration friction.
export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  dueTime: text("due_time"), // "HH:MM" 24h, optional
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
  category: text("category").notNull().default("follow_up"),
  assignedTo: integer("assigned_to"), // FK users.id (nullable = unassigned)
  createdBy: integer("created_by"), // FK users.id
  linkedEntityType: text("linked_entity_type"), // grievance | appointment | event
  linkedEntityId: integer("linked_entity_id"),
  reminderAt: timestamp("reminder_at", { withTimezone: true }), // provisioned for future SMS
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Task = typeof tasksTable.$inferSelect;
export type NewTask = typeof tasksTable.$inferInsert;

export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export const TASK_CATEGORIES = [
  "follow_up",
  "visit_prep",
  "grievance_action",
  "content",
  "official",
  "personal",
] as const;
export type TaskCategory = typeof TASK_CATEGORIES[number];

export const TASK_LINKED_ENTITY_TYPES = ["grievance", "appointment", "event"] as const;
export type TaskLinkedEntityType = typeof TASK_LINKED_ENTITY_TYPES[number];
