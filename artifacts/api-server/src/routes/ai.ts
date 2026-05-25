import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  grievancesTable, pressCoverageTable, siteConfigTable, faqsTable,
  newsTable, eventsTable, promisesTable, auditLogTable,
} from "@workspace/db/schema";
import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireStaff, requireRole, type AuthRequest } from "../lib/auth.js";
import { hasOpenAI, chat, chatJson, embed, cosineSimilarity, type ChatMessage } from "../lib/ai.js";

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
}

export async function triageGrievance(id: number): Promise<TriageResult | null> {
  if (!hasOpenAI()) return null;
  const [g] = await db.select().from(grievancesTable).where(eq(grievancesTable.id, id));
  if (!g) return null;
  const systemMsg: ChatMessage = {
    role: "system",
    content: `You are an assistant for an Indian MLA's constituency office. Classify citizen grievances and respond ONLY with strict JSON matching this shape: {"category": one of [${TRIAGE_CATEGORIES.map((c) => `"${c}"`).join(", ")}], "priority": one of ["Low","Medium","High","Urgent"], "summary_en": <50-word English summary>, "summary_ta": <50-word Tamil summary>, "suggested_route": <short suggestion for which department/officer should handle this>}. Use "Urgent" only for safety, health, or active danger. Tamil text must be in Tamil script.`,
  };
  const userMsg: ChatMessage = {
    role: "user",
    content: `Citizen: ${g.name}\nWard: ${g.ward ?? "n/a"}\nCategory submitted: ${g.category}\nComplaint:\n${g.description}`,
  };
  const result = await chatJson<TriageResult>([systemMsg, userMsg]);
  let vec: number[] | null = null;
  try {
    vec = await embed(`${g.category}\n${g.description}`);
  } catch { /* embedding is optional — don't fail triage if it errors */ }
  await db.update(grievancesTable).set({
    aiCategory: result.category,
    aiPriority: result.priority,
    aiSummary: result.summary_en,
    aiSummaryTa: result.summary_ta,
    aiSuggestedRoute: result.suggested_route,
    aiEmbedding: vec ? JSON.stringify(vec) : undefined,
    aiTriagedAt: new Date(),
  }).where(eq(grievancesTable.id, id));
  return result;
}

router.post("/admin/ai/triage-grievance/:id", requireContent, async (req: AuthRequest, res: Response) => {
  if (!hasOpenAI()) return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
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
    // Fallback: simple full-text search on description (handy if no AI key)
    const rows = await db.select({
      id: grievancesTable.id, ticketNo: grievancesTable.ticketNo, name: grievancesTable.name,
      category: grievancesTable.category, description: grievancesTable.description,
      status: grievancesTable.status, createdAt: grievancesTable.createdAt,
    }).from(grievancesTable).where(and(
      ne(grievancesTable.id, id),
      eq(grievancesTable.category, seed.category),
    )).orderBy(desc(grievancesTable.createdAt)).limit(limit);
    return res.json({ similar: rows.map((r) => ({ ...r, score: null })), mode: "fallback-category" });
  }

  // Pull only rows that already have an embedding (efficient subset).
  const candidates = await db.select({
    id: grievancesTable.id, ticketNo: grievancesTable.ticketNo, name: grievancesTable.name,
    category: grievancesTable.category, description: grievancesTable.description,
    status: grievancesTable.status, createdAt: grievancesTable.createdAt,
    aiEmbedding: grievancesTable.aiEmbedding,
  }).from(grievancesTable).where(and(ne(grievancesTable.id, id), isNotNull(grievancesTable.aiEmbedding))).limit(2000);

  const scored = candidates.map((c) => {
    const v = safeParseVec(c.aiEmbedding);
    const score = v ? cosineSimilarity(seedVec!, v) : 0;
    return { ...c, aiEmbedding: undefined, score };
  }).filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  res.json({ similar: scored, mode: "embedding" });
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
  try {
    const result = await chatJson<{ title_en: string; title_ta: string; body_en: string; body_ta: string }>([
      { role: "system", content: `You write press releases for D. Logesh Tamilselvan, Minister of Commercial Taxes, Registration and Stamp Duty (TVK party), MLA of Rasipuram constituency. Respond ONLY with strict JSON {"title_en":"…","title_ta":"…","body_en":"…","body_ta":"…"}. Body should be 4-6 short paragraphs, ${tone} tone${audience ? `, written for ${audience}` : ""}. Use proper Tamil script for Tamil fields. End the body with a quote attributed to the Minister.` },
      { role: "user", content: `Key points to cover:\n${bullets}` },
    ]);
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
  try {
    const result = await chatJson<{
      sentiment: "positive" | "neutral" | "negative" | "mixed";
      score: number; topics: string[]; summary: string;
      suggested_reply_en: string; suggested_reply_ta: string;
    }>([
      { role: "system", content: `Analyze a social media comment about MLA D. Logesh Tamilselvan. Return strict JSON: {"sentiment":"positive|neutral|negative|mixed","score":-100..100,"topics":[…short tags],"summary":"<1-sentence English>","suggested_reply_en":"<polite, factual reply in English>","suggested_reply_ta":"<polite Tamil reply in Tamil script>"}. Replies should be brief (≤ 2 sentences), de-escalating if negative, gracious if positive.` },
      { role: "user", content: parsed.data.text },
    ]);
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
  try {
    const ctx = await buildSiteContext();
    const sys: ChatMessage = {
      role: "system",
      content: `You are the friendly assistant for the official website of D. Logesh Tamilselvan — Minister of Commercial Taxes, Registration and Stamp Duty (TVK party), MLA of Rasipuram constituency, Namakkal district, Tamil Nadu.

Default to ${lang === "ta" ? "Tamil (Tamil script)" : "English"}, but mirror the user's language if they switch. Keep replies short (2-4 sentences). Be warm and respectful.

If the user wants to file a complaint, ask them to visit /grievance. For emergencies, point them to /emergency. To volunteer, /volunteer. To donate, /donate. To track a complaint, /grievance.

Answer ONLY from the context below. If something is not in the context, say you don't have that information and suggest they call the office.

---SITE CONTEXT---
${ctx}
---END CONTEXT---`,
    };
    const reply = await chat([sys, ...history.map((h) => ({ role: h.role, content: h.content }) as ChatMessage), { role: "user", content: message }], {
      temperature: 0.4, maxTokens: 350,
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
  const q = parsed.data.query || "Logesh Tamilselvan OR \"Rasipuram MLA\" OR TVK";
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
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
          ]);
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

export default router;
