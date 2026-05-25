// Batch-3 analytics endpoints — pure SQL/JS, no AI calls.
// All routes are admin-only and gated by role.

import { Router, type Response } from "express";
import { db } from "@workspace/db";
import {
  grievancesTable, votersTable, voterContactLogTable, pollingStationsTable, wardsTable,
} from "@workspace/db/schema";
import { and, asc, between, desc, eq, gte, isNotNull, lte, ne } from "drizzle-orm";
import { z } from "zod";
import { requireStaff, requireRole, type AuthRequest } from "../lib/auth.js";

const router = Router();
const requireAnalytics = [requireStaff, requireRole("super_admin", "admin", "pa_staff", "grievance_officer")];
const requireOutreach = [requireStaff, requireRole("super_admin", "admin", "pa_staff", "constituency_coordinator")];

// ─────────────────────────────────────────────────────────────────────────
// SLA targets per category (in hours). Chosen pragmatically; admins can
// tune later. "Others" is the catch-all.
// ─────────────────────────────────────────────────────────────────────────
const SLA_HOURS: Record<string, number> = {
  "Roads": 72,
  "Water Supply": 24,
  "EB / Electricity Issues": 12,
  "Sewage": 24,
  "Healthcare": 6,
  "Education": 72,
  "Women Safety": 4,
  "Corruption": 168,
  "Ration": 72,
  "Transport": 72,
  "Pension": 168,
  "Housing": 168,
  "Agriculture": 72,
  "Employment": 168,
  "Others": 72,
};
const slaFor = (cat: string | null | undefined) => (cat && SLA_HOURS[cat]) || 72;

// Strict YYYY-MM-DD (or ISO) date validator. Rejects malformed input with a
// 400 instead of silently defaulting, and caps the window to MAX_WINDOW_DAYS
// to keep query cost bounded.
const MAX_WINDOW_DAYS = 365;
const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
type DateRange = { from: Date; to: Date };
function parseRange(q: unknown): { ok: true; range: DateRange } | { ok: false; error: string } {
  const parsed = rangeSchema.safeParse(q);
  if (!parsed.success) return { ok: false, error: "Invalid query" };
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from ? new Date(parsed.data.from) : new Date(to.getTime() - 90 * 86400_000);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return { ok: false, error: "Malformed 'from' or 'to' date" };
  if (from.getTime() > to.getTime()) return { ok: false, error: "'from' must be on or before 'to'" };
  const days = (to.getTime() - from.getTime()) / 86400_000;
  if (days > MAX_WINDOW_DAYS) return { ok: false, error: `Range too large; max ${MAX_WINDOW_DAYS} days` };
  return { ok: true, range: { from, to } };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. SLA DASHBOARD
//   Returns per-category target, average actual resolution time, breach
//   counts and rate, plus the worst-overdue currently open tickets.
// ─────────────────────────────────────────────────────────────────────────
router.get("/admin/analytics/sla", requireAnalytics, async (req: AuthRequest, res: Response) => {
  const r = parseRange(req.query);
  if (!r.ok) return res.status(400).json({ error: r.error });
  const { from, to } = r.range;
  // Hard cap to keep memory bounded; in practice 50k grievances/year is well above current scale.
  const SLA_CAP = 50000;
  const rows = await db.select({
    id: grievancesTable.id,
    category: grievancesTable.category,
    status: grievancesTable.status,
    createdAt: grievancesTable.createdAt,
    resolvedAt: grievancesTable.resolvedAt,
  }).from(grievancesTable).where(and(
    gte(grievancesTable.createdAt, from),
    lte(grievancesTable.createdAt, to),
  )).orderBy(desc(grievancesTable.createdAt)).limit(SLA_CAP);

  const now = Date.now();
  type Agg = { target: number; total: number; resolved: number; resolvedHrs: number; breaches: number; openBreaches: number };
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const cat = r.category || "Others";
    const target = slaFor(cat);
    const cur = map.get(cat) ?? { target, total: 0, resolved: 0, resolvedHrs: 0, breaches: 0, openBreaches: 0 };
    cur.total += 1;
    const created = r.createdAt?.getTime() ?? now;
    if (r.resolvedAt) {
      const hrs = (r.resolvedAt.getTime() - created) / 3600_000;
      cur.resolved += 1;
      cur.resolvedHrs += hrs;
      if (hrs > target) cur.breaches += 1;
    } else if (!["Resolved", "Closed"].includes(r.status ?? "")) {
      const ageHrs = (now - created) / 3600_000;
      if (ageHrs > target) { cur.breaches += 1; cur.openBreaches += 1; }
    }
    map.set(cat, cur);
  }

  const byCategory = Array.from(map.entries()).map(([category, v]) => ({
    category,
    slaTargetHours: v.target,
    total: v.total,
    resolved: v.resolved,
    avgResolutionHours: v.resolved ? Math.round((v.resolvedHrs / v.resolved) * 10) / 10 : null,
    breachCount: v.breaches,
    openBreachCount: v.openBreaches,
    breachRate: v.total ? Math.round((v.breaches / v.total) * 1000) / 10 : 0,
  })).sort((a, b) => b.breachRate - a.breachRate);

  // Pull the oldest open tickets — those most likely to be the worst overdue.
  // We cap to 5000 to bound memory; ranking by overdue hours is done in JS
  // because target hours vary per category.
  const openRows = await db.select({
    id: grievancesTable.id,
    ticketNo: grievancesTable.ticketNo,
    name: grievancesTable.name,
    category: grievancesTable.category,
    priority: grievancesTable.priority,
    status: grievancesTable.status,
    ward: grievancesTable.ward,
    createdAt: grievancesTable.createdAt,
    assignedTo: grievancesTable.assignedTo,
  }).from(grievancesTable).where(and(
    ne(grievancesTable.status, "Resolved"),
    ne(grievancesTable.status, "Closed"),
  )).orderBy(asc(grievancesTable.createdAt)).limit(5000);

  const overdue = openRows.map((r) => {
    const target = slaFor(r.category);
    const ageHrs = (now - (r.createdAt?.getTime() ?? now)) / 3600_000;
    const overdueHrs = Math.max(0, ageHrs - target);
    return { ...r, slaTargetHours: target, ageHours: Math.round(ageHrs * 10) / 10, overdueHours: Math.round(overdueHrs * 10) / 10 };
  }).filter((r) => r.overdueHours > 0)
    .sort((a, b) => b.overdueHours - a.overdueHours)
    .slice(0, 20);

  const totals = byCategory.reduce((a, c) => {
    a.total += c.total; a.resolved += c.resolved;
    a.breaches += c.breachCount; a.openBreaches += c.openBreachCount;
    return a;
  }, { total: 0, resolved: 0, breaches: 0, openBreaches: 0 });

  res.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    truncated: rows.length >= SLA_CAP,
    summary: {
      ...totals,
      breachRate: totals.total ? Math.round((totals.breaches / totals.total) * 1000) / 10 : 0,
      resolutionRate: totals.total ? Math.round((totals.resolved / totals.total) * 1000) / 10 : 0,
    },
    byCategory,
    overdue,
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. PREDICTIVE ESCALATION
//   Rule-based scoring. Score = ageRatio * priorityWeight * statusWeight.
//   "ageRatio" = age / slaTarget so a 4-hr Women-Safety ticket at 2 hrs
//   ranks above a 7-day Pension ticket at 3 days.
// ─────────────────────────────────────────────────────────────────────────
const PRIO_W: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
const STAT_W: Record<string, number> = {
  "Submitted": 2.0, "Under Review": 1.8, "Assigned": 1.4, "In Progress": 1.0,
};

router.get("/admin/analytics/escalations", requireAnalytics, async (_req: AuthRequest, res: Response) => {
  const ESC_CAP = 10000;
  const rows = await db.select({
    id: grievancesTable.id,
    ticketNo: grievancesTable.ticketNo,
    name: grievancesTable.name,
    phone: grievancesTable.phone,
    category: grievancesTable.category,
    aiCategory: grievancesTable.aiCategory,
    priority: grievancesTable.priority,
    aiPriority: grievancesTable.aiPriority,
    status: grievancesTable.status,
    ward: grievancesTable.ward,
    createdAt: grievancesTable.createdAt,
    assignedTo: grievancesTable.assignedTo,
    aiSummary: grievancesTable.aiSummary,
  }).from(grievancesTable).where(and(
    ne(grievancesTable.status, "Resolved"),
    ne(grievancesTable.status, "Closed"),
  )).orderBy(asc(grievancesTable.createdAt)).limit(ESC_CAP);

  const now = Date.now();
  const scored = rows.map((r) => {
    const effectivePrio = r.aiPriority || r.priority || "Medium";
    const effectiveCat  = r.aiCategory  || r.category  || "Others";
    const target = slaFor(effectiveCat);
    const ageHrs = (now - (r.createdAt?.getTime() ?? now)) / 3600_000;
    const ageRatio = ageHrs / target;
    const score = ageRatio * (PRIO_W[effectivePrio] ?? 2) * (STAT_W[r.status ?? ""] ?? 1);
    const reasons: string[] = [];
    if (ageHrs > target) reasons.push("SLA breached");
    else if (ageRatio > 0.75) reasons.push("Nearing SLA");
    if (effectivePrio === "Urgent" || effectivePrio === "High") reasons.push(`${effectivePrio} priority`);
    if (!r.assignedTo) reasons.push("Unassigned");
    if (r.status === "Submitted") reasons.push("Awaiting triage");
    return { ...r, effectivePriority: effectivePrio, effectiveCategory: effectiveCat,
      slaTargetHours: target, ageHours: Math.round(ageHrs * 10) / 10,
      riskScore: Math.round(score * 100) / 100, reasons };
  });

  const ranked = scored.sort((a, b) => b.riskScore - a.riskScore);
  const high = ranked.filter((r) => r.riskScore >= 2).slice(0, 50);
  const summary = {
    totalOpen: ranked.length,
    breached: ranked.filter((r) => r.ageHours > r.slaTargetHours).length,
    highRisk: ranked.filter((r) => r.riskScore >= 2).length,
    unassigned: ranked.filter((r) => !r.assignedTo).length,
  };
  res.json({ summary, items: high, truncated: rows.length >= ESC_CAP });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. VOTER OUTREACH SCORECARD
//   Aggregates voter_contact_log per worker, per ward, per week.
// ─────────────────────────────────────────────────────────────────────────
router.get("/admin/analytics/outreach", requireOutreach, async (req: AuthRequest, res: Response) => {
  const r = parseRange(req.query);
  if (!r.ok) return res.status(400).json({ error: r.error });
  const { from, to } = r.range;
  const OUTREACH_CAP = 50000;

  // Pull recent logs in range; join voter for ward context.
  const rows = await db.select({
    id: voterContactLogTable.id,
    voterId: voterContactLogTable.voterId,
    contactType: voterContactLogTable.contactType,
    outcome: voterContactLogTable.outcome,
    contactedAt: voterContactLogTable.contactedAt,
    contactedBy: voterContactLogTable.contactedBy,
    contactedByName: voterContactLogTable.contactedByName,
    // Voters have no direct ward column — derive it via polling_station → wards.
    ward: wardsTable.name,
  }).from(voterContactLogTable)
    .leftJoin(votersTable, eq(voterContactLogTable.voterId, votersTable.id))
    .leftJoin(pollingStationsTable, eq(votersTable.pollingStationId, pollingStationsTable.id))
    .leftJoin(wardsTable, eq(pollingStationsTable.wardId, wardsTable.id))
    .where(between(voterContactLogTable.contactedAt, from, to))
    .orderBy(desc(voterContactLogTable.contactedAt))
    .limit(OUTREACH_CAP);

  type WorkerStat = {
    workerId: number | null;
    workerName: string;
    total: number;
    reached: number;
    pledges: number;
    refused: number;
    issues: number;
    byType: Record<string, number>;
  };
  const workerMap = new Map<string, WorkerStat>();
  const wardMap = new Map<string, { ward: string; total: number; reached: number; pledges: number }>();
  const weekMap = new Map<string, { week: string; total: number; reached: number; pledges: number }>();

  const weekKey = (d: Date) => {
    // ISO-week-ish key: year + week-of-year (UTC-anchored, good enough for charts).
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400_000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  };

  for (const r of rows) {
    const key = `${r.contactedBy ?? "x"}|${r.contactedByName}`;
    const w = workerMap.get(key) ?? {
      workerId: r.contactedBy, workerName: r.contactedByName,
      total: 0, reached: 0, pledges: 0, refused: 0, issues: 0, byType: {},
    };
    w.total++;
    w.byType[r.contactType] = (w.byType[r.contactType] ?? 0) + 1;
    if (r.outcome === "reached" || r.outcome === "promised_support" || r.outcome === "issue_logged" || r.outcome === "scheduled_followup") w.reached++;
    if (r.outcome === "promised_support") w.pledges++;
    if (r.outcome === "refused") w.refused++;
    if (r.outcome === "issue_logged") w.issues++;
    workerMap.set(key, w);

    if (r.ward) {
      const ww = wardMap.get(r.ward) ?? { ward: r.ward, total: 0, reached: 0, pledges: 0 };
      ww.total++;
      if (r.outcome === "reached" || r.outcome === "promised_support" || r.outcome === "issue_logged") ww.reached++;
      if (r.outcome === "promised_support") ww.pledges++;
      wardMap.set(r.ward, ww);
    }

    if (r.contactedAt) {
      const wk = weekKey(r.contactedAt);
      const cur = weekMap.get(wk) ?? { week: wk, total: 0, reached: 0, pledges: 0 };
      cur.total++;
      if (r.outcome === "reached" || r.outcome === "promised_support" || r.outcome === "issue_logged") cur.reached++;
      if (r.outcome === "promised_support") cur.pledges++;
      weekMap.set(wk, cur);
    }
  }

  const workers = Array.from(workerMap.values())
    .map((w) => ({ ...w, reachRate: w.total ? Math.round((w.reached / w.total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total).slice(0, 50);
  const wards = Array.from(wardMap.values()).sort((a, b) => b.total - a.total).slice(0, 50);
  const weekly = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week));

  const totals = rows.reduce((a, r) => {
    a.total++;
    if (["reached", "promised_support", "issue_logged"].includes(r.outcome ?? "")) a.reached++;
    if (r.outcome === "promised_support") a.pledges++;
    return a;
  }, { total: 0, reached: 0, pledges: 0 });

  res.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    truncated: rows.length >= OUTREACH_CAP,
    summary: { ...totals, reachRate: totals.total ? Math.round((totals.reached / totals.total) * 1000) / 10 : 0 },
    workers, wards, weekly,
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. HEATMAP + TIME SLIDER
//   Returns geo-points bucketed by ISO week so the frontend can slide
//   through history without making 50 round-trips.
// ─────────────────────────────────────────────────────────────────────────
router.get("/admin/analytics/heatmap-timeline", requireAnalytics, async (req: AuthRequest, res: Response) => {
  const r = parseRange(req.query);
  if (!r.ok) return res.status(400).json({ error: r.error });
  const { from, to } = r.range;
  const HEAT_CAP = 20000;
  const rows = await db.select({
    lat: grievancesTable.latitude,
    lng: grievancesTable.longitude,
    category: grievancesTable.category,
    priority: grievancesTable.priority,
    createdAt: grievancesTable.createdAt,
  }).from(grievancesTable).where(and(
    gte(grievancesTable.createdAt, from),
    lte(grievancesTable.createdAt, to),
    isNotNull(grievancesTable.latitude),
    isNotNull(grievancesTable.longitude),
  )).orderBy(desc(grievancesTable.createdAt)).limit(HEAT_CAP);

  const weekKey = (d: Date) => {
    // ISO-week start (Monday) — stable bucket label.
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 1);
    return tmp.toISOString().slice(0, 10);
  };

  type Bucket = { week: string; points: Map<string, { lat: number; lng: number; weight: number; categories: Record<string, number> }> };
  const weeks = new Map<string, Bucket>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null || !r.createdAt) continue;
    const wk = weekKey(r.createdAt);
    let bucket = weeks.get(wk);
    if (!bucket) { bucket = { week: wk, points: new Map() }; weeks.set(wk, bucket); }
    const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
    const cur = bucket.points.get(key) ?? { lat: r.lat, lng: r.lng, weight: 0, categories: {} };
    cur.weight++;
    if (r.category) cur.categories[r.category] = (cur.categories[r.category] ?? 0) + 1;
    bucket.points.set(key, cur);
  }

  const timeline = Array.from(weeks.values())
    .map((b) => ({ week: b.week, points: Array.from(b.points.values()) }))
    .sort((a, b) => a.week.localeCompare(b.week));

  res.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    truncated: rows.length >= HEAT_CAP,
    totalPoints: rows.length,
    weeks: timeline.map((t) => t.week),
    timeline,
  });
});

export default router;
