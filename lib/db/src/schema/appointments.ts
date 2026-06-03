import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";

// Public appointment / meeting requests submitted by citizens, managed by the
// PA and Minister. Status / category stored as text with exported const arrays
// (same flexible pattern as tasks / promises) so values stay easy to validate
// with Zod on the API layer without enum-migration friction.
export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  ticketNo: text("ticket_no").notNull().unique(), // APT-YYYY-NNNN

  // Requester (citizen) details
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  ward: text("ward"),
  constituency: text("constituency"),

  // Request details
  category: text("category").notNull().default("General"),
  subject: text("subject").notNull(),
  description: text("description"),
  partySize: integer("party_size").notNull().default(1),
  // Citizen's preferred slot (free-form date + HH:MM time string)
  preferredDate: timestamp("preferred_date", { withTimezone: true }),
  preferredTime: text("preferred_time"), // "HH:MM" 24h, optional
  // Citizen's fallback date if the preferred slot is unavailable
  alternateDate: timestamp("alternate_date", { withTimezone: true }),

  // Lifecycle
  status: text("status").notNull().default("Pending"),

  // Office-confirmed schedule (set on Approve / Reschedule)
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  scheduledTime: text("scheduled_time"), // "HH:MM" 24h
  location: text("location"),

  // Decision metadata
  decisionNote: text("decision_note"), // internal-only staff note; never returned by the public track endpoint
  rejectionReason: text("rejection_reason"),
  handledBy: integer("handled_by"), // FK users.id (staff who acted)
  handledByName: text("handled_by_name"),

  // SMS out of scope — provision the column only for future notification work
  notificationMessage: text("notification_message"),
  notified: boolean("notified").notNull().default(false),

  // AI-generated urgency score (1–100, async, non-blocking after submit)
  aiPriorityScore: integer("ai_priority_score"),

  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Appointment = typeof appointmentsTable.$inferSelect;
export type NewAppointment = typeof appointmentsTable.$inferInsert;

export const APPOINTMENT_STATUSES = [
  "Pending",
  "Approved",
  "Completed",
  "Rejected",
  "Rescheduled",
  "Cancelled",
] as const;
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];

export const APPOINTMENT_CATEGORIES = [
  "Constituency Meeting",
  "Grievance Hearing",
  "Official Visit",
  "Media",
  "General",
] as const;
export type AppointmentCategory = typeof APPOINTMENT_CATEGORIES[number];
