import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, MessageSquareHeart, Loader2, Copy, AlertCircle } from "lucide-react";
import { adminApi } from "./api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="sm" onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }}>
      <Copy className="w-3 h-3 mr-1" /> {copied ? "Copied" : "Copy"}
    </Button>
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
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> AI Press Release Generator</h3>
        <p className="text-xs text-muted-foreground">Type bullet points in any mix of Tamil/English; get a full bilingual release with a Minister quote.</p>
        <div className="space-y-1">
          <Label className="text-xs">Key points</Label>
          <Textarea rows={5} value={bullets} onChange={(e) => setBullets(e.target.value)}
            placeholder={"- Inaugurated new community health centre in Rasipuram\n- 50-bed facility, ₹3.2 crore project\n- Will serve 12 surrounding villages\n- Cardiac care unit coming next quarter"} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="celebratory">Celebratory</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
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
            <div className="border rounded-md p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">English</Badge>
                <CopyButton text={`${out.title_en}\n\n${out.body_en}`} />
              </div>
              <h4 className="font-bold text-sm">{out.title_en}</h4>
              <p className="text-xs whitespace-pre-wrap">{out.body_en}</p>
            </div>
            <div className="border rounded-md p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">தமிழ்</Badge>
                <CopyButton text={`${out.title_ta}\n\n${out.body_ta}`} />
              </div>
              <h4 className="font-bold text-sm">{out.title_ta}</h4>
              <p className="text-xs whitespace-pre-wrap">{out.body_ta}</p>
            </div>
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

  async function analyze() {
    setErr(null); setBusy(true); setOut(null);
    try {
      const r = await adminApi.analyzeSentiment({ text });
      setOut(r.analysis);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  const tint = out ? ({
    positive: "bg-green-50 border-green-200 text-green-700",
    neutral:  "bg-gray-50 border-gray-200 text-gray-700",
    negative: "bg-red-50 border-red-200 text-red-700",
    mixed:    "bg-amber-50 border-amber-200 text-amber-700",
  } as Record<string, string>)[out.sentiment] : "";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><MessageSquareHeart className="w-4 h-4 text-primary" /> Mention / Comment Analyzer</h3>
        <p className="text-xs text-muted-foreground">Paste any social media comment, tweet, or feedback to get sentiment, topics, and a polite suggested reply in Tamil + English.</p>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"e.g. ராசிபுரம் சாலையை இன்னும் சரி செய்யவில்லை. மழை வந்தால் பெரிய பிரச்சினை."} />
        <Button onClick={analyze} disabled={busy || !text.trim()}>
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4 mr-1" /> Analyze</>}
        </Button>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        {out && (
          <div className="space-y-3 mt-3">
            <div className={`border rounded-md p-3 ${tint}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="uppercase">{out.sentiment}</Badge>
                <span className="text-xs">score: {out.score}</span>
                {(out.topics || []).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
              <p className="text-sm mt-2">{out.summary}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between mb-1"><Badge variant="outline">Reply (EN)</Badge><CopyButton text={out.suggested_reply_en} /></div>
                <p className="text-sm">{out.suggested_reply_en}</p>
              </div>
              <div className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between mb-1"><Badge variant="outline">பதில் (TA)</Badge><CopyButton text={out.suggested_reply_ta} /></div>
                <p className="text-sm">{out.suggested_reply_ta}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AiToolsAdmin() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ai/status").then((r) => r.json()).then((d) => setEnabled(!!d.enabled)).catch(() => setEnabled(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> AI Tools</h2>
        <p className="text-sm text-muted-foreground">Bilingual press releases and sentiment analysis powered by AI.</p>
      </div>
      {enabled === false && (
        <div className="border border-amber-200 bg-amber-50 rounded p-3 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
          <span>AI is not configured. Set <code>OPENAI_API_KEY</code> to enable these tools.</span>
        </div>
      )}
      <PressReleaseGenerator />
      <SentimentAnalyzer />
    </div>
  );
}
