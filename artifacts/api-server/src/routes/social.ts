import { Router } from "express";
import { db } from "@workspace/db";
import {
  socialAccountsTable, socialPostsTable, socialPostTargetsTable,
  socialStatsSnapshotsTable, auditLogTable,
  SOCIAL_PLATFORMS, POST_STATUSES,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, asc, lte, sql, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole, type AuthRequest } from "../lib/auth.js";
import { getAdapter, supportsApi } from "../lib/social/index.js";
import {
  generateState, consumeState, generateCodeVerifier, generateCodeChallenge,
  buildAuthUrl, exchangeCode, fetchOAuthProfile, isOAuthConfigured,
  refreshOAuthToken, OAUTH_PLATFORMS,
} from "../lib/oauth.js";

const router = Router();

// Same role set the admin UI gates the Social Media nav with.
const SOCIAL_ROLES = ["super_admin", "admin", "media_team"] as const;
const requireSocialRole = requireRole(...SOCIAL_ROLES);

// Platforms whose adapter actually supports automated posting. Stats-only
// platforms (currently YouTube) are excluded so cross-post targets are
// marked `skipped` rather than `failed` when selected.
const CAN_PUBLISH = new Set(["facebook", "instagram", "twitter"]);
const CAN_FETCH_STATS = new Set(["facebook", "instagram", "twitter", "youtube"]);

// ─────────────────────────────────────────────────────────
// PUBLIC: list active social accounts (handles only — no tokens)
// ─────────────────────────────────────────────────────────
router.get("/social/accounts", async (_req, res) => {
  const rows = await db
    .select({
      id: socialAccountsTable.id,
      platform: socialAccountsTable.platform,
      handle: socialAccountsTable.handle,
      displayName: socialAccountsTable.displayName,
      profileUrl: socialAccountsTable.profileUrl,
      displayOrder: socialAccountsTable.displayOrder,
    })
    .from(socialAccountsTable)
    .where(eq(socialAccountsTable.isActive, true))
    .orderBy(asc(socialAccountsTable.displayOrder), asc(socialAccountsTable.id));
  res.json({ accounts: rows });
});

// ─────────────────────────────────────────────────────────
// ADMIN: account CRUD
// ─────────────────────────────────────────────────────────
const accountSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string().min(1).max(128),
  displayName: z.string().max(128).optional().nullable(),
  profileUrl: z.string().url(),
  externalAccountId: z.string().max(256).optional().nullable(),
  accessToken: z.string().optional().nullable(),
  refreshToken: z.string().optional().nullable(),
  tokenExpiresAt: z.coerce.date().optional().nullable(),
  scopes: z.string().optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

function maskToken(t: string | null | undefined): string | null {
  if (!t) return null;
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 4)}••••${t.slice(-4)}`;
}

function publicAccount(a: typeof socialAccountsTable.$inferSelect) {
  return {
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    displayName: a.displayName,
    profileUrl: a.profileUrl,
    externalAccountId: a.externalAccountId,
    hasAccessToken: !!a.accessToken,
    accessTokenMasked: maskToken(a.accessToken),
    tokenExpiresAt: a.tokenExpiresAt,
    scopes: a.scopes,
    meta: a.meta,
    isActive: a.isActive,
    displayOrder: a.displayOrder,
    lastSyncedAt: a.lastSyncedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

router.get("/admin/social/accounts", requireSocialRole, async (_req, res) => {
  const rows = await db.select().from(socialAccountsTable)
    .orderBy(asc(socialAccountsTable.displayOrder), asc(socialAccountsTable.id));
  res.json({ accounts: rows.map(publicAccount) });
});

router.post("/admin/social/accounts", requireSocialRole, async (req: AuthRequest, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
  const [row] = await db.insert(socialAccountsTable).values({
    ...parsed.data,
    displayName: parsed.data.displayName ?? null,
    externalAccountId: parsed.data.externalAccountId ?? null,
    accessToken: parsed.data.accessToken ?? null,
    refreshToken: parsed.data.refreshToken ?? null,
    tokenExpiresAt: parsed.data.tokenExpiresAt ?? null,
    scopes: parsed.data.scopes ?? null,
    meta: parsed.data.meta ?? {},
  }).returning();
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "CREATE",
    target: `social_account#${row.id}`,
    detail: `${row.platform}:${row.handle}`,
  });
  res.status(201).json({ account: publicAccount(row) });
});

router.put("/admin/social/accounts/:id", requireSocialRole, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const parsed = accountSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });

  // Don't overwrite existing token with empty string
  const data: Record<string, unknown> = { ...parsed.data };
  if ("accessToken" in data && (data.accessToken === "" || data.accessToken == null)) delete data.accessToken;
  if ("refreshToken" in data && (data.refreshToken === "" || data.refreshToken == null)) delete data.refreshToken;

  const [row] = await db.update(socialAccountsTable).set(data).where(eq(socialAccountsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "UPDATE",
    target: `social_account#${id}`,
    detail: `${row.platform}:${row.handle}`,
  });
  res.json({ account: publicAccount(row) });
});

router.delete("/admin/social/accounts/:id", requireSocialRole, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const [row] = await db.delete(socialAccountsTable).where(eq(socialAccountsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "DELETE",
    target: `social_account#${id}`,
    detail: `${row.platform}:${row.handle}`,
  });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────
// ADMIN: stats — fetch + history
// ─────────────────────────────────────────────────────────
router.post("/admin/social/accounts/:id/refresh-stats", requireSocialRole, async (req, res) => {
  const id = Number(req.params.id);
  const [acc] = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.id, id)).limit(1);
  if (!acc) return res.status(404).json({ error: "Not found" });
  const adapter = getAdapter(acc.platform);
  if (!adapter) return res.status(400).json({ error: `Stats not supported for ${acc.platform}` });
  try {
    const stats = await adapter.fetchStats(acc);
    const [snap] = await db.insert(socialStatsSnapshotsTable).values({
      accountId: acc.id,
      followers: stats.followers ?? null,
      following: stats.following ?? null,
      postsCount: stats.postsCount ?? null,
      raw: (stats.raw as Record<string, unknown>) ?? {},
    }).returning();
    await db.update(socialAccountsTable)
      .set({ lastSyncedAt: new Date() })
      .where(eq(socialAccountsTable.id, acc.id));
    res.json({ snapshot: snap });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(502).json({ error: msg });
  }
});

router.get("/admin/social/stats/latest", requireSocialRole, async (_req, res) => {
  // Return the latest snapshot per account
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (account_id) account_id, followers, following, posts_count, captured_at
    FROM social_stats_snapshots
    ORDER BY account_id, captured_at DESC
  `);
  res.json({ stats: rows.rows });
});

// ─────────────────────────────────────────────────────────
// ADMIN: posts — compose, schedule, publish
// ─────────────────────────────────────────────────────────
const postSchema = z.object({
  content: z.string().min(1).max(5000),
  contentTa: z.string().max(5000).optional().nullable(),
  mediaUrls: z.array(z.string().url()).optional(),
  accountIds: z.array(z.number().int()).min(1),
  scheduledAt: z.coerce.date().optional().nullable(),
});

router.get("/admin/social/posts", requireSocialRole, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const posts = await db.select().from(socialPostsTable)
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(limit);
  if (posts.length === 0) return res.json({ posts: [] });
  const ids = posts.map((p) => p.id);
  const targets = await db.select().from(socialPostTargetsTable).where(inArray(socialPostTargetsTable.postId, ids));
  const byPost = new Map<number, typeof targets>();
  for (const t of targets) {
    const arr = byPost.get(t.postId) ?? [];
    arr.push(t);
    byPost.set(t.postId, arr);
  }
  res.json({ posts: posts.map((p) => ({ ...p, targets: byPost.get(p.id) ?? [] })) });
});

router.post("/admin/social/posts", requireSocialRole, async (req: AuthRequest, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });

  const accounts = await db.select().from(socialAccountsTable)
    .where(inArray(socialAccountsTable.id, parsed.data.accountIds));
  if (accounts.length === 0) return res.status(400).json({ error: "No valid accounts" });

  const status = parsed.data.scheduledAt ? "scheduled" : "draft";
  const [post] = await db.insert(socialPostsTable).values({
    content: parsed.data.content,
    contentTa: parsed.data.contentTa ?? null,
    mediaUrls: parsed.data.mediaUrls ?? [],
    status,
    scheduledAt: parsed.data.scheduledAt ?? null,
    createdBy: req.user?.id ?? null,
    createdByName: req.user?.name ?? "system",
  }).returning();

  await db.insert(socialPostTargetsTable).values(accounts.map((a) => ({
    postId: post.id,
    accountId: a.id,
    platform: a.platform,
    status: "pending" as const,
  })));

  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "CREATE",
    target: `social_post#${post.id}`,
    detail: status,
  });

  res.status(201).json({ post });
});

router.delete("/admin/social/posts/:id", requireSocialRole, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const [row] = await db.delete(socialPostsTable).where(eq(socialPostsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "DELETE",
    target: `social_post#${id}`,
    detail: row.content.slice(0, 80),
  });
  res.json({ ok: true });
});

// Publish a post immediately (writes to each platform).
// Shared per-post publish logic. Assumes the caller has already claimed
// the post (status -> "publishing") to avoid duplicate sends. Updates
// per-target rows + the post status atomically at the end.
async function dispatchPost(postId: number): Promise<{ finalStatus: string; results: Array<{ targetId: number; ok: boolean; error?: string; url?: string }> }> {
  const [post] = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, postId)).limit(1);
  if (!post) return { finalStatus: "failed", results: [] };
  const targets = await db.select().from(socialPostTargetsTable).where(eq(socialPostTargetsTable.postId, postId));
  const results: Array<{ targetId: number; ok: boolean; error?: string; url?: string }> = [];
  for (const t of targets) {
    if (t.status === "posted") { results.push({ targetId: t.id, ok: true, url: t.platformPostUrl ?? undefined }); continue; }
    const [acc] = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.id, t.accountId)).limit(1);
    if (!acc || !acc.isActive) {
      await db.update(socialPostTargetsTable).set({ status: "skipped", error: "Account inactive/missing", attemptedAt: new Date() }).where(eq(socialPostTargetsTable.id, t.id));
      results.push({ targetId: t.id, ok: false, error: "Account inactive" });
      continue;
    }
    const adapter = getAdapter(acc.platform);
    if (!adapter || !CAN_PUBLISH.has(acc.platform)) {
      await db.update(socialPostTargetsTable).set({
        status: "skipped",
        error: adapter ? "Platform does not support automated posting" : "Platform unsupported",
        attemptedAt: new Date(),
      }).where(eq(socialPostTargetsTable.id, t.id));
      results.push({ targetId: t.id, ok: false, error: "Publishing not supported for this platform" });
      continue;
    }
    try {
      const out = await adapter.publish(acc, { content: post.content, mediaUrls: post.mediaUrls ?? [] });
      await db.update(socialPostTargetsTable).set({
        status: "posted",
        platformPostId: out.platformPostId,
        platformPostUrl: out.platformPostUrl ?? null,
        attemptedAt: new Date(),
        postedAt: new Date(),
        error: null,
      }).where(eq(socialPostTargetsTable.id, t.id));
      results.push({ targetId: t.id, ok: true, url: out.platformPostUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await db.update(socialPostTargetsTable).set({ status: "failed", error: msg, attemptedAt: new Date() }).where(eq(socialPostTargetsTable.id, t.id));
      results.push({ targetId: t.id, ok: false, error: msg });
    }
  }
  const fresh = await db.select().from(socialPostTargetsTable).where(eq(socialPostTargetsTable.postId, postId));
  const postedOrSkipped = fresh.filter((t) => t.status === "posted" || t.status === "skipped");
  const anyPosted = fresh.some((t) => t.status === "posted");
  const allDone = postedOrSkipped.length === fresh.length && anyPosted;
  const finalStatus = allDone ? "published" : anyPosted ? "partial" : "failed";
  await db.update(socialPostsTable).set({
    status: finalStatus,
    publishedAt: anyPosted ? new Date() : null,
  }).where(eq(socialPostsTable.id, postId));
  return { finalStatus, results };
}

router.post("/admin/social/posts/:id/publish", requireSocialRole, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  // Atomically claim: only transition to "publishing" if not already
  // published/publishing. This prevents the scheduler and manual publish
  // racing on the same post.
  const claimed = await db.update(socialPostsTable)
    .set({ status: "publishing" })
    .where(and(
      eq(socialPostsTable.id, id),
      inArray(socialPostsTable.status, ["draft", "scheduled", "partial", "failed"]),
    ))
    .returning();
  if (claimed.length === 0) {
    const [existing] = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    return res.status(409).json({ error: `Post is ${existing.status}; cannot publish` });
  }
  const { finalStatus, results } = await dispatchPost(id);
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "PUBLISH",
    target: `social_post#${id}`,
    detail: finalStatus,
  });
  res.json({ status: finalStatus, results });
});

// Background tick: publishes scheduled posts whose time has arrived.
// Each post is claimed atomically via a conditional UPDATE before being
// dispatched, so overlapping ticks (or a manual publish racing with the
// scheduler) never process the same post twice.
export async function processScheduledPosts(): Promise<void> {
  const due = await db.select({ id: socialPostsTable.id }).from(socialPostsTable).where(and(
    eq(socialPostsTable.status, "scheduled"),
    lte(socialPostsTable.scheduledAt, new Date()),
  ));
  for (const { id } of due) {
    const claimed = await db.update(socialPostsTable)
      .set({ status: "publishing" })
      .where(and(eq(socialPostsTable.id, id), eq(socialPostsTable.status, "scheduled")))
      .returning({ id: socialPostsTable.id });
    if (claimed.length === 0) continue; // someone else got it
    await dispatchPost(id);
  }
}

// Used by the admin UI to know which platforms support automated posting/stats.
router.get("/admin/social/capabilities", requireSocialRole, (_req, res) => {
  res.json({
    platforms: SOCIAL_PLATFORMS.map((p) => ({
      platform: p,
      apiSupported: supportsApi(p),
      canPublish: CAN_PUBLISH.has(p),
      canFetchStats: CAN_FETCH_STATS.has(p),
      oauthConfigured: isOAuthConfigured(p),
    })),
    oauthPlatforms: OAUTH_PLATFORMS,
    postStatuses: POST_STATUSES,
  });
});

// ─────────────────────────────────────────────────────────
// OAuth — initiation (staff-only, returns auth URL for popup)
// ─────────────────────────────────────────────────────────
router.get("/admin/social/oauth/start/:platform", requireSocialRole, (req, res) => {
  const platform = req.params["platform"] as string;
  if (!OAUTH_PLATFORMS.includes(platform as typeof OAUTH_PLATFORMS[number])) {
    res.status(400).json({ error: "OAuth not supported for this platform" });
    return;
  }
  if (!isOAuthConfigured(platform)) {
    res.status(503).json({
      error: `OAuth credentials not configured for ${platform}. Set FB_APP_ID/FB_APP_SECRET, TWITTER_CLIENT_ID/TWITTER_CLIENT_SECRET, or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET environment variables.`,
    });
    return;
  }
  let codeVerifier: string | undefined;
  let codeChallenge: string | undefined;
  if (platform === "twitter") {
    codeVerifier = generateCodeVerifier();
    codeChallenge = generateCodeChallenge(codeVerifier);
  }
  const state = generateState(platform, codeVerifier);
  const authUrl = buildAuthUrl(platform, state, codeChallenge);
  if (!authUrl) {
    res.status(503).json({ error: "Failed to build OAuth authorization URL" });
    return;
  }
  res.json({ authUrl });
});

// ─────────────────────────────────────────────────────────
// OAuth — callback (public, called by browser after platform redirect)
// State token + PKCE provide CSRF/replay protection.
// Returns an HTML page that closes the popup and notifies the opener.
// ─────────────────────────────────────────────────────────
function popupHtml(success: boolean, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connecting…</title></head><body>
<p style="font-family:sans-serif;padding:24px">${success ? "✓ Connected" : "✗ Failed"}: ${message.replace(/</g, "&lt;")}</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify({ type: "oauth_complete", success, message })}, "*");
      setTimeout(function(){ window.close(); }, 800);
    }
  } catch(e) {}
</script>
</body></html>`;
}

router.get("/social/oauth/callback/:platform", async (req, res) => {
  const platform = req.params["platform"] as string;
  const code = req.query["code"] as string | undefined;
  const state = req.query["state"] as string | undefined;
  const oauthError = req.query["error"] as string | undefined;

  const html = (ok: boolean, msg: string) => {
    res.status(200).set("Content-Type", "text/html").send(popupHtml(ok, msg));
  };

  if (oauthError) { html(false, `OAuth error: ${oauthError}`); return; }
  if (!code || !state) { html(false, "Missing code or state"); return; }

  const stateData = consumeState(state);
  if (!stateData || stateData.platform !== platform) {
    html(false, "Invalid or expired state token"); return;
  }

  try {
    const tokens = await exchangeCode(platform, code, stateData.codeVerifier);
    const profile = await fetchOAuthProfile(platform, tokens.accessToken);

    // For Facebook/Instagram: store the Page access token rather than the
    // short-lived user token. The Page token is long-lived and required for
    // Graph API calls (pages_manage_posts, IG Business media/stats).
    const storedToken =
      (platform === "facebook" || platform === "instagram") && profile?.pageAccessToken
        ? profile.pageAccessToken
        : tokens.accessToken;

    // Upsert: match on (platform, externalAccountId) if possible
    let finalId: number;
    const base = {
      accessToken: storedToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt ?? null,
      lastSyncedAt: new Date(),
    };
    if (profile?.externalAccountId) {
      const existing = await db
        .select({ id: socialAccountsTable.id })
        .from(socialAccountsTable)
        .where(and(
          eq(socialAccountsTable.platform, platform),
          eq(socialAccountsTable.externalAccountId, profile.externalAccountId),
        ))
        .limit(1);
      if (existing.length > 0) {
        await db.update(socialAccountsTable).set({
          ...base,
          ...(profile.handle ? { handle: profile.handle } : {}),
          ...(profile.displayName ? { displayName: profile.displayName } : {}),
          ...(profile.profileUrl ? { profileUrl: profile.profileUrl } : {}),
        }).where(eq(socialAccountsTable.id, existing[0].id));
        finalId = existing[0].id;
      } else {
        const [row] = await db.insert(socialAccountsTable).values({
          platform,
          handle: profile.handle,
          displayName: profile.displayName ?? null,
          profileUrl: profile.profileUrl ?? `https://${platform}.com`,
          externalAccountId: profile.externalAccountId,
          ...base,
          isActive: true,
        }).returning({ id: socialAccountsTable.id });
        finalId = row.id;
      }
    } else {
      const [row] = await db.insert(socialAccountsTable).values({
        platform,
        handle: profile?.handle ?? platform,
        displayName: profile?.displayName ?? null,
        profileUrl: profile?.profileUrl ?? `https://${platform}.com`,
        externalAccountId: profile?.externalAccountId ?? null,
        ...base,
        isActive: true,
      }).returning({ id: socialAccountsTable.id });
      finalId = row.id;
    }

    await db.insert(auditLogTable).values({
      actorId: null,
      actorName: "oauth",
      action: "CONNECT",
      target: `social_account#${finalId}`,
      detail: `${platform} via OAuth`,
    });
    html(true, `${platform} connected successfully`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[oauth callback]", platform, msg);
    html(false, msg);
  }
});

// ─────────────────────────────────────────────────────────
// Disconnect — clears tokens but keeps the account row
// ─────────────────────────────────────────────────────────
router.post("/admin/social/accounts/:id/disconnect", requireSocialRole, async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Bad id" }); return; }
  const [row] = await db.update(socialAccountsTable).set({
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
  }).where(eq(socialAccountsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? "system",
    action: "DISCONNECT",
    target: `social_account#${id}`,
    detail: `${row.platform}:${row.handle}`,
  });
  res.json({ account: publicAccount(row) });
});

// ─────────────────────────────────────────────────────────
// Background worker: refresh expiring OAuth tokens
// Called from index.ts on a timer (every 6 hours).
// ─────────────────────────────────────────────────────────
export async function refreshExpiringTokens(): Promise<void> {
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const expiring = await db.select().from(socialAccountsTable).where(
    and(
      isNotNull(socialAccountsTable.refreshToken),
      lte(socialAccountsTable.tokenExpiresAt, twoDaysFromNow),
    ),
  );
  for (const acc of expiring) {
    if (!acc.refreshToken) continue;
    try {
      const tokens = await refreshOAuthToken(acc.platform, acc.refreshToken);
      await db.update(socialAccountsTable).set({
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        tokenExpiresAt: tokens.expiresAt ?? undefined,
        lastSyncedAt: new Date(),
      }).where(eq(socialAccountsTable.id, acc.id));
      console.info(`[oauth] refreshed token for ${acc.platform}#${acc.id}`);
    } catch (e) {
      console.warn(`[oauth] token refresh failed for ${acc.platform}#${acc.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

export default router;
