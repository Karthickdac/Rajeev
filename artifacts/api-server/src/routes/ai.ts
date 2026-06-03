import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  grievancesTable, grievanceRemarksTable, pressCoverageTable, siteConfigTable, faqsTable,
  newsTable, eventsTable, promisesTable, auditLogTable, appointmentsTable,
} from "@workspace/db/schema";
import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireStaff, requireRole, type AuthRequest } from "../lib/auth.js";
import { hasOpenAI, chat, chatJson, embed, cosineSimilarity, type ChatMessage } from "../lib/ai.js";
import { loadAiSettings, resolvePrompt } from "../lib/ai-settings.js";

const router = Router();
// Grievance-related AI tools — grievance officers may use these.
const requireContent = [requireStaff, requireRole("super_admin", "admin", "pa_staff", "media_team", "grievance_officer")];
// Media-only tools (press release, sentiment, press coverage) — keep aligned with admin nav RBAC.
const requireMedia = [requireStaff, requireRole("super_admin", "admin", "pa_staff", "media_team")];

// ─────────────────────────────────────────────────────────
// Status — frontend can hide AI features if no key configured.
// ─────────────────────────────────────────────────────────
router.get("/ai/status", (_req, res) => {
  res.json({ enabled: hasOpenAI() });
});

// ─────────────────────────────────────────────────────────
// 1. AI grievance triage — classify category/priority + draft Tamil summary
// ─────────────────────────────────────────────────────────
const TRIAGE_CATEGORIES = [
  "Roads", "Water Supply", "EB / Electricity Issues", "Sewage", "Healthcare",
  "Education", "Women Safety", "Corruption", "Ration", "Transport", "Pension",
  "Housing", "Agriculture", "Employment", "Others",
];

interface TriageResult {
  category: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  summary_en: string;
  summary_ta: string;
  suggested_route: string;
  sentiment: "positive" | "neutral" | "negative";
  sentiment_score: number;
}

export async function triageGrievance(id: number): Promise<TriageResult | null> {
  if (!hasOpenAI()) return null;
  const settings = await loadAiSettings();
  if (!settings.featureToggles.autoTriage) return null;
  const [g] = await db.select().from(grievancesTable).where(eq(grievancesTable.id, id));
  if (!g) return null;
  const defaultPrompt = `You are an assistant for the constituency office of D. Sarath Kumar, Minister (TVK party), MLA of Tambaram Constituency, Chengalpattu District. Classify citizen grievances and gauge the citizen's sentiment toward the administration from the complaint text. Respond ONLY with strict JSON matching this shape: {"category": one of [${TRIAGE_CATEGORIES.map((c) => `"${c}"`).join(", ")}], "priority": one of ["Low","Medium","High","Urgent"], "summary_en": <50-word English summary>, "summary_ta": <50-word Tamil summary>, "suggested_route": <short suggestion for which department/officer should handle this>, "sentiment": one of ["positive","neutral","negative"], "sentiment_score": <integer -100..100, negative = angry/distressed, positive = appreciative>}. Use "Urgent" only for safety, health, or active danger. Tamil text must be in Tamil script.`;
  const systemMsg: ChatMessage = { role: "system", content: resolvePrompt(settings.promptTemplates.triage, defaultPrompt) };
  const userMsg: ChatMessage = {
    role: "user",
    content: `Citizen: ${g.name}\nWard: ${g.ward ?? "n/a"}\nCategory submitted: ${g.category}\nComplaint:\n${g.description}`,
  };
  const result = await chatJson<TriageResult>([systemMsg, userMsg], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
  let vec: number[] | null = null;
  try {
    vec = await embed(`${g.category}\n${g.description}`);
  } catch { /* embedding is optional — don't fail triage if it errors */ }
  const sentiment = ["positive", "neutral", "negative"].includes(result.sentiment) ? result.sentiment : "neutral";
  const sentimentScore = Number.isFinite(result.sentiment_score) ? Math.min(100, Math.max(-100, Math.round(result.sentiment_score))) : 0;
  await db.update(grievancesTable).set({
    aiCategory: result.category,
    aiPriority: result.priority,
    // Spec: auto-triage sets the working `priority` (not just the AI shadow column).
    priority: result.priority,
    aiSummary: result.summary_en,
    aiSummaryTa: result.summary_ta,
    aiSuggestedRoute: result.suggested_route,
    aiSentiment: sentiment,
    aiSentimentScore: sentimentScore,
    aiEmbedding: vec ? JSON.stringify(vec) : undefined,
    aiTriagedAt: new Date(),
  }).where(eq(grievancesTable.id, id));
  return result;
}

router.post("/admin/ai/triage-grievance/:id", requireContent, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const settings = await loadAiSettings();
  if (!settings.featureToggles.autoTriage) return res.status(403).json({ error: "Grievance triage is disabled in AI settings" });
  try {
    const result = await triageGrievance(id);
    if (!result) return res.status(404).json({ error: "Grievance not found" });
    await db.insert(auditLogTable).values({
      actorId: req.user?.id ?? null,
      actorName: req.user?.name ?? "system",
      action: "AI_TRIAGE",
      target: `grievance#${id}`,
      detail: `${result.category} / ${result.priority}`,
    });
    res.json({ triage: result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Triage failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 2. Duplicate / related grievance clustering (cosine similarity over embeddings)
// ─────────────────────────────────────────────────────────
router.get("/admin/grievances/:id/similar", requireContent, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  const threshold = Math.max(0.5, Math.min(0.99, Number(req.query.threshold) || 0.78));

  const [seed] = await db.select().from(grievancesTable).where(eq(grievancesTable.id, id));
  if (!seed) return res.status(404).json({ error: "Grievance not found" });

  let seedVec: number[] | null = seed.aiEmbedding ? safeParseVec(seed.aiEmbedding) : null;
  if (!seedVec && hasOpenAI()) {
    try {
      seedVec = await embed(`${seed.category}\n${seed.description}`);
      await db.update(grievancesTable).set({ aiEmbedding: JSON.stringify(seedVec) }).where(eq(grievancesTable.id, id));
    } catch { /* fall through to keyword fallback */ }
  }

  if (!seedVec) {
    // Fallback: simple category match (handy if no AI key). Spec: surface only
    // previously resolved/closed cases so the officer gets a usable template.
    const rows = await db.select({
      id: grievancesTable.id, ticketNo: grievancesTable.ticketNo, name: grievancesTable.name,
      category: grievancesTable.category, description: grievancesTable.description,
      status: grievancesTable.status, createdAt: grievancesTable.createdAt,
    }).from(grievancesTable).where(and(
      ne(grievancesTable.id, id),
      eq(grievancesTable.category, seed.category),
      inArray(grievancesTable.status, ["Resolved", "Closed"]),
    )).orderBy(desc(grievancesTable.createdAt)).limit(limit);
    return res.json({ similar: rows.map((r) => ({ ...r, score: null })), resolvedTemplate: null, mode: "fallback-category" });
  }

  // Pull only rows that already have an embedding (efficient subset).
  const candidates = await db.select({
    id: grievancesTable.id, ticketNo: grievancesTable.ticketNo, name: grievancesTable.name,
    category: grievancesTable.category, description: grievancesTable.description,
    status: grievancesTable.status, createdAt: grievancesTable.createdAt,
    aiEmbedding: grievancesTable.aiEmbedding,
  }).from(grievancesTable).where(and(ne(grievancesTable.id, id), isNotNull(grievancesTable.aiEmbedding))).limit(2000);

  const allScored = candidates.map((c) => {
    const v = safeParseVec(c.aiEmbedding);
    const score = v ? cosineSimilarity(seedVec!, v) : 0;
    return { ...c, aiEmbedding: undefined, score };
  }).filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // Spec: the panel shows the top previously resolved/closed similar cases.
  const scored = allScored.filter((c) => c.status === "Resolved" || c.status === "Closed").slice(0, limit);

  // Resolution template: surface how the most similar already-resolved case was
  // handled, so the officer can reuse a proven remark.
  let resolvedTemplate: { grievanceId: number; ticketNo: string; score: number; remark: string } | null = null;
  const topResolved = allScored.find((c) => c.status === "Resolved" || c.status === "Closed");
  if (topResolved) {
    const [rem] = await db.select({ remark: grievanceRemarksTable.remark })
      .from(grievanceRemarksTable)
      .where(eq(grievanceRemarksTable.grievanceId, topResolved.id))
      .orderBy(desc(grievanceRemarksTable.createdAt)).limit(1);
    if (rem?.remark) {
      resolvedTemplate = { grievanceId: topResolved.id, ticketNo: topResolved.ticketNo, score: topResolved.score, remark: rem.remark };
    }
  }

  res.json({ similar: scored, resolvedTemplate, mode: "embedding" });
});

function safeParseVec(s: string | null): number[] | null {
  if (!s) return null;
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : null; } catch { return null; }
}

// ─────────────────────────────────────────────────────────
// 3. Press release generator
// ─────────────────────────────────────────────────────────
router.post("/admin/ai/press-release", requireMedia, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const schema = z.object({
    bullets: z.string().min(10).max(4000),
    tone: z.enum(["formal", "warm", "celebratory", "urgent"]).default("formal"),
    audience: z.string().max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  const { bullets, tone, audience } = parsed.data;
  const settings = await loadAiSettings();
  if (!settings.featureToggles.pressRelease) return res.status(403).json({ error: "Press release generator is disabled in AI settings." });
  const defaultPrompt = `You write press releases for D. Sarath Kumar, Minister for Human Resources Management and Ex-Servicemen Welfare (TVK party), MLA of Tambaram Constituency, Chengalpattu District, Tamil Nadu. Respond ONLY with strict JSON {"title_en":"…","title_ta":"…","body_en":"…","body_ta":"…"}. Body should be 4-6 short paragraphs, ${tone} tone${audience ? `, written for ${audience}` : ""}. Use proper Tamil script for Tamil fields. End the body with a quote attributed to the Minister.`;
  try {
    const result = await chatJson<{ title_en: string; title_ta: string; body_en: string; body_ta: string }>([
      { role: "system", content: resolvePrompt(settings.promptTemplates.pressRelease, defaultPrompt) },
      { role: "user", content: `Key points to cover:\n${bullets}` },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    res.json({ release: result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Generation failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 4. Sentiment / mention analyzer — paste any text, get classification + reply suggestion
// ─────────────────────────────────────────────────────────
router.post("/admin/ai/sentiment", requireMedia, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const schema = z.object({ text: z.string().min(1).max(4000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const aSettings = await loadAiSettings();
  try {
    const result = await chatJson<{
      sentiment: "positive" | "neutral" | "negative" | "mixed";
      score: number; topics: string[]; summary: string;
      suggested_reply_en: string; suggested_reply_ta: string;
    }>([
      { role: "system", content: `Analyze a social media comment about D. Sarath Kumar, Minister and MLA of Tambaram Constituency. Return strict JSON: {"sentiment":"positive|neutral|negative|mixed","score":-100..100,"topics":[…short tags],"summary":"<1-sentence English>","suggested_reply_en":"<polite, factual reply in English>","suggested_reply_ta":"<polite Tamil reply in Tamil script>"}. Replies should be brief (≤ 2 sentences), de-escalating if negative, gracious if positive.` },
      { role: "user", content: parsed.data.text },
    ], { model: aSettings.modelName, temperature: aSettings.temperature, maxTokens: aSettings.maxTokens });
    res.json({ analysis: result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Analysis failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 5. Public Tamil chatbot — answers questions using site CMS as context
// ─────────────────────────────────────────────────────────

// In-memory chat rate limit. Per-IP limit guards casual abuse; a global
// counter guards against IP spoofing / many-source flooding so the OpenAI
// bill is bounded even when individual buckets are evaded.
const chatBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 5000;       // hard cap on map size — prevents memory growth from spoofed IPs
const PER_IP_LIMIT = 20;        // 20 msgs per 10-min window per IP
const PER_IP_WINDOW_MS = 10 * 60 * 1000;
let globalWindowStart = Date.now();
let globalCount = 0;
const GLOBAL_LIMIT = 400;       // ≤ 400 chat completions per 10-min across all callers
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;

function clientIp(req: Request): string {
  // Use the socket address. We do NOT trust x-forwarded-for headers because
  // Express isn't configured with trust-proxy here, so any client could spoof
  // them and bypass the per-IP bucket.
  return req.socket.remoteAddress ?? "unknown";
}

function rateLimitOk(ip: string): "ok" | "perip" | "global" {
  const now = Date.now();
  // Global window check first.
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) { globalWindowStart = now; globalCount = 0; }
  if (globalCount >= GLOBAL_LIMIT) return "global";

  // Opportunistic eviction when the map gets large.
  if (chatBuckets.size > MAX_BUCKETS) {
    for (const [k, v] of chatBuckets) if (now > v.resetAt) chatBuckets.delete(k);
    // If still too large, drop oldest entries.
    if (chatBuckets.size > MAX_BUCKETS) {
      const keys = Array.from(chatBuckets.keys()).slice(0, chatBuckets.size - MAX_BUCKETS);
      for (const k of keys) chatBuckets.delete(k);
    }
  }

  const b = chatBuckets.get(ip);
  if (!b || now > b.resetAt) {
    chatBuckets.set(ip, { count: 1, resetAt: now + PER_IP_WINDOW_MS });
    globalCount++;
    return "ok";
  }
  if (b.count >= PER_IP_LIMIT) return "perip";
  b.count++;
  globalCount++;
  return "ok";
}

// Cache the site context so we don't re-query CMS per message.
let cachedContext: { text: string; expires: number } | null = null;
async function buildSiteContext(): Promise<string> {
  if (cachedContext && Date.now() < cachedContext.expires) return cachedContext.text;
  const [about, contacts, emergency, faqs, news, events, promises] = await Promise.all([
    db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "about")).limit(1),
    db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "contact_info")).limit(1),
    db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "emergency_contacts")).limit(1),
    db.select({ q: faqsTable.question, a: faqsTable.answer, qTa: faqsTable.questionTa, aTa: faqsTable.answerTa })
      .from(faqsTable).limit(40),
    db.select({ title: newsTable.title, titleTa: newsTable.titleTa, content: newsTable.content })
      .from(newsTable).orderBy(desc(newsTable.publishedAt)).limit(10),
    db.select({ title: eventsTable.title, venue: eventsTable.venue, date: eventsTable.eventDate })
      .from(eventsTable).orderBy(desc(eventsTable.eventDate)).limit(10),
    db.select({ title: promisesTable.title, status: promisesTable.status, progress: promisesTable.progress })
      .from(promisesTable).limit(30),
  ]);
  const lines: string[] = [
    "# About the MLA",
    JSON.stringify(about[0]?.value ?? {}),
    "\n# Contact",
    JSON.stringify(contacts[0]?.value ?? {}),
    "\n# Emergency contacts",
    JSON.stringify(emergency[0]?.value ?? {}),
    "\n# FAQs",
    ...faqs.map((f) => `Q: ${f.q}\nA: ${f.a}\n(Tamil: ${f.qTa ?? ""} / ${f.aTa ?? ""})`),
    "\n# Recent News",
    ...news.map((n) => `- ${n.title} :: ${(n.content ?? "").slice(0, 200)}`),
    "\n# Upcoming Events",
    ...events.map((e) => `- ${new Date(e.date).toISOString().slice(0, 10)} ${e.title} @ ${e.venue}`),
    "\n# Promises tracker",
    ...promises.map((p) => `- [${p.status} ${p.progress}%] ${p.title}`),
  ];
  const text = lines.join("\n").slice(0, 12000);
  cachedContext = { text, expires: Date.now() + 5 * 60 * 1000 };
  return text;
}

router.post("/chat", async (req: Request, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "Chatbot unavailable" });
  const verdict = rateLimitOk(clientIp(req));
  if (verdict === "perip") return res.status(429).json({ error: "Too many messages from this device. Please wait a few minutes." });
  if (verdict === "global") return res.status(429).json({ error: "Assistant is busy. Please try again shortly." });
  const schema = z.object({
    message: z.string().min(1).max(800),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(10).optional(),
    lang: z.enum(["en", "ta"]).default("ta"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const { message, history = [], lang } = parsed.data;
  const settings = await loadAiSettings();
  try {
    const ctx = await buildSiteContext();
    const sys: ChatMessage = {
      role: "system",
      content: `You are the friendly assistant for the official website of D. Sarath Kumar — Minister for Human Resources Management and Ex-Servicemen Welfare (TVK party), MLA of Tambaram Constituency, Chengalpattu District, Tamil Nadu.

Default to ${lang === "ta" ? "Tamil (Tamil script)" : "English"}, but mirror the user's language if they switch. Keep replies short (2-4 sentences). Be warm and respectful.

If the user wants to file a complaint, ask them to visit /grievance. For emergencies, point them to /emergency. To volunteer, /volunteer. To donate, /donate. To track a complaint, /grievance.

Answer ONLY from the context below. If something is not in the context, say you don't have that information and suggest they call the office.

---SITE CONTEXT---
${ctx}
---END CONTEXT---`,
    };
    const reply = await chat([sys, ...history.map((h) => ({ role: h.role, content: h.content }) as ChatMessage), { role: "user", content: message }], {
      model: settings.modelName, temperature: settings.temperature, maxTokens: 350,
    });
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Chat failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 6. Press coverage tracker — public list + admin manage + Google News ingest
// ─────────────────────────────────────────────────────────
router.get("/press-coverage", async (_req, res) => {
  const rows = await db.select().from(pressCoverageTable)
    .orderBy(desc(pressCoverageTable.publishedAt))
    .limit(100);
  res.json({ items: rows });
});

router.get("/admin/press-coverage", requireMedia, async (_req, res) => {
  const rows = await db.select().from(pressCoverageTable)
    .orderBy(desc(pressCoverageTable.publishedAt))
    .limit(200);
  res.json({ items: rows });
});

router.delete("/admin/press-coverage/:id", requireMedia, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  await db.delete(pressCoverageTable).where(eq(pressCoverageTable.id, id));
  res.json({ ok: true });
});

// Pull latest mentions from Google News RSS (no API key needed). Summarises
// each new article with the LLM if a key is configured.
router.post("/admin/press-coverage/refresh", requireMedia, async (req: AuthRequest, res) => {
  const schema = z.object({ query: z.string().min(2).max(200).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const q = parsed.data.query || "\"Sarath Kumar\" OR \"Tambaram MLA\" OR TVK";
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const settings = await loadAiSettings();
  try {
    const xml = await (await fetch(rssUrl)).text();
    const items = parseRssItems(xml).slice(0, 25);
    let added = 0, skipped = 0;
    for (const it of items) {
      const existing = await db.select({ id: pressCoverageTable.id }).from(pressCoverageTable)
        .where(eq(pressCoverageTable.url, it.url)).limit(1);
      if (existing.length) { skipped++; continue; }
      let summaryEn: string | null = null;
      let summaryTa: string | null = null;
      let sentiment: string | null = null;
      let sentimentScore: number | null = null;
      let topics: string | null = null;
      if (hasOpenAI()) {
        try {
          const ai = await chatJson<{ summary_en: string; summary_ta: string; sentiment: string; score: number; topics: string[] }>([
            { role: "system", content: `Summarise this news article about an Indian politician in 2 sentences (English + Tamil) and classify sentiment. Return strict JSON: {"summary_en":"…","summary_ta":"…","sentiment":"positive|neutral|negative|mixed","score":-100..100,"topics":[…]}` },
            { role: "user", content: `Source: ${it.source}\nTitle: ${it.title}\nSnippet: ${it.snippet}` },
          ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
          summaryEn = ai.summary_en; summaryTa = ai.summary_ta;
          sentiment = ai.sentiment; sentimentScore = ai.score;
          topics = (ai.topics || []).join(",");
        } catch { /* keep raw entry even if AI summarisation fails */ }
      }
      await db.insert(pressCoverageTable).values({
        source: it.source, title: it.title, url: it.url, snippet: it.snippet,
        summaryEn, summaryTa, sentiment, sentimentScore, topics,
        publishedAt: it.publishedAt,
      });
      added++;
    }
    await db.insert(auditLogTable).values({
      actorId: req.user?.id ?? null,
      actorName: req.user?.name ?? "system",
      action: "PRESS_REFRESH",
      target: "press_coverage",
      detail: `+${added} new, ${skipped} dup (query: ${q.slice(0, 60)})`,
    });
    res.json({ added, skipped, total: items.length });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Refresh failed" });
  }
});

// Minimal RSS parser — Google News RSS items are flat enough that regex is fine.
function parseRssItems(xml: string): Array<{ title: string; url: string; snippet: string; source: string; publishedAt: Date | null }> {
  const items: Array<{ title: string; url: string; snippet: string; source: string; publishedAt: Date | null }> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const pick = (tag: string) => {
      const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return r ? decodeEntities(stripCdata(r[1])) : "";
    };
    const title = pick("title");
    const link = pick("link");
    const description = pick("description");
    const pubDate = pick("pubDate");
    const source = pick("source") || (description.match(/<font[^>]*>([^<]+)<\/font>/)?.[1] ?? "Google News");
    const snippet = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
    if (title && link) {
      items.push({
        title, url: link, snippet, source,
        publishedAt: pubDate ? new Date(pubDate) : null,
      });
    }
  }
  return items;
}
function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}

// ─────────────────────────────────────────────────────────
// In-memory usage log ring buffer (last 50 AI calls)
// ─────────────────────────────────────────────────────────
interface UsageEntry { ts: string; feature: string; inLen: number; outLen: number; latencyMs: number }
const usageLog: UsageEntry[] = [];
function logUsage(feature: string, inLen: number, outLen: number, latencyMs: number) {
  usageLog.push({ ts: new Date().toISOString(), feature, inLen, outLen, latencyMs });
  if (usageLog.length > 50) usageLog.shift();
}

router.get("/admin/ai/usage-log", requireStaff, (_req, res) => {
  res.json({ items: [...usageLog].reverse() });
});

// ─────────────────────────────────────────────────────────
// 7. Resolution suggestion for a grievance
// ─────────────────────────────────────────────────────────
router.post("/admin/grievances/:id/suggest-resolution", requireContent, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const settings = await loadAiSettings();
  if (!settings.featureToggles.resolutionSuggestion) return res.status(403).json({ error: "Resolution suggestions are disabled in AI settings." });
  const [g] = await db.select().from(grievancesTable).where(eq(grievancesTable.id, id));
  if (!g) return res.status(404).json({ error: "Grievance not found" });
  const remarks = await db.select({ remark: grievanceRemarksTable.remark })
    .from(grievanceRemarksTable).where(eq(grievanceRemarksTable.grievanceId, id))
    .orderBy(desc(grievanceRemarksTable.createdAt)).limit(5);
  const defaultPrompt = `You are an expert assistant for the constituency office of D. Sarath Kumar, Minister and MLA of Tambaram Constituency, Chengalpattu District. Suggest a concrete resolution plan for a citizen grievance. Respond ONLY with strict JSON: {"resolution_en":"<concise English plan>","resolution_ta":"<same in Tamil script>","steps":["<action 1>","<action 2>",…],"department":"<responsible government dept>","expected_days":<estimated calendar days>}. Tamil must use proper Tamil script. Keep steps short and actionable.`;
  const t0 = Date.now();
  try {
    const result = await chatJson<{ resolution_en: string; resolution_ta: string; steps: string[]; department: string; expected_days: number }>([
      { role: "system", content: resolvePrompt(settings.promptTemplates.resolution, defaultPrompt) },
      { role: "user", content: `Category: ${g.category}\nAI Category: ${g.aiCategory ?? "n/a"}\nPriority: ${g.aiPriority ?? g.priority}\nComplaint:\n${g.description}\n\nExisting remarks:\n${remarks.map((r) => `- ${r.remark}`).join("\n") || "None"}` },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    logUsage("suggest-resolution", (g.description ?? "").length, JSON.stringify(result).length, Date.now() - t0);
    res.json({ suggestion: result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 8. Sentiment trend — daily public-sentiment aggregation over grievance text.
// Uses AI-classified aiSentiment when present, else derives a proxy from the
// triaged/submitted priority so the chart is populated even without an API key.
// ─────────────────────────────────────────────────────────
router.get("/admin/analytics/sentiment-trend", requireMedia, async (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Effective per-grievance sentiment: AI value first, else priority-derived.
  const sentimentExpr = sql<string>`COALESCE(${grievancesTable.aiSentiment}, CASE WHEN ${grievancesTable.priority} IN ('Urgent','High') THEN 'negative' WHEN ${grievancesTable.priority} = 'Low' THEN 'positive' ELSE 'neutral' END)`;
  const scoreExpr = sql<number>`COALESCE(${grievancesTable.aiSentimentScore}, CASE WHEN ${grievancesTable.priority} IN ('Urgent','High') THEN -50 WHEN ${grievancesTable.priority} = 'Low' THEN 40 ELSE 0 END)`;
  try {
    const rows = await db.select({
      day: sql<string>`date_trunc('day', ${grievancesTable.createdAt})::date::text`,
      sentiment: sql<string>`${sentimentExpr}`,
      score: sql<number>`avg(${scoreExpr})::numeric(5,1)`,
      n: sql<number>`count(*)::int`,
    })
      .from(grievancesTable)
      .where(gte(grievancesTable.createdAt, since))
      .groupBy(sql`date_trunc('day', ${grievancesTable.createdAt})`, sentimentExpr)
      .orderBy(sql`date_trunc('day', ${grievancesTable.createdAt})`);

    const byDay = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const key = r.day;
      if (!byDay.has(key)) byDay.set(key, { positive: 0, neutral: 0, negative: 0, mixed: 0, avgScore: 0, _total: 0 });
      const d = byDay.get(key)!;
      const sentiment = r.sentiment ?? "neutral";
      if (sentiment in d) d[sentiment] = r.n;
      const prevTotal = d._total;
      const score = Number(r.score) || 0;
      d.avgScore = prevTotal === 0 ? score : (d.avgScore * prevTotal + score * r.n) / (prevTotal + r.n);
      d._total += r.n;
    }
    const trend = Array.from(byDay.entries()).map(([day, d]) => {
      const { _total: _, ...rest } = d;
      return { day, ...rest };
    });
    res.json({ trend, days });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 9. Social post generator
// ─────────────────────────────────────────────────────────
router.post("/admin/ai/social-post", requireMedia, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const schema = z.object({
    topic: z.string().min(5).max(2000),
    platform: z.enum(["twitter", "facebook", "instagram", "youtube"]).optional(),
    tone: z.enum(["formal", "warm", "celebratory", "urgent", "informative"]).default("warm"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  const { topic, platform, tone } = parsed.data;
  const settings = await loadAiSettings();
  if (!settings.featureToggles.postGenerator) return res.status(403).json({ error: "Social post generator is disabled in AI settings." });
  const limits: Record<string, number> = { twitter: 280, facebook: 2000, instagram: 2200, youtube: 5000 };
  const charLimit = platform ? (limits[platform] ?? 500) : 500;
  const defaultPrompt = `You are a social media manager for D. Sarath Kumar, Minister (TVK party), MLA of Tambaram Constituency, Chengalpattu District. Write an engaging ${platform ?? "social media"} post in a ${tone} tone. Keep English under ${charLimit} chars and Tamil under ${charLimit} chars. Include 3-5 relevant hashtags. Respond ONLY with strict JSON: {"content_en":"…","content_ta":"…","hashtags":["#tag1",…]}. Tamil must use proper Tamil script.`;
  const t0 = Date.now();
  try {
    const result = await chatJson<{ content_en: string; content_ta: string; hashtags: string[] }>([
      { role: "system", content: resolvePrompt(settings.promptTemplates.socialPost, defaultPrompt) },
      { role: "user", content: `${topic}\n\n(Platform: ${platform ?? "general"}, max ${charLimit} chars per language, tone: ${tone})` },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    logUsage("social-post", topic.length, JSON.stringify(result).length, Date.now() - t0);
    res.json({ post: result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 10. Headline suggestions for news articles
// ─────────────────────────────────────────────────────────
router.post("/admin/ai/headline-suggestions", requireMedia, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const schema = z.object({
    content: z.string().min(10).max(5000),
    category: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const settings = await loadAiSettings();
  if (!settings.featureToggles.headlineSuggestion) return res.status(403).json({ error: "Headline suggestions are disabled in AI settings." });
  const defaultPrompt = `You are an editor for D. Sarath Kumar MLA's official news portal. Generate 5 headline options for the given article. Respond ONLY with strict JSON: {"headlines":[{"en":"<English headline>","ta":"<Tamil headline in Tamil script>"},…]}. Headlines must be under 12 words, factual, and engaging.`;
  const t0 = Date.now();
  try {
    const result = await chatJson<{ headlines: Array<{ en: string; ta: string }> }>([
      { role: "system", content: resolvePrompt(settings.promptTemplates.headline, defaultPrompt) },
      { role: "user", content: `Category: ${parsed.data.category ?? "General"}\n\nContent:\n${parsed.data.content.slice(0, 3000)}` },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    logUsage("headline-suggestions", parsed.data.content.length, JSON.stringify(result).length, Date.now() - t0);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 11. Activity description expander
// ─────────────────────────────────────────────────────────
router.post("/admin/ai/expand-activity", requireMedia, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const schema = z.object({
    title: z.string().min(3).max(500),
    draft: z.string().max(3000).optional(),
    category: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const { title, draft, category } = parsed.data;
  const settings = await loadAiSettings();
  const defaultPrompt = `You are a content writer for D. Sarath Kumar MLA's official website. Expand a brief activity note into a well-written bilingual description. Write 2-3 warm, factual paragraphs. Respond ONLY with strict JSON: {"description_en":"…","description_ta":"…"}. Tamil must use proper Tamil script.`;
  const t0 = Date.now();
  try {
    const result = await chatJson<{ description_en: string; description_ta: string }>([
      { role: "system", content: resolvePrompt(settings.promptTemplates.activityExpand, defaultPrompt) },
      { role: "user", content: `Activity: ${title}\nCategory: ${category ?? "General"}\nDraft: ${draft ?? "(none)"}` },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    logUsage("expand-activity", (title + (draft ?? "")).length, JSON.stringify(result).length, Date.now() - t0);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

// ─────────────────────────────────────────────────────────
// 12. Admin Q&A — constituency assistant for staff
// ─────────────────────────────────────────────────────────
router.post("/admin/ai/ask", requireStaff, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const schema = z.object({
    question: z.string().min(3).max(800),
    context: z.enum(["general", "grievances", "appointments", "news"]).default("general"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const { question, context: ctx } = parsed.data;

  let ctxData = "";
  if (ctx === "grievances") {
    try {
      const [stats] = await db.select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${grievancesTable.status} = 'Submitted')::int`,
        inProgress: sql<number>`count(*) filter (where ${grievancesTable.status} = 'In Progress')::int`,
        resolved: sql<number>`count(*) filter (where ${grievancesTable.status} = 'Resolved')::int`,
      }).from(grievancesTable);
      ctxData = `\nCurrent grievance stats: Total=${stats.total}, Pending=${stats.pending}, In Progress=${stats.inProgress}, Resolved=${stats.resolved}.`;
    } catch { /* ignore */ }
  }

  const settings = await loadAiSettings();
  const t0 = Date.now();
  try {
    const reply = await chat([
      { role: "system", content: `You are an AI assistant for the constituency office of D. Sarath Kumar MLA (Tambaram, Chengalpattu District, TVK party). Answer questions about constituency management, governance, and operations concisely and helpfully. Mirror the user's language (Tamil or English).${ctxData}` },
      { role: "user", content: question },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    logUsage("admin-ask", question.length, reply.length, Date.now() - t0);
    res.json({ answer: reply });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

// ─────────────────────────────────────────────────────────
// Appointment priority scoring — exported for async use in site.ts
// ─────────────────────────────────────────────────────────
export async function scoreAppointment(id: number): Promise<void> {
  if (!hasOpenAI()) return;
  try {
    const settings = await loadAiSettings();
    if (!settings.featureToggles.appointmentScoring) return;
    const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    if (!appt) return;
    const defaultPrompt = `You are a scheduling assistant for the constituency office of D. Sarath Kumar MLA (Tambaram, Chengalpattu District). Score the urgency/priority of an appointment request from 1 to 5 (5 = most urgent, needs immediate attention; 1 = routine). Consider category (Grievance Hearing → higher), subject seriousness, description, and party size. Respond ONLY with strict JSON: {"score":<1-5>,"reason":"<brief 1-line English reason>"}`;
    const result = await chatJson<{ score: number; reason: string }>([
      { role: "system", content: resolvePrompt(settings.promptTemplates.appointmentScore, defaultPrompt) },
      { role: "user", content: `Category: ${appt.category}\nSubject: ${appt.subject}\nDescription: ${appt.description ?? "n/a"}\nParty size: ${appt.partySize}` },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    const score = Math.min(5, Math.max(1, Math.round(result.score)));
    await db.update(appointmentsTable).set({ aiPriorityScore: score }).where(eq(appointmentsTable.id, id));
    logUsage("score-appointment", (appt.subject ?? "").length, String(score).length, 0);
  } catch { /* non-blocking — ignore */ }
}

// ─────────────────────────────────────────────────────────
// 13. Suggested appointment time slot — proposes the next sensible office slot
// for a pending request, avoiding clashes with already-scheduled appointments.
// ─────────────────────────────────────────────────────────
router.post("/admin/appointments/:id/suggest-slot", requireStaff, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
  if (!appt) return res.status(404).json({ error: "Appointment not found" });
  const settings = await loadAiSettings();
  // Pull upcoming confirmed slots so the assistant can avoid clashes.
  const now = new Date();
  const booked = await db.select({
    date: appointmentsTable.scheduledDate, time: appointmentsTable.scheduledTime,
  }).from(appointmentsTable)
    .where(and(isNotNull(appointmentsTable.scheduledDate), gte(appointmentsTable.scheduledDate, now)))
    .orderBy(appointmentsTable.scheduledDate).limit(50);
  const bookedList = booked
    .filter((b) => b.date)
    .map((b) => `${new Date(b.date as Date).toISOString().slice(0, 10)} ${b.time ?? ""}`.trim())
    .join("; ") || "none";
  const t0 = Date.now();
  try {
    const result = await chatJson<{ date: string; time: string; reason: string }>([
      { role: "system", content: `You are a scheduling assistant for an MLA's constituency office. Office hours are Mon-Sat 10:00-17:00 IST. Propose ONE suitable upcoming appointment slot that does not clash with already-booked slots. Today is ${now.toISOString().slice(0, 10)}. Respect the citizen's preferred date/time when feasible. Respond ONLY with strict JSON: {"date":"YYYY-MM-DD","time":"HH:MM","reason":"<brief 1-line English reason>"}` },
      { role: "user", content: `Category: ${appt.category}\nSubject: ${appt.subject}\nParty size: ${appt.partySize}\nPreferred date: ${appt.preferredDate ? new Date(appt.preferredDate).toISOString().slice(0, 10) : "n/a"}\nPreferred time: ${appt.preferredTime ?? "n/a"}\nAlready booked slots: ${bookedList}` },
    ], { model: settings.modelName, temperature: settings.temperature, maxTokens: settings.maxTokens });
    logUsage("suggest-slot", (appt.subject ?? "").length, JSON.stringify(result).length, Date.now() - t0);
    res.json({ slot: result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

export default router;
