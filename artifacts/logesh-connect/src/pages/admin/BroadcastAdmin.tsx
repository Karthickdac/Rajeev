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
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

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
  const { lang } = useLanguage();
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
    if (!headline.trim() || !body.trim()) { setErr(lc(lang, "Headline and body are required", "தலைப்பு மற்றும் விளக்கம் தேவை")); return; }
    if (!postToWebsite && !postToSocial) { setErr(lc(lang, "Pick at least one channel", "குறைந்தது ஒரு தடத்தைத் தேர்ந்தெடுக்கவும்")); return; }
    if (postToSocial && socialIds.size === 0) { setErr(lc(lang, "Select at least one social account or disable social channel", "குறைந்தது ஒரு சமூக ஊடக கணக்கைத் தேர்ந்தெடுக்கவும் அல்லது சமூக ஊடக தடத்தை முடக்கவும்")); return; }

    const planned: Step[] = [];
    if (postToWebsite) planned.push({ key: "website", label: lc(lang, "Publish website news article", "இணையதள செய்தி கட்டுரையை வெளியிடு"), status: "pending" });
    if (postToSocial)  planned.push({ key: "social",  label: lc(lang, `Cross-post to ${socialIds.size} social account(s)`, `${socialIds.size} சமூக ஊடக கணக்கு(களு)க்கு பகிர்`), status: "pending" });
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
          setStep("website", { status: "done", detail: lc(lang, "Live on /news", "/news இல் நேரலையில்") });
        } catch (e) {
          setStep("website", { status: "failed", detail: e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வியடைந்தது") });
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
            detail: lc(lang, `${ok}/${total} platforms posted`, `${ok}/${total} தளங்களில் வெளியிடப்பட்டது`),
          });
        } catch (e) {
          setStep("social", { status: "failed", detail: e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வியடைந்தது") });
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
        <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" /> {lc(lang, "Multi-channel Broadcaster", "பல்தட ஒளிபரப்பான்")}</h2>
        <p className="text-sm text-muted-foreground">
          {lc(lang, "Compose once, push to website + social media at the same time. WhatsApp / SMS / push notifications will plug in here.", "ஒருமுறை உருவாக்கி, இணையதளம் + சமூக ஊடகங்களுக்கு ஒரே நேரத்தில் அனுப்பவும். WhatsApp / SMS / உந்து அறிவிப்புகள் இங்கு இணைக்கப்படும்.")}
        </p>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{err}
      </div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Headline (English)", "தலைப்பு (ஆங்கிலம்)")}</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={lc(lang, "e.g. Inaugurated new community health centre", "எ.கா. புதிய சமூக நல மருத்துவ மையம் திறக்கப்பட்டது")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Headline (Tamil)", "தலைப்பு (தமிழ்)")}</Label>
              <Input value={headlineTa} onChange={(e) => setHeadlineTa(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Body (English)", "விளக்கம் (ஆங்கிலம்)")}</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">{body.length} {lc(lang, "chars · Twitter caps at ~280", "எழுத்துகள் · Twitter வரம்பு ~280")}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Body (Tamil)", "விளக்கம் (தமிழ்)")}</Label>
              <Textarea rows={4} value={bodyTa} onChange={(e) => setBodyTa(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{lc(lang, "Image URL (must be public)", "பட URL (பொதுவில் இருக்க வேண்டும்)")}</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{lc(lang, "News category", "செய்தி வகை")}</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              {lc(lang, "Feature this on the homepage", "இதை முகப்புப் பக்கத்தில் சிறப்பிக்கவும்")}
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">{lc(lang, "Channels", "தடங்கள்")}</h3>

            <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-gray-50">
              <span className="flex items-center gap-2 text-sm">
                <Newspaper className="w-4 h-4 text-primary" /> {lc(lang, "Website news article", "இணையதள செய்தி கட்டுரை")}
              </span>
              <input type="checkbox" checked={postToWebsite} onChange={(e) => setPostToWebsite(e.target.checked)} />
            </label>

            <label className="flex items-center justify-between p-2 border rounded-md cursor-pointer hover:bg-gray-50">
              <span className="flex items-center gap-2 text-sm">
                <Share2 className="w-4 h-4 text-primary" /> {lc(lang, "Social media accounts", "சமூக ஊடக கணக்குகள்")}
              </span>
              <input type="checkbox" checked={postToSocial} onChange={(e) => setPostToSocial(e.target.checked)} />
            </label>

            {postToSocial && (
              <div className="space-y-1 max-h-64 overflow-auto border rounded p-2">
                {activeAccounts.length === 0 && <p className="text-xs text-muted-foreground">{lc(lang, "No active social accounts. Add them in Social Media → Accounts.", "செயலில் உள்ள சமூக ஊடக கணக்குகள் இல்லை. சமூக ஊடகம் → கணக்குகள் பகுதியில் சேர்க்கவும்.")}</p>}
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
                {running ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {lc(lang, "Broadcasting…", "ஒளிபரப்புகிறது…")}</> : <><Send className="w-4 h-4 mr-1" /> {lc(lang, "Broadcast now", "இப்போது ஒளிபரப்பு")}</>}
              </Button>
              <Button variant="outline" onClick={clear} disabled={running}>{lc(lang, "Clear", "அழி")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {steps.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-sm mb-2">{lc(lang, "Broadcast progress", "ஒளிபரப்பு முன்னேற்றம்")}</h3>
            {steps.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                {s.status === "pending" && <div className="w-4 h-4 rounded-full border" />}
                {s.status === "running" && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                {s.status === "done"    && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                {s.status === "failed"  && <AlertCircle className="w-4 h-4 text-red-600" />}
                {s.status === "skipped" && <Badge variant="secondary" className="text-xs">{lc(lang, "skipped", "தவிர்க்கப்பட்டது")}</Badge>}
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
