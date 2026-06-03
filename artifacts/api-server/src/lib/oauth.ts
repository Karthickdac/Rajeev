import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────
// Platform OAuth configuration — credentials from env vars
// ─────────────────────────────────────────────────────────
export const OAUTH_PLATFORMS = ["facebook", "instagram", "twitter", "youtube"] as const;
export type OAuthPlatform = typeof OAUTH_PLATFORMS[number];

interface PlatformConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  usePkce?: boolean;
  useBasicAuth?: boolean;
}

function cfg(): Record<OAuthPlatform, PlatformConfig> {
  return {
    facebook: {
      clientId: process.env["FB_APP_ID"] ?? "",
      clientSecret: process.env["FB_APP_SECRET"] ?? "",
      authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
      scope: "pages_manage_posts,pages_read_engagement,pages_show_list",
    },
    instagram: {
      clientId: process.env["FB_APP_ID"] ?? "",
      clientSecret: process.env["FB_APP_SECRET"] ?? "",
      authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
      scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    },
    twitter: {
      clientId: process.env["TWITTER_CLIENT_ID"] ?? "",
      clientSecret: process.env["TWITTER_CLIENT_SECRET"] ?? "",
      authUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scope: "tweet.write tweet.read users.read offline.access",
      usePkce: true,
      useBasicAuth: true,
    },
    youtube: {
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
    },
  };
}

export function isOAuthConfigured(platform: string): boolean {
  const config = cfg()[platform as OAuthPlatform];
  if (!config) return false;
  return !!(config.clientId && config.clientSecret);
}

// ─────────────────────────────────────────────────────────
// In-memory state store (CSRF protection + PKCE verifier)
// ─────────────────────────────────────────────────────────
interface OAuthStateEntry {
  platform: string;
  codeVerifier?: string;
  expiresAt: number;
}

const stateStore = new Map<string, OAuthStateEntry>();

// Purge expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of stateStore) {
    if (v.expiresAt < now) stateStore.delete(k);
  }
}, 5 * 60_000).unref();

export function generateState(platform: string, codeVerifier?: string): string {
  const state = crypto.randomBytes(24).toString("hex");
  stateStore.set(state, { platform, codeVerifier, expiresAt: Date.now() + 15 * 60_000 });
  return state;
}

export function consumeState(state: string): OAuthStateEntry | null {
  const entry = stateStore.get(state);
  if (!entry || entry.expiresAt < Date.now()) return null;
  stateStore.delete(state);
  return entry;
}

// ─────────────────────────────────────────────────────────
// PKCE helpers (Twitter / X requires OAuth 2.0 PKCE)
// ─────────────────────────────────────────────────────────
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// ─────────────────────────────────────────────────────────
// Redirect base URL
// ─────────────────────────────────────────────────────────
export function getRedirectBase(): string {
  const explicit = process.env["OAUTH_REDIRECT_BASE_URL"];
  if (explicit) return explicit.replace(/\/$/, "");
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (dev) return `https://${dev}`;
  return "http://localhost:8080";
}

// ─────────────────────────────────────────────────────────
// Authorization URL builder
// ─────────────────────────────────────────────────────────
export function buildAuthUrl(platform: string, state: string, codeChallenge?: string): string | null {
  const config = cfg()[platform as OAuthPlatform];
  if (!config?.clientId) return null;
  const redirect = `${getRedirectBase()}/api/social/oauth/callback/${platform}`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirect,
    response_type: "code",
    state,
    scope: config.scope,
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  if (platform === "youtube") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  return `${config.authUrl}?${params}`;
}

// ─────────────────────────────────────────────────────────
// Authorization code exchange
// ─────────────────────────────────────────────────────────
export interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export async function exchangeCode(platform: string, code: string, codeVerifier?: string): Promise<TokenResult> {
  const config = cfg()[platform as OAuthPlatform];
  if (!config) throw new Error(`Unsupported OAuth platform: ${platform}`);
  const redirect = `${getRedirectBase()}/api/social/oauth/callback/${platform}`;
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  };
  if (codeVerifier) body.code_verifier = codeVerifier;

  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (config.useBasicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error_description ?? json.error ?? `HTTP ${res.status}`) as string;
    throw new Error(msg);
  }
  const accessToken = json.access_token as string;
  const refreshToken = (json.refresh_token as string | undefined) ?? null;
  const expiresIn = json.expires_in as number | undefined;
  return {
    accessToken,
    refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

// ─────────────────────────────────────────────────────────
// Token refresh (background worker)
// ─────────────────────────────────────────────────────────
export async function refreshOAuthToken(platform: string, refreshToken: string): Promise<TokenResult> {
  const config = cfg()[platform as OAuthPlatform];
  if (!config) throw new Error(`Unsupported OAuth platform: ${platform}`);
  const body: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  };
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (config.useBasicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  }
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error_description ?? json.error ?? `HTTP ${res.status}`) as string;
    throw new Error(msg);
  }
  const accessToken = json.access_token as string;
  const newRefresh = (json.refresh_token as string | undefined) ?? refreshToken;
  const expiresIn = json.expires_in as number | undefined;
  return {
    accessToken,
    refreshToken: newRefresh,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

// ─────────────────────────────────────────────────────────
// Basic profile fetch (populates account handle/id after connect)
//
// For Facebook: stores the PAGE access token (from /me/accounts),
//   not the short-lived user token — page tokens are long-lived and
//   required for pages_manage_posts / pages_read_engagement calls.
//
// For Instagram: resolves the IG Business Account ID linked to the
//   Facebook Page, plus the Page access token (which is what the
//   Instagram Graph API requires for media / stats endpoints).
// ─────────────────────────────────────────────────────────
export interface OAuthProfile {
  externalAccountId: string;
  handle: string;
  displayName?: string;
  profileUrl?: string;
  /** For Facebook/Instagram: the long-lived Page access token.
   *  The callback handler stores this instead of the short-lived user token. */
  pageAccessToken?: string;
}

export async function fetchOAuthProfile(platform: string, accessToken: string): Promise<OAuthProfile | null> {
  try {
    if (platform === "facebook") {
      // Fetch pages this user manages, including each page's access token
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`
      );
      const json = (await res.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> };
      const page = json.data?.[0];
      if (page) {
        const pageToken = String(page.access_token ?? accessToken);
        return {
          externalAccountId: String(page.id),
          handle: String(page.name ?? page.id).toLowerCase().replace(/\s+/g, ""),
          displayName: String(page.name ?? ""),
          profileUrl: `https://facebook.com/${page.id}`,
          pageAccessToken: pageToken,
        };
      }
      // No managed page — fall back to user identity (user token stored as-is)
      const me = (await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`).then(r => r.json()).catch(() => ({}))) as Record<string, unknown>;
      return {
        externalAccountId: String(me.id ?? ""),
        handle: String(me.name ?? "unknown").toLowerCase().replace(/\s+/g, ""),
        displayName: String(me.name ?? ""),
        profileUrl: `https://facebook.com/${me.id}`,
      };
    }

    if (platform === "instagram") {
      // Step 1 — get managed Facebook Pages (+ their page tokens)
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`
      );
      const pagesJson = (await pagesRes.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> };
      const pages = pagesJson.data ?? [];

      for (const page of pages) {
        const pageToken = String(page.access_token ?? "");
        if (!pageToken) continue;
        const pageId = String(page.id);

        // Step 2 — check if this Page has a linked IG Business Account
        const igLinkRes = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(pageToken)}`
        );
        const igLink = (await igLinkRes.json().catch(() => ({}))) as { instagram_business_account?: { id?: string } };
        const igId = igLink.instagram_business_account?.id;
        if (!igId) continue;

        // Step 3 — get IG Business Account details for handle / display name
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name&access_token=${encodeURIComponent(pageToken)}`
        );
        const ig = (await igRes.json().catch(() => ({}))) as { id?: string; username?: string; name?: string };
        return {
          externalAccountId: String(ig.id ?? igId),
          handle: ig.username ?? String(page.name ?? igId).toLowerCase().replace(/\s+/g, ""),
          displayName: ig.name ?? String(page.name ?? ""),
          profileUrl: `https://instagram.com/${ig.username ?? igId}`,
          pageAccessToken: pageToken,
        };
      }

      // No IG Business Account found — fall back to user identity
      const me = (await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`).then(r => r.json()).catch(() => ({}))) as Record<string, unknown>;
      return {
        externalAccountId: String(me.id ?? ""),
        handle: String(me.name ?? "unknown").toLowerCase().replace(/\s+/g, ""),
        displayName: String(me.name ?? ""),
        profileUrl: `https://instagram.com/${String(me.name ?? "").toLowerCase().replace(/\s+/g, "")}`,
      };
    }

    if (platform === "twitter") {
      const res = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: string; username?: string; name?: string } };
      const u = json.data;
      return {
        externalAccountId: u?.id ?? "",
        handle: u?.username ?? "unknown",
        displayName: u?.name,
        profileUrl: `https://x.com/${u?.username ?? ""}`,
      };
    }

    if (platform === "youtube") {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json().catch(() => ({}))) as { items?: Array<{ id?: string; snippet?: { customUrl?: string; title?: string } }> };
      const ch = json.items?.[0];
      return {
        externalAccountId: ch?.id ?? "",
        handle: ch?.snippet?.customUrl ?? ch?.id ?? "unknown",
        displayName: ch?.snippet?.title,
        profileUrl: `https://youtube.com/${ch?.snippet?.customUrl ?? ""}`,
      };
    }
  } catch {
    return null;
  }
  return null;
}
