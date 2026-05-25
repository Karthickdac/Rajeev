import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

// Press coverage tracker — articles mentioning the leader, scraped from
// Google News RSS (no API key needed) or entered manually by media team.
// AI summary is generated on ingest if OPENAI_API_KEY is set.
export const pressCoverageTable = pgTable("press_coverage", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  snippet: text("snippet"),
  summaryEn: text("summary_en"),
  summaryTa: text("summary_ta"),
  sentiment: text("sentiment"),               // positive | neutral | negative | mixed
  sentimentScore: integer("sentiment_score"), // -100..100
  topics: text("topics"),                     // comma-separated tags from AI
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pubIdx: index("press_coverage_pub_idx").on(t.publishedAt),
}));

export type PressCoverage = typeof pressCoverageTable.$inferSelect;
export type NewPressCoverage = typeof pressCoverageTable.$inferInsert;
