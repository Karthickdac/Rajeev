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
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

interface AiToolsAdminProps { lang: Language; role: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const TONE_TA: Record<string, string> = {
  formal: "முறையான", warm: "அன்பான", celebratory: "கொண்டாட்டமான",
  urgent: "அவசர", informative: "தகவல்தரும்",
};
const toneLabel = (lang: Language, t: string) => lc(lang, cap(t), TONE_TA[t] ?? cap(t));

function CopyButton({ text }: { text: string }) {
  const { lang } = useLanguage();
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="sm" onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }}>
      <Copy className="w-3 h-3 mr-1" />{copied ? lc(lang, "Copied", "நகலெடுக்கப்பட்டது") : lc(lang, "Copy", "நகலெடு")}
    </Button>
  );
}

function AiBanner({ enabled }: { enabled: boolean | null }) {
  const { lang } = useLanguage();
  if (enabled === null || enabled) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {lc(lang, "AI features require an", "AI அம்சங்களுக்கு")} <code className="font-mono text-xs bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> {lc(lang, "environment variable. Set it in Secrets and restart the API server.", "சூழல் மாறி தேவை. அதை Secrets-இல் அமைத்து API சேவையகத்தை மறுதொடக்கம் செய்யவும்.")}
    </div>
  );
}

function PressReleaseGenerator() {
  const { lang } = useLanguage();
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
    } catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> {lc(lang, "Press Release Generator", "செய்திக் குறிப்பு உருவாக்கி")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{lc(lang, "Type bullet points in Tamil/English — get a full bilingual release with a Minister quote.", "தமிழ்/ஆங்கிலத்தில் குறிப்புகளை உள்ளிடுங்கள் — அமைச்சர் மேற்கோளுடன் முழு இருமொழி செய்திக் குறிப்பு கிடைக்கும்.")}</p>
        <div className="space-y-1">
          <Label className="text-xs">{lc(lang, "Key points", "முக்கிய குறிப்புகள்")}</Label>
          <Textarea rows={5} value={bullets} onChange={(e) => setBullets(e.target.value)} placeholder={lc(lang, "- Inaugurated new community health centre\n- 50-bed facility, ₹3.2 crore project\n- Will serve 12 surrounding villages", "- புதிய சமூக சுகாதார மையம் திறக்கப்பட்டது\n- 50 படுக்கை வசதி, ₹3.2 கோடி திட்டம்\n- சுற்றியுள்ள 12 கிராமங்களுக்கு பயனளிக்கும்")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{lc(lang, "Tone", "தொனி")}</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["formal","warm","celebratory","urgent"].map(t => <SelectItem key={t} value={t}>{toneLabel(lang, t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{lc(lang, "Audience (optional)", "பார்வையாளர்கள் (விருப்பத்திற்கு)")}</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={lc(lang, "e.g. farmers, students, press", "எ.கா. விவசாயிகள், மாணவர்கள், ஊடகம்")} />
          </div>
        </div>
        <Button onClick={generate} disabled={busy || bullets.length < 10}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {lc(lang, "Generating…", "உருவாக்குகிறது…")}</> : <><Sparkles className="w-4 h-4 mr-1" /> {lc(lang, "Generate release", "குறிப்பு உருவாக்கு")}</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            {[{ label: lc(lang, "English", "ஆங்கிலம்"), title: out.title_en, body: out.body_en }, { label: lc(lang, "Tamil", "தமிழ்"), title: out.title_ta, body: out.body_ta }].map(({ label, title, body }) => (
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
  const { lang } = useLanguage();
  const [text, setText] = useState("");
  const [out, setOut] = useState<{ sentiment: string; score: number; topics: string[]; summary: string; suggested_reply_en: string; suggested_reply_ta: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const SC: Record<string, string> = { positive: "text-green-700 bg-green-100", negative: "text-red-700 bg-red-100", neutral: "text-gray-700 bg-gray-100", mixed: "text-amber-700 bg-amber-100" };

  async function analyze() {
    setErr(null); setBusy(true); setOut(null);
    try { const r = await adminApi.analyzeSentiment({ text }); setOut(r.analysis); }
    catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MessageSquareHeart className="w-4 h-4 text-primary" /> {lc(lang, "Sentiment Analyzer", "உணர்வு பகுப்பாய்வி")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{lc(lang, "Paste a social media comment or news snippet — get sentiment + a suggested reply.", "சமூக ஊடக கருத்து அல்லது செய்தித் துணுக்கை ஒட்டுங்கள் — உணர்வு + பரிந்துரைக்கப்பட்ட பதில் கிடைக்கும்.")}</p>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={lc(lang, "Paste any text here…", "எந்த உரையையும் இங்கே ஒட்டுங்கள்…")} />
        <Button onClick={analyze} disabled={busy || !text.trim()}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {lc(lang, "Analyzing…", "பகுப்பாய்வு செய்கிறது…")}</> : <><Sparkles className="w-4 h-4 mr-1" /> {lc(lang, "Analyze", "பகுப்பாய்வு")}</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="space-y-3 mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${SC[out.sentiment] ?? SC.neutral}`}>{out.sentiment}</span>
              <span className="text-xs text-muted-foreground">{lc(lang, "Score:", "மதிப்பெண்:")} <span className={out.score >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{out.score > 0 ? "+" : ""}{out.score}</span></span>
              {out.topics.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
            </div>
            <p className="text-sm">{out.summary}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[{ label: lc(lang, "English reply", "ஆங்கில பதில்"), body: out.suggested_reply_en }, { label: lc(lang, "Tamil reply", "தமிழ் பதில்"), body: out.suggested_reply_ta }].map(({ label, body }) => (
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
  const { lang } = useLanguage();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [tone, setTone] = useState("warm");
  const [out, setOut] = useState<{ content_en: string; content_ta: string; hashtags: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setErr(null); setBusy(true); setOut(null);
    try { const r = await adminApi.generateSocialPost({ topic, platform, tone }); setOut(r.post); }
    catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Share2 className="w-4 h-4 text-primary" /> {lc(lang, "Social Post Generator", "சமூக ஊடக பதிவு உருவாக்கி")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{lc(lang, "Describe the topic — get ready-to-post bilingual content with hashtags.", "தலைப்பை விவரியுங்கள் — ஹாஷ்டேக்குகளுடன் பதிவிட தயாரான இருமொழி உள்ளடக்கம் கிடைக்கும்.")}</p>
        <div className="space-y-1">
          <Label className="text-xs">{lc(lang, "Topic / context", "தலைப்பு / சூழல்")}</Label>
          <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={lc(lang, "e.g. Inaugurated new water tank in Thiruvadanai ward 12 today, benefiting 3,000 families", "எ.கா. திருவாடானை வட்டாரம் 12-ல் இன்று புதிய நீர்த் தொட்டி திறக்கப்பட்டது, 3,000 குடும்பங்களுக்கு பயன்")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{lc(lang, "Platform", "தளம்")}</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["facebook","instagram","twitter","youtube"].map(p => <SelectItem key={p} value={p}>{cap(p)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{lc(lang, "Tone", "தொனி")}</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["formal","warm","celebratory","urgent","informative"].map(t => <SelectItem key={t} value={t}>{toneLabel(lang, t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={generate} disabled={busy || topic.length < 5}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {lc(lang, "Generating…", "உருவாக்குகிறது…")}</> : <><Sparkles className="w-4 h-4 mr-1" /> {lc(lang, "Generate post", "பதிவு உருவாக்கு")}</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="space-y-3 mt-2">
            <div className="flex flex-wrap gap-1">{out.hashtags.map(h => <Badge key={h} variant="secondary" className="text-xs font-mono">{h}</Badge>)}</div>
            <div className="grid md:grid-cols-2 gap-3">
              {[{ label: lc(lang, "English", "ஆங்கிலம்"), body: out.content_en }, { label: lc(lang, "Tamil", "தமிழ்"), body: out.content_ta }].map(({ label, body }) => (
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
  const { lang } = useLanguage();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [headlines, setHeadlines] = useState<Array<{ en: string; ta: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function suggest() {
    setErr(null); setBusy(true); setHeadlines([]);
    try { const r = await adminApi.getHeadlineSuggestions({ content, category: category || undefined }); setHeadlines(r.headlines ?? []); }
    catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Newspaper className="w-4 h-4 text-primary" /> {lc(lang, "Headline Suggestions", "தலைப்பு பரிந்துரைகள்")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{lc(lang, "Paste article content — get 5 bilingual headline options.", "கட்டுரை உள்ளடக்கத்தை ஒட்டுங்கள் — 5 இருமொழி தலைப்பு விருப்பங்கள் கிடைக்கும்.")}</p>
        <div className="space-y-1">
          <Label className="text-xs">{lc(lang, "Article content", "கட்டுரை உள்ளடக்கம்")}</Label>
          <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder={lc(lang, "Paste the article body here…", "கட்டுரையின் உள்ளடக்கத்தை இங்கே ஒட்டுங்கள்…")} />
        </div>
        <div className="flex gap-2">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={lc(lang, "Category (optional)", "வகை (விருப்பத்திற்கு)")} className="flex-1" />
          <Button onClick={suggest} disabled={busy || content.length < 10}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" /> {lc(lang, "Suggest", "பரிந்துரை")}</>}
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
  const { lang } = useLanguage();
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [out, setOut] = useState<{ description_en: string; description_ta: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function expand() {
    setErr(null); setBusy(true); setOut(null);
    try { const r = await adminApi.expandActivity({ title, draft: draft || undefined, category: category || undefined }); setOut(r); }
    catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> {lc(lang, "Activity Description Expander", "நடவடிக்கை விவர விரிவாக்கி")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{lc(lang, "Provide an activity title — get a full bilingual description for the website.", "நடவடிக்கையின் தலைப்பை அளியுங்கள் — இணையதளத்திற்கான முழு இருமொழி விவரம் கிடைக்கும்.")}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{lc(lang, "Activity title *", "நடவடிக்கை தலைப்பு *")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lc(lang, "e.g. Road inauguration at Thiruvadanai", "எ.கா. திருவாடானையில் சாலை திறப்பு விழா")} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{lc(lang, "Category (optional)", "வகை (விருப்பத்திற்கு)")}</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={lc(lang, "e.g. Infrastructure", "எ.கா. உள்கட்டமைப்பு")} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{lc(lang, "Brief notes (optional)", "சுருக்கமான குறிப்புகள் (விருப்பத்திற்கு)")}</Label>
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={lc(lang, "Any key details to include…", "சேர்க்க வேண்டிய முக்கிய விவரங்கள்…")} />
        </div>
        <Button onClick={expand} disabled={busy || title.length < 3}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {lc(lang, "Expanding…", "விரிவாக்குகிறது…")}</> : <><Sparkles className="w-4 h-4 mr-1" /> {lc(lang, "Expand description", "விவரம் விரிவாக்கு")}</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="grid md:grid-cols-2 gap-3 mt-2">
            {[{ label: lc(lang, "English", "ஆங்கிலம்"), body: out.description_en }, { label: lc(lang, "Tamil", "தமிழ்"), body: out.description_ta }].map(({ label, body }) => (
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
  const { lang } = useLanguage();
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
    } catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /> {lc(lang, "Constituency AI Assistant", "தொகுதி AI உதவியாளர்")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{lc(lang, "Ask questions about constituency management, grievance stats, or governance. Press Enter to send.", "தொகுதி நிர்வாகம், புகார் புள்ளிவிவரங்கள் அல்லது ஆட்சி குறித்து கேள்விகள் கேளுங்கள். அனுப்ப Enter அழுத்தவும்.")}</p>
        {history.length > 0 && (
          <div className="max-h-72 overflow-y-auto border rounded-md p-3 bg-muted/20 space-y-4">
            {history.map((item, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold text-primary">{lc(lang, "You", "நீங்கள்")}: {item.q}</p>
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{item.a}</p>
              </div>
            ))}
            {busy && <p className="text-xs text-muted-foreground animate-pulse">{lc(lang, "Thinking…", "சிந்திக்கிறது…")}</p>}
            <div ref={bottomRef} />
          </div>
        )}
        <div className="flex gap-2">
          <Select value={ctx} onValueChange={setCtx}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">{lc(lang, "General", "பொது")}</SelectItem>
              <SelectItem value="grievances">{lc(lang, "Grievances", "புகார்கள்")}</SelectItem>
              <SelectItem value="appointments">{lc(lang, "Appointments", "சந்திப்புகள்")}</SelectItem>
              <SelectItem value="news">{lc(lang, "News", "செய்திகள்")}</SelectItem>
            </SelectContent>
          </Select>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !busy) { e.preventDefault(); ask(); } }}
            placeholder={lc(lang, "Ask anything about the constituency…", "தொகுதி குறித்து எதையும் கேளுங்கள்…")} className="flex-1" />
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
const FEATURE_LABELS: Record<keyof AiFeatureToggles, { en: string; ta: string }> = {
  autoTriage: { en: "Auto-triage grievances on submit", ta: "சமர்ப்பிக்கும்போது புகார்களை தானியங்கி வகைப்படுத்து" },
  resolutionSuggestion: { en: "Resolution suggestions (Grievances)", ta: "தீர்வு பரிந்துரைகள் (புகார்கள்)" },
  postGenerator: { en: "Social post generator", ta: "சமூக ஊடக பதிவு உருவாக்கி" },
  pressRelease: { en: "Press release generator", ta: "செய்திக் குறிப்பு உருவாக்கி" },
  headlineSuggestion: { en: "Headline suggestions (News editor)", ta: "தலைப்பு பரிந்துரைகள் (செய்தி தொகுப்பாளர்)" },
  appointmentScoring: { en: "Auto-score appointment priority on submit", ta: "சமர்ப்பிக்கும்போது சந்திப்பு முன்னுரிமையை தானாக மதிப்பிடு" },
};
const PROMPT_LABELS: Record<keyof AiPromptTemplates, { en: string; ta: string }> = {
  triage: { en: "Grievance triage", ta: "புகார் வகைப்படுத்தல்" },
  resolution: { en: "Resolution suggestion", ta: "தீர்வு பரிந்துரை" },
  socialPost: { en: "Social post generator", ta: "சமூக ஊடக பதிவு உருவாக்கி" },
  pressRelease: { en: "Press release generator", ta: "செய்திக் குறிப்பு உருவாக்கி" },
  headline: { en: "Headline suggestions", ta: "தலைப்பு பரிந்துரைகள்" },
  activityExpand: { en: "Activity description expander", ta: "நடவடிக்கை விவர விரிவாக்கி" },
  appointmentScore: { en: "Appointment priority scoring", ta: "சந்திப்பு முன்னுரிமை மதிப்பீடு" },
};

function SettingsTab() {
  const { lang } = useLanguage();
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
    try { await adminApi.updateAiSettings(settings); setMsg(lc(lang, "Settings saved.", "அமைப்புகள் சேமிக்கப்பட்டன.")); }
    catch (e) { setMsg(e instanceof Error ? e.message : lc(lang, "Save failed", "சேமிக்க முடியவில்லை")); }
    finally { setSaving(false); }
  }

  if (!loaded) return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> {lc(lang, "Model Configuration", "மாதிரி அமைப்பு")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">{lc(lang, "Model", "மாதிரி")}</Label>
            <Select value={settings.modelName} onValueChange={(v) => setSettings(s => ({ ...s, modelName: v }))}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">{lc(lang, "gpt-4o-mini (fast, low cost)", "gpt-4o-mini (வேகம், குறைந்த செலவு)")}</SelectItem>
                <SelectItem value="gpt-4o">{lc(lang, "gpt-4o (smarter, higher cost)", "gpt-4o (கூர்மை, அதிக செலவு)")}</SelectItem>
                <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Temperature", "வெப்பநிலை")} ({settings.temperature.toFixed(1)})</Label>
              <Input type="number" min={0} max={2} step={0.1} value={settings.temperature}
                onChange={(e) => setSettings(s => ({ ...s, temperature: Math.min(2, Math.max(0, Number(e.target.value) || 0)) }))} />
              <p className="text-[11px] text-muted-foreground">{lc(lang, "0 = focused, 2 = creative", "0 = கவனம், 2 = படைப்பாற்றல்")}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Max tokens", "அதிகபட்ச டோக்கன்கள்")}</Label>
              <Input type="number" min={100} max={8000} step={100} value={settings.maxTokens}
                onChange={(e) => setSettings(s => ({ ...s, maxTokens: Math.min(8000, Math.max(100, Math.round(Number(e.target.value) || 0))) }))} />
              <p className="text-[11px] text-muted-foreground">{lc(lang, "Per-response limit", "ஒவ்வொரு பதிலுக்கான வரம்பு")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> {lc(lang, "Feature Toggles", "அம்ச நிலைமாற்றிகள்")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(settings.featureToggles) as Array<keyof AiFeatureToggles>).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm font-normal cursor-pointer">{FEATURE_LABELS[key] ? lc(lang, FEATURE_LABELS[key].en, FEATURE_LABELS[key].ta) : key}</Label>
              <Switch checked={settings.featureToggles[key]} onCheckedChange={(v) => setSettings(s => ({ ...s, featureToggles: { ...s.featureToggles, [key]: v } }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> {lc(lang, "Prompt Templates", "கட்டளை வார்ப்புருக்கள்")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{lc(lang, "Leave a field blank to use the built-in default prompt. Custom prompts must keep the JSON output instructions intact.", "உள்ளமைந்த இயல்புநிலை கட்டளையைப் பயன்படுத்த புலத்தை காலியாக விடவும். தனிப்பயன் கட்டளைகள் JSON வெளியீட்டு வழிமுறைகளை அப்படியே வைத்திருக்க வேண்டும்.")}</p>
          {(Object.keys(settings.promptTemplates) as Array<keyof AiPromptTemplates>).map((key) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{PROMPT_LABELS[key] ? lc(lang, PROMPT_LABELS[key].en, PROMPT_LABELS[key].ta) : key}</Label>
              <Textarea rows={3} placeholder={lc(lang, "(using built-in default)", "(உள்ளமைந்த இயல்புநிலையைப் பயன்படுத்துகிறது)")} value={settings.promptTemplates[key]}
                onChange={(e) => setSettings(s => ({ ...s, promptTemplates: { ...s.promptTemplates, [key]: e.target.value } }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {lc(lang, "Saving…", "சேமிக்கிறது…")}</> : lc(lang, "Save settings", "அமைப்புகளை சேமி")}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function UsageLogTab() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<Array<{ ts: string; feature: string; inLen: number; outLen: number; latencyMs: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getAiUsageLog().then((r) => setItems(r.items ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>;
  if (items.length === 0) return <div className="py-8 text-center text-sm text-muted-foreground">{lc(lang, "No AI calls recorded yet in this server session.", "இந்த சேவையக அமர்வில் இதுவரை AI அழைப்புகள் பதிவாகவில்லை.")}</div>;

  return (
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">{lc(lang, "Time", "நேரம்")}</th>
            <th className="px-3 py-2 font-medium">{lc(lang, "Feature", "அம்சம்")}</th>
            <th className="px-3 py-2 font-medium text-right">{lc(lang, "In", "உள்ளீடு")}</th>
            <th className="px-3 py-2 font-medium text-right">{lc(lang, "Out", "வெளியீடு")}</th>
            <th className="px-3 py-2 font-medium text-right">{lc(lang, "Latency", "தாமதம்")}</th>
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
  { id: "tools", label: "AI Tools", labelTa: "AI கருவிகள்", icon: Sparkles },
  { id: "qa", label: "Q&A Assistant", labelTa: "கேள்வி-பதில் உதவியாளர்", icon: MessageCircle },
  { id: "settings", label: "Settings", labelTa: "அமைப்புகள்", icon: Settings },
  { id: "usage", label: "Usage Log", labelTa: "பயன்பாட்டு பதிவு", icon: BarChart2 },
];

const TOOLS = [
  { key: "press", label: "Press Release Generator", labelTa: "செய்திக் குறிப்பு உருவாக்கி", icon: FileText, node: <PressReleaseGenerator /> },
  { key: "sentiment", label: "Sentiment Analyzer", labelTa: "உணர்வு பகுப்பாய்வி", icon: MessageSquareHeart, node: <SentimentAnalyzer /> },
  { key: "social", label: "Social Post Generator", labelTa: "சமூக ஊடக பதிவு உருவாக்கி", icon: Share2, node: <SocialPostGenerator /> },
  { key: "headline", label: "Headline Suggestions", labelTa: "தலைப்பு பரிந்துரைகள்", icon: Newspaper, node: <HeadlineSuggestions /> },
  { key: "activity", label: "Activity Expander", labelTa: "நடவடிக்கை விரிவாக்கி", icon: Zap, node: <ActivityExpander /> },
];

export default function AiToolsAdmin({ lang, role }: AiToolsAdminProps) {
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
        <h2 className="text-lg font-semibold">{lc(lang, "AI Features", "AI அம்சங்கள்")}</h2>
        {aiEnabled === true && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{lc(lang, "Active", "செயலில்")}</Badge>}
        {aiEnabled === false && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{lc(lang, "No API key", "API சாவி இல்லை")}</Badge>}
      </div>

      <AiBanner enabled={aiEnabled} />

      <div className="flex gap-1 border-b">
        {TABS.filter(t => t.id !== "settings" || canSettings).map(({ id, label, labelTa, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${tab === id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />{lc(lang, label, labelTa)}
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <div className="space-y-2">
          {TOOLS.map(({ key, label, labelTa, icon: Icon, node }) => (
            <div key={key} className="border rounded-xl overflow-hidden">
              <button onClick={() => toggle(key)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium"><Icon className="w-4 h-4 text-primary" />{lc(lang, label, labelTa)}</div>
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
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">{lc(lang, "Last 50 calls in this server session (resets on restart)", "இந்த சேவையக அமர்வில் கடைசி 50 அழைப்புகள் (மறுதொடக்கத்தில் மீட்டமைக்கப்படும்)")}</span></div>
          <UsageLogTab />
        </div>
      )}
    </div>
  );
}
