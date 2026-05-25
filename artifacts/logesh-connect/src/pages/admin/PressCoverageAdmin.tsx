import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, Trash2, Newspaper, Loader2, AlertCircle } from "lucide-react";
import { adminApi } from "./api";

interface Coverage {
  id: number;
  source: string;
  title: string;
  url: string;
  snippet: string | null;
  summaryEn: string | null;
  summaryTa: string | null;
  sentiment: string | null;
  sentimentScore: number | null;
  topics: string | null;
  publishedAt: string | null;
  ingestedAt: string;
}

const SENT_COLOR: Record<string, string> = {
  positive: "bg-green-100 text-green-700 border-green-200",
  neutral:  "bg-gray-100 text-gray-700 border-gray-200",
  negative: "bg-red-100 text-red-700 border-red-200",
  mixed:    "bg-amber-100 text-amber-700 border-amber-200",
};

export default function PressCoverageAdmin() {
  const [items, setItems] = useState<Coverage[]>([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function reload() {
    setLoading(true); setErr(null);
    try {
      const r = await adminApi.getPressCoverage();
      setItems(r.items ?? []);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);

  async function refresh() {
    setRefreshing(true); setErr(null); setStatus(null);
    try {
      const r = await adminApi.refreshPressCoverage(query.trim() || undefined);
      setStatus(`Added ${r.added} new article(s), ${r.skipped} already known.`);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Refresh failed"); }
    finally { setRefreshing(false); }
  }

  async function remove(id: number) {
    if (!window.confirm("Remove this article?")) return;
    await adminApi.deletePressCoverage(id);
    reload();
  }

  const counts = items.reduce((acc, it) => {
    const k = it.sentiment ?? "unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Newspaper className="w-5 h-5 text-primary" /> Press Coverage Tracker</h2>
          <p className="text-sm text-muted-foreground">News mentions auto-pulled from Google News and summarised in Tamil + English by AI.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Override query (optional)" className="w-64" />
          <Button onClick={refresh} disabled={refreshing}>
            {refreshing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Pulling…</> : <><RefreshCw className="w-4 h-4 mr-1" /> Pull latest</>}
          </Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5" />{err}
      </div>}
      {status && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{status}</div>}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(counts).map(([k, n]) => (
            <Badge key={k} variant="outline" className={SENT_COLOR[k] ?? "bg-gray-50"}>{k}: {n}</Badge>
          ))}
        </div>
      )}

      {loading && <div className="text-center text-muted-foreground py-6">Loading…</div>}
      {!loading && items.length === 0 && (
        <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
          No coverage yet. Click "Pull latest" to fetch from Google News.
        </div>
      )}

      <div className="grid gap-2">
        {items.map((it) => (
          <Card key={it.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{it.source}</Badge>
                    {it.sentiment && (
                      <Badge variant="outline" className={`text-xs ${SENT_COLOR[it.sentiment] ?? ""}`}>
                        {it.sentiment}{typeof it.sentimentScore === "number" ? ` ${it.sentimentScore}` : ""}
                      </Badge>
                    )}
                    {it.publishedAt && <span className="text-xs text-muted-foreground">{new Date(it.publishedAt).toLocaleDateString()}</span>}
                  </div>
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm hover:underline flex items-start gap-1">
                    {it.title} <ExternalLink className="w-3 h-3 mt-1 shrink-0 opacity-60" />
                  </a>
                  {it.summaryEn && <p className="text-xs text-gray-700 mt-1">{it.summaryEn}</p>}
                  {it.summaryTa && <p className="text-xs text-gray-700 mt-1">{it.summaryTa}</p>}
                  {!it.summaryEn && it.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.snippet}</p>}
                  {it.topics && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {it.topics.split(",").filter(Boolean).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t.trim()}</Badge>)}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(it.id)} className="text-red-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
