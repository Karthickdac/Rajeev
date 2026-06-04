import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, FileText, MessageSquareHeart, Loader2, Copy, AlertCircle,
  Settings, Clock, BarChart2, Share2, Newspaper, Zap, MessageCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { adminApi } from "./api";
import type { Language } from "@/lib/i18n";

interface AiToolsAdminProps { lang: Language; role: string }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="sm" onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }}>
      <Copy className="w-3 h-3 mr-1" />{copied ? "Copied" : "Copy"}
    </Button>
  );
}

function AiBanner({ enabled }: { enabled: boolean | null }) {
  if (enabled === null || enabled) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800">
      <AlertCircle className="w-4 h-4 shrink-0" />
      AI features require an <code className="font-mono text-xs bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> environment variable. Set it in Secrets and restart the API server.
    </div>
  );
}

function PressReleaseGenerator() {
  const [bullets, setBullets] = useState("");
  const [tone, setTone] = useState("formal");
  const [audience, setAudience] = useState("");
  const [out, setOut] = useState<{ title_en: string; title_ta: string; body_en: string; body_ta: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setErr(null); setBusy(true); setOut(null);
    try {
      const r = await adminApi.generatePressRelease({ bullets, tone, audience: audience || undefined });
      setOut(r.release);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Press Release Generator</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Type bullet points in Tamil/English — get a full bilingual release with a Minister quote.</p>
        <div className="space-y-1">
          <Label className="text-xs">Key points</Label>
          <Textarea rows={5} value={bullets} onChange={(e) => setBullets(e.target.value)} placeholder={"- Inaugurated new community health centre\n- 50-bed facility, ₹3.2 crore project\n- Will serve 12 surrounding villages"} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["formal","warm","celebratory","urgent"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Audience (optional)</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. farmers, students, press" />
          </div>
        </div>
        <Button onClick={generate} disabled={busy || bullets.length < 10}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-1" /> Generate release</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            {[{ label: "English", title: out.title_en, body: out.body_en }, { label: "Tamil", title: out.title_ta, body: out.body_ta }].map(({ label, title, body }) => (
              <div key={label} className="border rounded-md p-3 bg-white space-y-2">
                <div className="flex items-center justify-between"><Badge variant="outline">{label}</Badge><CopyButton text={`${title}\n\n${body}`} /></div>
                <p className="font-semibold text-sm leading-snug">{title}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SentimentAnalyzer() {
  const [text, setText] = useState("");
  const [out, setOut] = useState<{ sentiment: string; score: number; topics: string[]; summary: string; suggested_reply_en: string; suggested_reply_ta: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const SC: Record<string, string> = { positive: "text-green-700 bg-green-100", negative: "text-red-700 bg-red-100", neutral: "text-gray-700 bg-gray-100", mixed: "text-amber-700 bg-amber-100" };

  async function analyze() {
    setErr(null); setBusy(true); setOut(null);
    try { const r = await adminApi.analyzeSentiment({ text }); setOut(r.analysis); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MessageSquareHeart className="w-4 h-4 text-primary" /> Sentiment Analyzer</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Paste a social media comment or news snippet — get sentiment + a suggested reply.</p>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste any text here…" />
        <Button onClick={analyze} disabled={busy || !text.trim()}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4 mr-1" /> Analyze</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="space-y-3 mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${SC[out.sentiment] ?? SC.neutral}`}>{out.sentiment}</span>
              <span className="text-xs text-muted-foreground">Score: <span className={out.score >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{out.score > 0 ? "+" : ""}{out.score}</span></span>
              {out.topics.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
            </div>
            <p className="text-sm">{out.summary}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[{ label: "English reply", body: out.suggested_reply_en }, { label: "Tamil reply", body: out.suggested_reply_ta }].map(({ label, body }) => (
                <div key={label} className="border rounded-md p-2 bg-muted/30">
                  <div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground font-medium">{label}</span><CopyButton text={body} /></div>
                  <p className="text-xs leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SocialPostGenerator() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [tone, setTone] = useState("warm");
  const [out, setOut] = useState<{ content_en: string; content_ta: string; hashtags: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setErr(null); setBusy(true); setOut(null);
    try { const r = await adminApi.generateSocialPost({ topic, platform, tone }); setOut(r.post); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Share2 className="w-4 h-4 text-primary" /> Social Post Generator</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Describe the topic — get ready-to-post bilingual content with hashtags.</p>
        <div className="space-y-1">
          <Label className="text-xs">Topic / context</Label>
          <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Inaugurated new water tank in Thiruvadanai ward 12 today, benefiting 3,000 families" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["facebook","instagram","twitter","youtube"].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["formal","warm","celebratory","urgent","informative"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={generate} disabled={busy || topic.length < 5}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-1" /> Generate post</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="space-y-3 mt-2">
            <div className="flex flex-wrap gap-1">{out.hashtags.map(h => <Badge key={h} variant="secondary" className="text-xs font-mono">{h}</Badge>)}</div>
            <div className="grid md:grid-cols-2 gap-3">
              {[{ label: "English", body: out.content_en }, { label: "Tamil", body: out.content_ta }].map(({ label, body }) => (
                <div key={label} className="border rounded-md p-3 bg-white">
                  <div className="flex items-center justify-between mb-1"><Badge variant="outline">{label}</Badge><CopyButton text={body} /></div>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HeadlineSuggestions() {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [headlines, setHeadlines] = useState<Array<{ en: string; ta: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function suggest() {
    setErr(null); setBusy(true); setHeadlines([]);
    try { const r = await adminApi.getHeadlineSuggestions({ content, category: category || undefined }); setHeadlines(r.headlines ?? []); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Newspaper className="w-4 h-4 text-primary" /> Headline Suggestions</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Paste article content — get 5 bilingual headline options.</p>
        <div className="space-y-1">
          <Label className="text-xs">Article content</Label>
          <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the article body here…" />
        </div>
        <div className="flex gap-2">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (optional)" className="flex-1" />
          <Button onClick={suggest} disabled={busy || content.length < 10}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" /> Suggest</>}
          </Button>
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {headlines.length > 0 && (
          <div className="space-y-2 mt-2">
            {headlines.map((h, i) => (
              <div key={i} className="border rounded-md p-2 bg-muted/30 grid sm:grid-cols-2 gap-1 items-center">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground shrink-0">{i+1}.</span>
                  <span className="text-xs font-medium truncate">{h.en}</span>
                  <CopyButton text={h.en} />
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs truncate">{h.ta}</span>
                  <CopyButton text={h.ta} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityExpander() {
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [out, setOut] = useState<{ description_en: string; description_ta: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function expand() {
    setErr(null); setBusy(true); setOut(null);
    try { const r = await adminApi.expandActivity({ title, draft: draft || undefined, category: category || undefined }); setOut(r); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Activity Description Expander</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Provide an activity title — get a full bilingual description for the website.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Activity title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Road inauguration at Thiruvadanai" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category (optional)</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Infrastructure" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Brief notes (optional)</Label>
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Any key details to include…" />
        </div>
        <Button onClick={expand} disabled={busy || title.length < 3}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Expanding…</> : <><Sparkles className="w-4 h-4 mr-1" /> Expand description</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="grid md:grid-cols-2 gap-3 mt-2">
            {[{ label: "English", body: out.description_en }, { label: "Tamil", body: out.description_ta }].map(({ label, body }) => (
              <div key={label} className="border rounded-md p-3 bg-white">
                <div className="flex items-center justify-between mb-1"><Badge variant="outline">{label}</Badge><CopyButton text={body} /></div>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminQA() {
  const [question, setQuestion] = useState("");
  const [ctx, setCtx] = useState("general");
  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask() {
    if (!question.trim()) return;
    const q = question.trim();
    setErr(null); setBusy(true); setQuestion("");
    try {
      const r = await adminApi.askAi({ question: q, context: ctx });
      setHistory(h => [...h, { q, a: r.answer }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /> Constituency AI Assistant</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Ask questions about constituency management, grievance stats, or governance. Press Enter to send.</p>
        {history.length > 0 && (
          <div className="max-h-72 overflow-y-auto border rounded-md p-3 bg-muted/20 space-y-4">
            {history.map((item, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold text-primary">You: {item.q}</p>
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{item.a}</p>
              </div>
            ))}
            {busy && <p className="text-xs text-muted-foreground animate-pulse">Thinking…</p>}
            <div ref={bottomRef} />
          </div>
        )}
        <div className="flex gap-2">
          <Select value={ctx} onValueChange={setCtx}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="grievances">Grievances</SelectItem>
              <SelectItem value="appointments">Appointments</SelectItem>
              <SelectItem value="news">News</SelectItem>
            </SelectContent>
          </Select>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !busy) { e.preventDefault(); ask(); } }}
            placeholder="Ask anything about the constituency…" className="flex-1" />
          <Button onClick={ask} disabled={busy || !question.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
      </CardContent>
    </Card>
  );
}

interface AiFeatureToggles {
  autoTriage: boolean;
  resolutionSuggestion: boolean;
  postGenerator: boolean;
  pressRelease: boolean;
  headlineSuggestion: boolean;
  appointmentScoring: boolean;
}
interface AiPromptTemplates {
  triage: string; resolution: string; socialPost: string; pressRelease: string;
  headline: string; activityExpand: string; appointmentScore: string;
}
interface AiSettings {
  modelName: string;
  temperature: number;
  maxTokens: number;
  featureToggles: AiFeatureToggles;
  promptTemplates: AiPromptTemplates;
}

const DEFAULT_SETTINGS: AiSettings = {
  modelName: "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 1200,
  featureToggles: {
    autoTriage: true, resolutionSuggestion: true, postGenerator: true,
    pressRelease: true, headlineSuggestion: true, appointmentScoring: true,
  },
  promptTemplates: {
    triage: "", resolution: "", socialPost: "", pressRelease: "",
    headline: "", activityExpand: "", appointmentScore: "",
  },
};
const FEATURE_LABELS: Record<keyof AiFeatureToggles, string> = {
  autoTriage: "Auto-triage grievances on submit",
  resolutionSuggestion: "Resolution suggestions (Grievances)",
  postGenerator: "Social post generator",
  pressRelease: "Press release generator",
  headlineSuggestion: "Headline suggestions (News editor)",
  appointmentScoring: "Auto-score appointment priority on submit",
};
const PROMPT_LABELS: Record<keyof AiPromptTemplates, string> = {
  triage: "Grievance triage",
  resolution: "Resolution suggestion",
  socialPost: "Social post generator",
  pressRelease: "Press release generator",
  headline: "Headline suggestions",
  activityExpand: "Activity description expander",
  appointmentScore: "Appointment priority scoring",
};

function SettingsTab() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getAiSettings().then((s) => {
      if (s) {
        const raw = s as Partial<AiSettings>;
        setSettings({
          modelName: raw.modelName ?? DEFAULT_SETTINGS.modelName,
          temperature: typeof raw.temperature === "number" ? raw.temperature : DEFAULT_SETTINGS.temperature,
          maxTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : DEFAULT_SETTINGS.maxTokens,
          featureToggles: { ...DEFAULT_SETTINGS.featureToggles, ...(raw.featureToggles ?? {}) },
          promptTemplates: { ...DEFAULT_SETTINGS.promptTemplates, ...(raw.promptTemplates ?? {}) },
        });
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true); setMsg(null);
    try { await adminApi.updateAiSettings(settings); setMsg("Settings saved."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  if (!loaded) return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Model Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Model</Label>
            <Select value={settings.modelName} onValueChange={(v) => setSettings(s => ({ ...s, modelName: v }))}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">gpt-4o-mini (fast, low cost)</SelectItem>
                <SelectItem value="gpt-4o">gpt-4o (smarter, higher cost)</SelectItem>
                <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="space-y-1">
              <Label className="text-xs">Temperature ({settings.temperature.toFixed(1)})</Label>
              <Input type="number" min={0} max={2} step={0.1} value={settings.temperature}
                onChange={(e) => setSettings(s => ({ ...s, temperature: Math.min(2, Math.max(0, Number(e.target.value) || 0)) }))} />
              <p className="text-[11px] text-muted-foreground">0 = focused, 2 = creative</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max tokens</Label>
              <Input type="number" min={100} max={8000} step={100} value={settings.maxTokens}
                onChange={(e) => setSettings(s => ({ ...s, maxTokens: Math.min(8000, Math.max(100, Math.round(Number(e.target.value) || 0))) }))} />
              <p className="text-[11px] text-muted-foreground">Per-response limit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Feature Toggles</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(settings.featureToggles) as Array<keyof AiFeatureToggles>).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm font-normal cursor-pointer">{FEATURE_LABELS[key] ?? key}</Label>
              <Switch checked={settings.featureToggles[key]} onCheckedChange={(v) => setSettings(s => ({ ...s, featureToggles: { ...s.featureToggles, [key]: v } }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Prompt Templates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Leave a field blank to use the built-in default prompt. Custom prompts must keep the JSON output instructions intact.</p>
          {(Object.keys(settings.promptTemplates) as Array<keyof AiPromptTemplates>).map((key) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{PROMPT_LABELS[key] ?? key}</Label>
              <Textarea rows={3} placeholder="(using built-in default)" value={settings.promptTemplates[key]}
                onChange={(e) => setSettings(s => ({ ...s, promptTemplates: { ...s.promptTemplates, [key]: e.target.value } }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : "Save settings"}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function UsageLogTab() {
  const [items, setItems] = useState<Array<{ ts: string; feature: string; inLen: number; outLen: number; latencyMs: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getAiUsageLog().then((r) => setItems(r.items ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>;
  if (items.length === 0) return <div className="py-8 text-center text-sm text-muted-foreground">No AI calls recorded yet in this server session.</div>;

  return (
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Feature</th>
            <th className="px-3 py-2 font-medium text-right">In</th>
            <th className="px-3 py-2 font-medium text-right">Out</th>
            <th className="px-3 py-2 font-medium text-right">Latency</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-1.5 text-muted-foreground font-mono">{new Date(item.ts).toLocaleTimeString()}</td>
              <td className="px-3 py-1.5 font-medium">{item.feature}</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{item.inLen}c</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{item.outLen}c</td>
              <td className="px-3 py-1.5 text-right">{item.latencyMs > 0 ? `${item.latencyMs}ms` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { id: "tools", label: "AI Tools", icon: Sparkles },
  { id: "qa", label: "Q&A Assistant", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "usage", label: "Usage Log", icon: BarChart2 },
];

const TOOLS = [
  { key: "press", label: "Press Release Generator", icon: FileText, node: <PressReleaseGenerator /> },
  { key: "sentiment", label: "Sentiment Analyzer", icon: MessageSquareHeart, node: <SentimentAnalyzer /> },
  { key: "social", label: "Social Post Generator", icon: Share2, node: <SocialPostGenerator /> },
  { key: "headline", label: "Headline Suggestions", icon: Newspaper, node: <HeadlineSuggestions /> },
  { key: "activity", label: "Activity Expander", icon: Zap, node: <ActivityExpander /> },
];

export default function AiToolsAdmin({ role }: AiToolsAdminProps) {
  const [tab, setTab] = useState("tools");
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ press: true });
  const canSettings = role === "super_admin" || role === "admin";

  useEffect(() => {
    fetch("/api/ai/status").then(r => r.json()).then((d) => setAiEnabled(d.enabled)).catch(() => setAiEnabled(false));
  }, []);

  function toggle(key: string) { setExpanded(p => ({ ...p, [key]: !p[key] })); }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">AI Features</h2>
        {aiEnabled === true && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>}
        {aiEnabled === false && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">No API key</Badge>}
      </div>

      <AiBanner enabled={aiEnabled} />

      <div className="flex gap-1 border-b">
        {TABS.filter(t => t.id !== "settings" || canSettings).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${tab === id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <div className="space-y-2">
          {TOOLS.map(({ key, label, icon: Icon, node }) => (
            <div key={key} className="border rounded-xl overflow-hidden">
              <button onClick={() => toggle(key)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium"><Icon className="w-4 h-4 text-primary" />{label}</div>
                {expanded[key] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expanded[key] && <div className="p-1">{node}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "qa" && <AdminQA />}
      {tab === "settings" && canSettings && <SettingsTab />}
      {tab === "usage" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Last 50 calls in this server session (resets on restart)</span></div>
          <UsageLogTab />
        </div>
      )}
    </div>
  );
}
