import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send, Newspaper, Share2, AlertCircle, CheckCircle2, Megaphone, Loader2, Facebook, Instagram, Twitter, Youtube, Globe,
} from "lucide-react";
import { adminApi } from "./api";

interface SocialAccount {
  id: number;
  platform: string;
  handle: string;
  displayName: string | null;
  hasAccessToken: boolean;
  isActive: boolean;
}

const PLATFORM_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook, instagram: Instagram, twitter: Twitter, youtube: Youtube,
};

interface Step {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  detail?: string;
}

// One-stop composer that fans the same content out to multiple channels.
// Currently: Website (news article) + Social Media Hub (cross-post).
// WhatsApp / SMS / Push will plug in here when those integrations are added.
export default function BroadcastAdmin() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(false);

  // Shared content
  const [headline, setHeadline] = useState("");
  const [headlineTa, setHeadlineTa] = useState("");
  const [body, setBody] = useState("");
  const [bodyTa, setBodyTa] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("announcement");
  const [featured, setFeatured] = useState(false);

  // Channel toggles
  const [postToWebsite, setPostToWebsite] = useState(true);
  const [postToSocial, setPostToSocial] = useState(true);
  const [socialIds, setSocialIds] = useState<Set<number>>(new Set());

  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getSocialAccounts().then((r) => {
      const a = r.accounts ?? [];
      setAccounts(a);
      // pre-select all active accounts with tokens
      setSocialIds(new Set(a.filter((x: SocialAccount) => x.isActive && x.hasAccessToken).map((x: SocialAccount) => x.id)));
    }).catch(() => undefined);
  }, []);

  function toggle(id: number) {
    const n = new Set(socialIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSocialIds(n);
  }

  function setStep(key: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => s.key === key ? { ...s, ...patch } : s));
  }

  async function broadcast() {
    setErr(null);
    if (!headline.trim() || !body.trim()) { setErr("Headline and body are required"); return; }
    if (!postToWebsite && !postToSocial) { setErr("Pick at least one channel"); return; }
    if (postToSocial && socialIds.size === 0) { setErr("Select at least one social account or disable social channel"); return; }

    const planned: Step[] = [];
    if (postToWebsite) planned.push({ key: "website", label: "Publish website news article", status: "pending" });
    if (postToSocial)  planned.push({ key: "social",  label: `Cross-post to ${socialIds.size} social account(s)`, status: "pending" });
    setSteps(planned);
    setRunning(true);

    try {
      if (postToWebsite) {
        setStep("website", { status: "running" });
        try {
          await adminApi.createNews({
            title: headline,
            titleTa: headlineTa || null,
            content: body,
            contentTa: bodyTa || null,
            imageUrl: imageUrl || null,
            category,
            featured,
            publishedAt: new Date().toISOString(),
          });
          setStep("website", { status: "done", detail: "Live on /news" });
        } catch (e) {
          setStep("website", { status: "failed", detail: e instanceof Error ? e.message : "Failed" });
        }
      }

      if (postToSocial) {
        setStep("social", { status: "running" });
        try {
          // Social composer expects a single text blob — we use the English body
          // with Tamil under it (matches how the social hub already supports
          // contentTa).
          const { post } = await adminApi.createSocialPost({
            content: body,
            contentTa: bodyTa || undefined,
            mediaUrls: imageUrl ? [imageUrl] : [],
            accountIds: [...socialIds],
          });
          const result = await adminApi.publishSocialPost(post.id);
          const ok = result.results?.filter((r: { ok: boolean }) => r.ok).length ?? 0;
          const total = result.results?.length ?? socialIds.size;
          setStep("social", {
            status: ok === total ? "done" : ok > 0 ? "done" : "failed",
            detail: `${ok}/${total} platforms posted`,
          });
        } catch (e) {
          setStep("social", { status: "failed", detail: e instanceof Error ? e.message : "Failed" });
        }
      }
    } finally {
      setRunning(false);
    }
  }

  function clear() {
    setHeadline(""); setHeadlineTa(""); setBody(""); setBodyTa("");
    setImageUrl(""); setFeatured(false); setSteps([]);
  }

  const activeAccounts = accounts.filter((a) => a.isActive);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" /> Multi-channel Broadcaster</h2>
        <p className="text-sm text-muted-foreground">
          Compose once, push to website + social media at the same time. WhatsApp / SMS / push notifications will plug in here.
        </p>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{err}
      </div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Headline (English)</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Inaugurated new community health centre" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">தலைப்பு (Tamil)</Label>
              <Input value={headlineTa} onChange={(e) => setHeadlineTa(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body (English)</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">{body.length} chars · Twitter caps at ~280</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">விளக்கம் (Tamil)</Label>
              <Textarea rows={4} value={bodyTa} onChange={(e) => setBodyTa(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Image URL (must be public)</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">News category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              Feature this on the homepage
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Channels</h3>

            <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-gray-50">
              <span className="flex items-center gap-2 text-sm">
                <Newspaper className="w-4 h-4 text-primary" /> Website news article
              </span>
              <input type="checkbox" checked={postToWebsite} onChange={(e) => setPostToWebsite(e.target.checked)} />
            </label>

            <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-gray-50">
              <span className="flex items-center gap-2 text-sm">
                <Share2 className="w-4 h-4 text-primary" /> Social media accounts
              </span>
              <input type="checkbox" checked={postToSocial} onChange={(e) => setPostToSocial(e.target.checked)} />
            </label>

            {postToSocial && (
              <div className="space-y-1 max-h-64 overflow-auto border rounded p-2">
                {activeAccounts.length === 0 && <p className="text-xs text-muted-foreground">No active social accounts. Add them in Social Media → Accounts.</p>}
                {activeAccounts.map((a) => {
                  const Icon = PLATFORM_ICON[a.platform] ?? Globe;
                  return (
                    <label key={a.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 text-sm">
                      <input type="checkbox" checked={socialIds.has(a.id)} onChange={() => toggle(a.id)} />
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 truncate">{a.displayName || a.handle}</span>
                      {!a.hasAccessToken && <AlertCircle className="w-3 h-3 text-amber-500" />}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="border-t pt-3 flex flex-col gap-2">
              <Button onClick={broadcast} disabled={running}>
                {running ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Broadcasting…</> : <><Send className="w-4 h-4 mr-1" /> Broadcast now</>}
              </Button>
              <Button variant="outline" onClick={clear} disabled={running}>Clear</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {steps.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-sm mb-2">Broadcast progress</h3>
            {steps.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                {s.status === "pending" && <div className="w-4 h-4 rounded-full border" />}
                {s.status === "running" && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                {s.status === "done"    && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                {s.status === "failed"  && <AlertCircle className="w-4 h-4 text-red-600" />}
                {s.status === "skipped" && <Badge variant="secondary" className="text-xs">skipped</Badge>}
                <span className="flex-1">{s.label}</span>
                {s.detail && <span className={s.status === "failed" ? "text-xs text-red-600" : "text-xs text-muted-foreground"}>{s.detail}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
