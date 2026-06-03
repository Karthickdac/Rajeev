import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Facebook, Instagram, Twitter, Youtube, Globe, Send, Trash2, Plus, RefreshCw,
  Calendar, Link as LinkIcon, ExternalLink, CheckCircle2, AlertCircle, Clock,
  Pencil, X, Eye, EyeOff, Wifi, WifiOff, ImageIcon,
} from "lucide-react";
import { adminApi } from "./api";
import { getToken } from "@/lib/auth";

type Platform = "facebook" | "instagram" | "twitter" | "youtube" | "linkedin" | "telegram" | "whatsapp" | "threads" | "other";

interface Account {
  id: number;
  platform: Platform;
  handle: string;
  displayName: string | null;
  profileUrl: string;
  externalAccountId: string | null;
  hasAccessToken: boolean;
  accessTokenMasked: string | null;
  tokenExpiresAt: string | null;
  scopes: string | null;
  meta: Record<string, unknown>;
  isActive: boolean;
  displayOrder: number;
  lastSyncedAt: string | null;
}

interface Target {
  id: number;
  postId: number;
  accountId: number;
  platform: string;
  status: string;
  platformPostId: string | null;
  platformPostUrl: string | null;
  error: string | null;
  postedAt: string | null;
}

interface Post {
  id: number;
  content: string;
  contentTa: string | null;
  mediaUrls: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  targets: Target[];
}

interface LatestStat {
  account_id: number;
  followers: number | null;
  following: number | null;
  posts_count: number | null;
  captured_at: string;
}

interface Capabilities {
  platforms: { platform: string; apiSupported: boolean; oauthConfigured?: boolean }[];
  oauthPlatforms?: string[];
}

const PLATFORM_META: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  facebook:  { label: "Facebook",  color: "text-[#1877F2]", Icon: Facebook },
  instagram: { label: "Instagram", color: "text-[#E4405F]", Icon: Instagram },
  twitter:   { label: "Twitter/X", color: "text-black",     Icon: Twitter },
  youtube:   { label: "YouTube",   color: "text-[#FF0000]", Icon: Youtube },
  linkedin:  { label: "LinkedIn",  color: "text-[#0A66C2]", Icon: Globe },
  telegram:  { label: "Telegram",  color: "text-[#229ED9]", Icon: Send },
  whatsapp:  { label: "WhatsApp",  color: "text-[#25D366]", Icon: Send },
  threads:   { label: "Threads",   color: "text-black",     Icon: Globe },
  other:     { label: "Other",     color: "text-gray-600",  Icon: Globe },
};

type Tab = "accounts" | "compose" | "history" | "stats";

export default function SocialMediaAdmin() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<LatestStat[]>([]);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const [a, p, s, c] = await Promise.all([
        adminApi.getSocialAccounts(),
        adminApi.getSocialPosts(),
        adminApi.getLatestSocialStats(),
        adminApi.getSocialCapabilities(),
      ]);
      setAccounts(a.accounts ?? []);
      setPosts(p.posts ?? []);
      setStats(s.stats ?? []);
      setCaps(c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "accounts", label: "Accounts" },
    { id: "compose",  label: "Compose & Schedule" },
    { id: "history",  label: "Post History" },
    { id: "stats",    label: "Stats" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Social Media Hub</h2>
          <p className="text-sm text-muted-foreground">
            Manage links, post to multiple platforms at once, schedule posts, and track follower stats.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {err && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {err}
        </div>
      )}

      <div className="border-b flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && <AccountsTab accounts={accounts} caps={caps} onChange={reload} />}
      {tab === "compose"  && <ComposeTab accounts={accounts} onPosted={reload} />}
      {tab === "history"  && <HistoryTab posts={posts} accounts={accounts} onChange={reload} />}
      {tab === "stats"    && <StatsTab accounts={accounts} stats={stats} caps={caps} onChange={reload} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Accounts Tab
// ─────────────────────────────────────────────────────────
function emptyAccount(): Partial<Account> {
  return { platform: "facebook" as Platform, handle: "", profileUrl: "", isActive: true, displayOrder: 0 };
}

const OAUTH_PLATFORMS_UI = ["facebook", "instagram", "twitter", "youtube"] as const;

function AccountsTab({ accounts, caps, onChange }: { accounts: Account[]; caps: Capabilities | null; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function startNew() { setEditing(emptyAccount()); setShowToken(false); setMsg(null); }
  function startEdit(a: Account) { setEditing({ ...a }); setShowToken(false); setMsg(null); }
  function cancel() { setEditing(null); }

  const supportsApi = (p: string) => caps?.platforms.find((x) => x.platform === p)?.apiSupported ?? false;
  const oauthConfigured = (p: string) => caps?.platforms.find((x) => x.platform === p)?.oauthConfigured ?? false;

  async function save() {
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        platform: editing.platform,
        handle: editing.handle,
        displayName: editing.displayName ?? null,
        profileUrl: editing.profileUrl,
        externalAccountId: editing.externalAccountId ?? null,
        isActive: editing.isActive ?? true,
        displayOrder: editing.displayOrder ?? 0,
      };
      if ((editing as Account & { accessToken?: string }).accessToken) {
        payload.accessToken = (editing as Account & { accessToken?: string }).accessToken;
      }
      if (editing.id) {
        await adminApi.updateSocialAccount(editing.id, payload);
      } else {
        await adminApi.createSocialAccount(payload);
      }
      setEditing(null);
      onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Remove this social account? Any scheduled posts targeting it will be skipped.")) return;
    await adminApi.deleteSocialAccount(id);
    onChange();
  }

  async function disconnect(id: number) {
    if (!window.confirm("Disconnect this account? The OAuth token will be cleared but the account record is kept.")) return;
    try {
      await adminApi.disconnectSocialAccount(id);
      onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  async function connectOAuth(platform: string) {
    setConnecting(platform);
    setMsg(null);
    try {
      const { authUrl } = await adminApi.getSocialOAuthUrl(platform);
      const popup = window.open(authUrl, `oauth-${platform}`, "width=620,height=720,scrollbars=yes,resizable=yes");
      if (!popup) {
        setMsg("Popup blocked — please allow popups for this page, then try again.");
        return;
      }
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "oauth_complete") {
          window.removeEventListener("message", handler);
          clearInterval(poll);
          if (!e.data.success) setMsg(e.data.message ?? "OAuth failed");
          onChange();
        }
      };
      window.addEventListener("message", handler);
      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll);
          window.removeEventListener("message", handler);
          onChange();
        }
      }, 500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to start OAuth");
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="space-y-4">

      {/* OAuth Quick Connect */}
      <div className="border rounded-md p-3 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">One-click OAuth Connect</span>
          </div>
          <span className="text-xs text-muted-foreground">Tokens auto-refresh every 6 hours</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {OAUTH_PLATFORMS_UI.map((p) => {
            const meta = PLATFORM_META[p] ?? PLATFORM_META.other;
            const Icon = meta.Icon;
            const connected = accounts.filter((a) => a.platform === p && a.hasAccessToken);
            const configured = oauthConfigured(p);
            const notConfiguredMsg = p === "twitter"
              ? "Set TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET"
              : p === "youtube"
              ? "Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"
              : "Set FB_APP_ID + FB_APP_SECRET";
            return (
              <div key={p} className="border rounded-md p-2 bg-white flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <span className="text-xs font-medium flex-1">{meta.label}</span>
                  {connected.length > 0 && (
                    <span className="text-xs text-green-600 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> {connected.length}
                    </span>
                  )}
                </div>
                {connected.map((a) => (
                  <div key={a.id} className="flex items-center gap-1 text-xs">
                    <span className="flex-1 truncate text-green-700">@{a.handle}</span>
                    <button onClick={() => disconnect(a.id)}
                      title="Disconnect" className="text-muted-foreground hover:text-red-600">
                      <WifiOff className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <Button size="sm" variant={connected.length > 0 ? "outline" : "default"}
                  className="w-full text-xs h-7"
                  disabled={!configured || connecting === p}
                  title={!configured ? notConfiguredMsg : ""}
                  onClick={() => connectOAuth(p)}
                >
                  {connecting === p ? "Opening…" : connected.length > 0 ? "Add account" : "Connect"}
                  {!configured && <span className="ml-1 opacity-60">(not configured)</span>}
                </Button>
              </div>
            );
          })}
        </div>
        {msg && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{msg}</div>}
      </div>

      <div className="flex justify-end">
        <Button onClick={startNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Account Manually</Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">
          No social accounts yet. Use OAuth Connect above or click "Add Account Manually".
        </div>
      ) : (
        <div className="grid gap-2">
          {accounts.map((a) => {
            const meta = PLATFORM_META[a.platform] ?? PLATFORM_META.other;
            const Icon = meta.Icon;
            const isOAuthPlatform = OAUTH_PLATFORMS_UI.includes(a.platform as typeof OAUTH_PLATFORMS_UI[number]);
            return (
              <div key={a.id} className="border rounded-md p-3 flex items-center gap-3 bg-white">
                <Icon className={`w-5 h-5 ${meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{a.displayName || a.handle}</span>
                    <span className="text-xs text-muted-foreground">@{a.handle}</span>
                    {!a.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                    {a.hasAccessToken
                      ? <Badge variant="outline" className="text-xs text-green-700 border-green-300">Connected</Badge>
                      : <Badge variant="secondary" className="text-xs">No token</Badge>}
                    {a.tokenExpiresAt && (
                      <span className="text-xs text-muted-foreground">
                        expires {new Date(a.tokenExpiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <a href={a.profileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate">
                    {a.profileUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {isOAuthPlatform && a.hasAccessToken && (
                  <Button variant="ghost" size="sm" onClick={() => disconnect(a.id)} title="Disconnect OAuth token"
                    className="text-muted-foreground hover:text-red-600">
                    <WifiOff className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => startEdit(a)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="border rounded-md p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">{editing.id ? "Edit account" : "New account"}</h3>
            <Button variant="ghost" size="sm" onClick={cancel}><X className="w-4 h-4" /></Button>
          </div>

          {msg && <div className="text-xs text-red-700 bg-red-50 p-2 rounded">{msg}</div>}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select value={editing.platform} onValueChange={(v) => setEditing({ ...editing, platform: v as Platform })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>
                      {m.label}{supportsApi(k) ? " (API)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Handle / username</Label>
              <Input value={editing.handle ?? ""} onChange={(e) => setEditing({ ...editing, handle: e.target.value })}
                placeholder="logesh.tamilselvan" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Display name (optional)</Label>
              <Input value={editing.displayName ?? ""} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                placeholder="D. Sarath Kumar" />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Profile URL</Label>
              <Input value={editing.profileUrl ?? ""} onChange={(e) => setEditing({ ...editing, profileUrl: e.target.value })}
                placeholder="https://facebook.com/..." />
            </div>

            {supportsApi(editing.platform ?? "") && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {editing.platform === "facebook" || editing.platform === "instagram" ? "Page / IG Business ID" :
                     editing.platform === "youtube" ? "Channel ID" :
                     "External account ID"}
                  </Label>
                  <Input value={editing.externalAccountId ?? ""} onChange={(e) => setEditing({ ...editing, externalAccountId: e.target.value })}
                    placeholder="optional but required for posting/stats" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>Access token / API key</span>
                    <button type="button" onClick={() => setShowToken((s) => !s)}
                      className="text-muted-foreground hover:text-foreground">
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </Label>
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder={editing.hasAccessToken ? `(set — ${editing.accessTokenMasked ?? "•••"}) — leave blank to keep` : "paste token"}
                    onChange={(e) => setEditing({ ...(editing as Record<string, unknown>), accessToken: e.target.value } as Partial<Account>)}
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Display order</Label>
              <Input type="number" value={editing.displayOrder ?? 0}
                onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={editing.isActive === false ? "no" : "yes"}
                onValueChange={(v) => setEditing({ ...editing, isActive: v === "yes" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Active (shown on site)</SelectItem>
                  <SelectItem value="no">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {supportsApi(editing.platform ?? "") && (
            <p className="text-xs text-muted-foreground">
              {editing.platform === "facebook" && "Use a Page Access Token with pages_manage_posts + pages_read_engagement scopes."}
              {editing.platform === "instagram" && "Use the linked Facebook Page's access token; ID must be the IG Business account ID."}
              {editing.platform === "twitter" && "Use an OAuth2 user-context token with tweet.write + users.read scopes."}
              {editing.platform === "youtube" && "Paste a Data API v3 API key. Channel posts require manual upload in Studio."}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving || !editing.handle || !editing.profileUrl}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Compose Tab
// ─────────────────────────────────────────────────────────
// Per-platform character limits (hard/soft caps that affect publishing)
const PLATFORM_CHAR_LIMITS: Record<string, { limit: number; label: string; hard: boolean }> = {
  twitter:   { limit: 280,    label: "Twitter/X",  hard: true  },
  instagram: { limit: 2200,   label: "Instagram",   hard: false },
  facebook:  { limit: 63206,  label: "Facebook",    hard: false },
  youtube:   { limit: 5000,   label: "YouTube",     hard: false },
};

function ComposeTab({ accounts, onPosted }: { accounts: Account[]; onPosted: () => void }) {
  const [content, setContent] = useState("");
  const [contentTa, setContentTa] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const activeAccounts = accounts.filter((a) => a.isActive);

  // Derive which platforms are selected so we can show per-platform warnings
  const selectedPlatforms = new Set(
    activeAccounts.filter((a) => selected.has(a.id)).map((a) => a.platform)
  );

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function handleImageUpload(file: File) {
    setMediaUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
      const token = getToken() ?? "";
      const res = await fetch(`${BASE}/admin/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setMediaUrl(json.url ?? "");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setMediaUploading(false);
    }
  }

  async function submit(publishNow: boolean) {
    setMsg(null);
    if (!content.trim()) { setMsg("Content is required"); return; }
    if (selected.size === 0) { setMsg("Select at least one account"); return; }
    setBusy(true);
    try {
      const mediaUrls = mediaUrl.trim() ? [mediaUrl.trim()] : [];
      const payload = {
        content: content.trim(),
        contentTa: contentTa.trim() || undefined,
        mediaUrls,
        accountIds: [...selected],
        scheduledAt: !publishNow && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      };
      const { post } = await adminApi.createSocialPost(payload);
      if (publishNow) {
        await adminApi.publishSocialPost(post.id);
      }
      setContent(""); setContentTa(""); setMediaUrl(""); setSelected(new Set()); setScheduledAt("");
      setMsg(publishNow ? "Published. Check History for per-platform results." : "Saved.");
      onPosted();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Content (English / default)</Label>
          <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to share?" />
          {/* Per-platform character limit indicators */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {selectedPlatforms.size === 0 ? (
              <p className="text-xs text-muted-foreground">{content.length} chars</p>
            ) : (
              Array.from(selectedPlatforms).map((plat) => {
                const cfg = PLATFORM_CHAR_LIMITS[plat];
                if (!cfg) return <span key={plat} className="text-xs text-muted-foreground">{content.length} chars</span>;
                const remaining = cfg.limit - content.length;
                const over = remaining < 0;
                const warn = !over && cfg.hard && remaining < 40;
                return (
                  <span key={plat} className={`text-xs font-medium ${over ? "text-red-600" : warn ? "text-amber-600" : "text-muted-foreground"}`}>
                    {cfg.label}: {over
                      ? `${Math.abs(remaining)} over limit${cfg.hard ? " ⚠ will be truncated" : ""}`
                      : `${content.length}/${cfg.limit}`}
                  </span>
                );
              })
            )}
          </div>
          {/* Twitter hard-limit banner when selected and over */}
          {selectedPlatforms.has("twitter") && content.length > 280 && (
            <div className="flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Twitter/X has a 280-character hard limit. Post will be truncated or fail to publish.
            </div>
          )}
          {selectedPlatforms.has("twitter") && content.length > 240 && content.length <= 280 && (
            <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded px-2 py-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Approaching Twitter/X 280-character limit ({280 - content.length} chars remaining).
            </div>
          )}
        </div>

        {/* Per-platform post preview */}
        {selectedPlatforms.size > 0 && content.trim() && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preview per platform</Label>
            <div className="space-y-1.5">
              {Array.from(selectedPlatforms).map((plat) => {
                const cfg = PLATFORM_CHAR_LIMITS[plat];
                const limit = cfg?.limit ?? Infinity;
                const preview = content.length > limit ? content.slice(0, limit) + "…" : content;
                const meta = PLATFORM_META[plat] ?? PLATFORM_META.other;
                const Icon = meta.Icon;
                return (
                  <div key={plat} className="border rounded p-2 bg-gray-50 text-xs">
                    <div className="flex items-center gap-1 mb-1 font-medium">
                      <Icon className={`w-3 h-3 ${meta.color}`} />{meta.label}
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap break-words">{preview}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">தமிழ் (Tamil version, optional)</Label>
          <Textarea rows={3} value={contentTa} onChange={(e) => setContentTa(e.target.value)}
            placeholder="தமிழில் உரை..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Attach Image (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Paste image URL or upload below…"
              className="flex-1 text-xs"
            />
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f); e.target.value = ""; }}
              />
              <span className={`inline-flex items-center gap-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors
                ${mediaUploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}>
                {mediaUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                {mediaUploading ? "Uploading…" : "Upload"}
              </span>
            </label>
          </div>
          {mediaUrl && (
            <div className="flex items-center gap-2 mt-1">
              <img src={mediaUrl} alt="" className="h-12 w-12 object-cover rounded border" onError={() => {}} />
              <span className="text-xs text-muted-foreground truncate flex-1">{mediaUrl}</span>
              <button onClick={() => setMediaUrl("")} className="text-muted-foreground hover:text-red-600"><X className="w-3 h-3" /></button>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Schedule for later (optional)</Label>
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>

        {msg && <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded p-2">{msg}</div>}

        <div className="flex gap-2">
          <Button onClick={() => submit(true)} disabled={busy || !!scheduledAt}>
            <Send className="w-4 h-4 mr-1" /> Publish now
          </Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={busy}>
            {scheduledAt ? "Schedule" : "Save as draft"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Post to</Label>
        {activeAccounts.length === 0 ? (
          <div className="text-xs text-muted-foreground border rounded p-3">
            No active accounts. Add one in the Accounts tab first.
          </div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-auto border rounded p-2">
            {activeAccounts.map((a) => {
              const meta = PLATFORM_META[a.platform] ?? PLATFORM_META.other;
              const Icon = meta.Icon;
              return (
                <label key={a.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <span className="flex-1 truncate">{a.displayName || a.handle}</span>
                  {!a.hasAccessToken && <span title="No token — publishing will fail"><AlertCircle className="w-3 h-3 text-amber-500" /></span>}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// History Tab
// ─────────────────────────────────────────────────────────
function statusBadge(status: string) {
  const map: Record<string, { v: "default" | "secondary" | "destructive" | "outline"; Icon: React.ComponentType<{ className?: string }> }> = {
    draft:      { v: "outline",     Icon: Pencil },
    scheduled:  { v: "secondary",   Icon: Clock },
    publishing: { v: "secondary",   Icon: RefreshCw },
    published:  { v: "default",     Icon: CheckCircle2 },
    partial:    { v: "secondary",   Icon: AlertCircle },
    failed:     { v: "destructive", Icon: AlertCircle },
    posted:     { v: "default",     Icon: CheckCircle2 },
    pending:    { v: "outline",     Icon: Clock },
    skipped:    { v: "secondary",   Icon: X },
  };
  const m = map[status] ?? map.draft;
  const Icon = m.Icon;
  return <Badge variant={m.v} className="text-xs gap-1"><Icon className="w-3 h-3" />{status}</Badge>;
}

function HistoryTab({ posts, accounts, onChange }: { posts: Post[]; accounts: Account[]; onChange: () => void }) {
  const [publishing, setPublishing] = useState<number | null>(null);
  const accById = new Map(accounts.map((a) => [a.id, a]));

  async function publish(id: number) {
    setPublishing(id);
    try {
      await adminApi.publishSocialPost(id);
      onChange();
    } finally {
      setPublishing(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this post and all per-platform results?")) return;
    await adminApi.deleteSocialPost(id);
    onChange();
  }

  if (posts.length === 0) {
    return <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">No posts yet.</div>;
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <div key={p.id} className="border rounded-md p-3 bg-white space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {statusBadge(p.status)}
                <span className="text-xs text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString()} · by {p.createdByName ?? "system"}
                </span>
                {p.scheduledAt && p.status === "scheduled" && (
                  <span className="text-xs text-muted-foreground">
                    · scheduled {new Date(p.scheduledAt).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{p.content}</p>
              {p.contentTa && <p className="text-sm whitespace-pre-wrap text-muted-foreground mt-1">{p.contentTa}</p>}
              {p.mediaUrls.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.mediaUrls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" /> media {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {(p.status === "draft" || p.status === "scheduled" || p.status === "partial" || p.status === "failed") && (
                <Button size="sm" variant="outline" onClick={() => publish(p.id)} disabled={publishing === p.id}>
                  <Send className="w-3 h-3 mr-1" /> {publishing === p.id ? "Posting…" : "Publish now"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-red-600">
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </div>
          </div>

          {p.targets.length > 0 && (
            <div className="border-t pt-2 space-y-1">
              {p.targets.map((t) => {
                const acc = accById.get(t.accountId);
                const meta = PLATFORM_META[t.platform] ?? PLATFORM_META.other;
                const Icon = meta.Icon;
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <Icon className={`w-3 h-3 ${meta.color}`} />
                    <span className="font-medium">{acc?.handle ?? t.platform}</span>
                    {statusBadge(t.status)}
                    {t.platformPostUrl && (
                      <a href={t.platformPostUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        view
                      </a>
                    )}
                    {t.error && <span className="text-red-600 truncate">{t.error}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Stats Tab
// ─────────────────────────────────────────────────────────
function StatsTab({ accounts, stats, caps, onChange }: { accounts: Account[]; stats: LatestStat[]; caps: Capabilities | null; onChange: () => void }) {
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const supportsApi = (p: string) => caps?.platforms.find((x) => x.platform === p)?.apiSupported ?? false;
  const statsById = new Map(stats.map((s) => [s.account_id, s]));

  async function refresh(id: number) {
    setRefreshing(id); setErr(null);
    try {
      await adminApi.refreshSocialStats(id);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div className="space-y-2">
      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
      {accounts.length === 0 && <div className="text-sm text-muted-foreground border rounded p-6 text-center">No accounts.</div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((a) => {
          const meta = PLATFORM_META[a.platform] ?? PLATFORM_META.other;
          const Icon = meta.Icon;
          const s = statsById.get(a.id);
          const can = supportsApi(a.platform) && a.hasAccessToken && a.externalAccountId;
          return (
            <div key={a.id} className="border rounded-md p-3 bg-white space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-5 h-5 ${meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.displayName || a.handle}</div>
                  <div className="text-xs text-muted-foreground">{meta.label}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold">{s?.followers?.toLocaleString() ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Followers</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{s?.following?.toLocaleString() ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Following</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{s?.posts_count?.toLocaleString() ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Posts</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {s ? `Updated ${new Date(s.captured_at).toLocaleString()}` : "Never synced"}
                </span>
                <Button size="sm" variant="outline" disabled={!can || refreshing === a.id}
                  onClick={() => refresh(a.id)} title={!can ? "Needs API token + external account ID" : ""}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${refreshing === a.id ? "animate-spin" : ""}`} /> Sync
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
