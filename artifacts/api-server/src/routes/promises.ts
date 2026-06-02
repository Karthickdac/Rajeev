import { Router } from "express";
import { db } from "@workspace/db";
import {
  promisesTable, eventsTable, grievancesTable, volunteersTable,
  activitiesTable, wardsTable, auditLogTable,
  PROMISE_STATUSES, PROMISE_CATEGORIES,
} from "@workspace/db/schema";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireStaff, requireRole, type AuthRequest } from "../lib/auth.js";

const router = Router();
// requireRole only checks the role on an already-authenticated user, so we
// chain requireStaff (which authenticates + enforces any staff role) in front
// of every admin endpoint. Same pattern admin.ts uses with router.use().
const requireContentRole = [requireStaff, requireRole("super_admin", "admin", "pa_staff", "media_team")];
const requireCdiRole = [requireStaff, requireRole("super_admin", "admin", "pa_staff", "constituency_coordinator", "grievance_officer")];

// Accept http(s) URLs only — keeps stored values from becoming a javascript:
// or data: phishing/XSS vector when re-rendered into public <a href>.
const httpUrl = z.string().regex(/^https?:\/\//i, "Must be an http(s) URL").max(2048);

// ─────────────────────────────────────────────────────────
// PROMISES — public listing + admin CRUD
// ─────────────────────────────────────────────────────────
router.get("/promises", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const conds = [] as ReturnType<typeof eq>[];
  if (status) conds.push(eq(promisesTable.status, status));
  if (category) conds.push(eq(promisesTable.category, category));
  const rows = await db.select().from(promisesTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(promisesTable.displayOrder), desc(promisesTable.announcedAt));

  // Summary counts so the public page can render the headline "% delivered".
  const counts = await db.execute(sql`
    SELECT status, COUNT(*)::int AS n FROM promises GROUP BY status
  `);
  const byStatus: Record<string, number> = {};
  for (const row of counts.rows as Array<{ status: string; n: number }>) byStatus[row.status] = row.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const delivered = byStatus.delivered ?? 0;
  res.json({
    promises: rows,
    summary: {
      total,
      byStatus,
      deliveredPct: total > 0 ? Math.round((delivered / total) * 100) : 0,
    },
  });
});

const promiseSchema = z.object({
  title: z.string().min(1).max(300),
  titleTa: z.string().max(300).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  descriptionTa: z.string().max(5000).optional().nullable(),
  category: z.enum(PROMISE_CATEGORIES).default("general"),
  status: z.enum(PROMISE_STATUSES).default("announced"),
  progress: z.number().int().min(0).max(100).default(0),
  announcedAt: z.coerce.date().optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
  deliveredAt: z.coerce.date().optional().nullable(),
  imageUrl: httpUrl.optional().nullable(),
  proofUrl: httpUrl.optional().nullable(),
  wardId: z.number().int().optional().nullable(),
  displayOrder: z.number().int().default(0),
});

router.get("/admin/promises", requireContentRole, async (_req, res) => {
  const rows = await db.select().from(promisesTable)
    .orderBy(asc(promisesTable.displayOrder), desc(promisesTable.createdAt));
  res.json({ promises: rows });
});

router.post("/admin/promises", requireContentRole, async (req: AuthRequest, res) => {
  const parsed = promiseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  const data = parsed.data;
  // If status is delivered and progress < 100, snap progress to 100.
  if (data.status === "delivered") data.progress = 100;
  if (data.status === "delivered" && !data.deliveredAt) data.deliveredAt = new Date();
  const [row] = await db.insert(promisesTable).values(data).returning();
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "CREATE",
    target: `promise#${row.id}`,
    detail: row.title.slice(0, 120),
  });
  res.status(201).json({ promise: row });
});

router.put("/admin/promises/:id", requireContentRole, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const parsed = promiseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  const data = parsed.data;
  if (data.status === "delivered") {
    data.progress = 100;
    if (!data.deliveredAt) data.deliveredAt = new Date();
  }
  const [row] = await db.update(promisesTable).set(data).where(eq(promisesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "UPDATE",
    target: `promise#${id}`,
    detail: row.title.slice(0, 120),
  });
  res.json({ promise: row });
});

router.delete("/admin/promises/:id", requireContentRole, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const [row] = await db.delete(promisesTable).where(eq(promisesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "DELETE",
    target: `promise#${id}`,
    detail: row.title.slice(0, 120),
  });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────
// DAILY DIARY — public timeline of today/week/upcoming
// ─────────────────────────────────────────────────────────
router.get("/diary", async (_req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const endOfHorizon = new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [today, past, upcoming] = await Promise.all([
    db.select().from(eventsTable)
      .where(and(gte(eventsTable.eventDate, startOfToday), lte(eventsTable.eventDate, endOfToday)))
      .orderBy(asc(eventsTable.eventDate)),
    db.select().from(eventsTable)
      .where(and(gte(eventsTable.eventDate, startOfWeek), lte(eventsTable.eventDate, startOfToday)))
      .orderBy(desc(eventsTable.eventDate))
      .limit(20),
    db.select().from(eventsTable)
      .where(and(gte(eventsTable.eventDate, endOfToday), lte(eventsTable.eventDate, endOfHorizon)))
      .orderBy(asc(eventsTable.eventDate))
      .limit(20),
  ]);

  // Latest activities (last 7 days) — good "what is the MLA actually doing".
  // Uses activity_date (the actual day the work happened) rather than created_at
  // so backfilled / late-entered records appear in the right slot.
  const recentActivities = await db.select().from(activitiesTable)
    .where(gte(activitiesTable.activityDate, startOfWeek))
    .orderBy(desc(activitiesTable.activityDate))
    .limit(10);

  res.json({
    today,
    pastWeek: past,
    upcoming,
    recentActivities,
    generatedAt: now.toISOString(),
  });
});

// ─────────────────────────────────────────────────────────
// CONSTITUENCY DEVELOPMENT INDEX — composite admin metric
// ─────────────────────────────────────────────────────────
//
// Single 0-100 score made up of four components:
//   - grievance health (% resolved + responsiveness)
//   - delivery (promises kept ratio)
//   - engagement (events + activities last 30 days, normalised)
//   - volunteer base (registered & approved, normalised)
//
// Numbers picked to be transparent, not perfect — UI shows the breakdown.
router.get("/admin/cdi", requireCdiRole, async (_req, res) => {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [grievanceAgg] = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved,
      COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND created_at < NOW() - INTERVAL '7 days')::int AS stale
    FROM grievances
  `)).rows as Array<{ total: number; resolved: number; stale: number }>;

  const [promiseAgg] = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered
    FROM promises
  `)).rows as Array<{ total: number; delivered: number }>;

  const [eventCount] = (await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM events WHERE event_date >= ${monthAgo.toISOString()}
  `)).rows as Array<{ n: number }>;

  const [activityCount] = (await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM activities WHERE activity_date >= ${monthAgo.toISOString()}
  `)).rows as Array<{ n: number }>;

  const [volunteerAgg] = (await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status = 'approved')::int AS approved
    FROM volunteers
  `)).rows as Array<{ approved: number }>;

  const [wardCount] = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM wards`)).rows as Array<{ n: number }>;

  const grievanceTotal = grievanceAgg?.total ?? 0;
  const grievanceResolvedPct = grievanceTotal > 0 ? (grievanceAgg.resolved / grievanceTotal) * 100 : 100;
  const stalePenalty = grievanceTotal > 0 ? Math.min(30, ((grievanceAgg.stale ?? 0) / grievanceTotal) * 100) : 0;
  const grievanceScore = Math.max(0, Math.min(100, grievanceResolvedPct - stalePenalty));

  const promiseTotal = promiseAgg?.total ?? 0;
  const deliveryScore = promiseTotal > 0 ? (promiseAgg.delivered / promiseTotal) * 100 : 50; // neutral until any promises exist

  const wardsN = Math.max(wardCount?.n ?? 1, 1);
  // Engagement target: roughly 1 event + 2 activities per ward per month is "great"
  const targetEvents = wardsN;
  const targetActivities = wardsN * 2;
  const engagementScore = Math.min(100,
    ((eventCount?.n ?? 0) / Math.max(targetEvents, 1)) * 50 +
    ((activityCount?.n ?? 0) / Math.max(targetActivities, 1)) * 50,
  );

  const volunteerTarget = wardsN * 5;
  const volunteerScore = Math.min(100, ((volunteerAgg?.approved ?? 0) / Math.max(volunteerTarget, 1)) * 100);

  // Weighted composite: grievance 35, delivery 30, engagement 20, volunteers 15.
  const cdi = Math.round(
    grievanceScore * 0.35 +
    deliveryScore  * 0.30 +
    engagementScore * 0.20 +
    volunteerScore  * 0.15,
  );

  res.json({
    cdi,
    components: [
      { key: "grievance",  label: "Grievance Health",  score: Math.round(grievanceScore),  weight: 35 },
      { key: "delivery",   label: "Promise Delivery",  score: Math.round(deliveryScore),   weight: 30 },
      { key: "engagement", label: "Engagement",        score: Math.round(engagementScore), weight: 20 },
      { key: "volunteers", label: "Volunteer Base",    score: Math.round(volunteerScore),  weight: 15 },
    ],
    raw: {
      grievanceTotal,
      grievanceResolved: grievanceAgg?.resolved ?? 0,
      grievanceStale: grievanceAgg?.stale ?? 0,
      promiseTotal,
      promiseDelivered: promiseAgg?.delivered ?? 0,
      eventsLast30: eventCount?.n ?? 0,
      activitiesLast30: activityCount?.n ?? 0,
      volunteersApproved: volunteerAgg?.approved ?? 0,
      wards: wardsN,
    },
    generatedAt: now.toISOString(),
  });
});

export default router;
