import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Activity as ActivityIcon, Trophy, Newspaper, ExternalLink, MapPin } from "lucide-react";
import { adminApi } from "./api";
import { type Language } from "@/lib/i18n";
import { lc } from "@/lib/LeaderConfigContext";

type Section = "events" | "activities" | "promises" | "press";

interface Row {
  id: number;
  title: string;
  titleTa?: string | null;
  subtitle?: string | null;
  date?: string | null;
  url?: string | null;
  badge?: string | null;
  progress?: number | null;
}

const META: Record<Section, { en: string; ta: string; Icon: typeof CalendarClock }> = {
  events: { en: "Today's Schedule & Events", ta: "அட்டவணை & நிகழ்வுகள்", Icon: CalendarClock },
  activities: { en: "Recent Activities", ta: "சமீபத்திய செயல்பாடுகள்", Icon: ActivityIcon },
  promises: { en: "Promises Tracker", ta: "வாக்குறுதிகள்", Icon: Trophy },
  press: { en: "Press & News", ta: "செய்தி & ஊடகம்", Icon: Newspaper },
};

export default function MinisterReadOnly({ lang = "ta", section }: { lang?: Language; section: Section }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = META[section];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchFor = async (): Promise<Row[]> => {
      if (section === "events") {
        const r = await adminApi.getEvents(1, 50);
        const items = (r?.items ?? []) as { id: number; title: string; titleTa: string | null; venue: string; eventDate: string }[];
        const now = Date.now();
        return items
          .filter((e) => new Date(e.eventDate).getTime() >= now - 86400000)
          .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
          .map((e) => ({ id: e.id, title: e.title, titleTa: e.titleTa, subtitle: e.venue, date: e.eventDate }));
      }
      if (section === "activities") {
        const r = await adminApi.getActivities(1, 20);
        const items = (r?.items ?? []) as { id: number; title: string; titleTa: string | null; location: string | null; activityDate: string }[];
        return items.map((a) => ({ id: a.id, title: a.title, titleTa: a.titleTa, subtitle: a.location, date: a.activityDate }));
      }
      if (section === "promises") {
        const r = await adminApi.getPublicPromises();
        const items = (r?.promises ?? []) as { id: number; title: string; titleTa: string | null; status: string; progress: number; targetDate: string | null }[];
        return items.map((p) => ({ id: p.id, title: p.title, titleTa: p.titleTa, badge: p.status, progress: p.progress, date: p.targetDate }));
      }
      // press + news combined
      const [rPress, rNews] = await Promise.allSettled([adminApi.getPublicPressCoverage(), adminApi.getNews(1, 10)]);
      const out: Row[] = [];
      if (rPress.status === "fulfilled") {
        for (const p of (rPress.value?.items ?? []) as { id: number; source: string; title: string; url: string; publishedAt: string | null }[]) {
          out.push({ id: 100000 + p.id, title: p.title, subtitle: p.source, url: p.url, date: p.publishedAt, badge: "Press" });
        }
      }
      if (rNews.status === "fulfilled") {
        for (const n of (rNews.value?.items ?? []) as { id: number; title: string; titleTa: string | null; publishedAt: string | null }[]) {
          out.push({ id: n.id, title: n.title, titleTa: n.titleTa, date: n.publishedAt, badge: "News" });
        }
      }
      return out.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
    };
    fetchFor().then((r) => { if (!cancelled) { setRows(r); setLoading(false); } }).catch(() => { if (!cancelled) { setRows([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [section]);

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const Icon = meta.Icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">{lc(lang, meta.en, meta.ta)}</h1>
        <span className="text-xs text-muted-foreground ml-1">{lc(lang, "(read-only)", "(பார்வைக்கு மட்டும்)")}</span>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{rows.length} {lc(lang, "items", "உருப்படிகள்")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">{lc(lang, "Nothing to show.", "எதுவும் இல்லை.")}</p>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <div key={`${section}-${row.id}`} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {row.badge && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{row.badge === "Press" ? lc(lang, "Press", "ஊடகம்") : row.badge === "News" ? lc(lang, "News", "செய்திகள்") : row.badge}</span>}
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate hover:text-primary flex items-center gap-1">
                          {row.title}<ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-sm font-medium truncate">{lc(lang, row.title, row.titleTa || row.title)}</span>
                      )}
                    </div>
                    {row.subtitle && <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{row.subtitle}</p>}
                    {typeof row.progress === "number" && (
                      <div className="mt-1 h-1.5 w-40 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, row.progress))}%` }} />
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(row.date)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
