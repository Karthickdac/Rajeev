import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2, Clock, Hourglass, AlertCircle, Trophy, ExternalLink,
} from "lucide-react";
import type { Language } from "@/lib/i18n";

interface Promise {
  id: number;
  title: string;
  titleTa: string | null;
  description: string | null;
  descriptionTa: string | null;
  category: string;
  status: string;
  progress: number;
  announcedAt: string | null;
  targetDate: string | null;
  deliveredAt: string | null;
  imageUrl: string | null;
  proofUrl: string | null;
}
interface Resp {
  promises: Promise[];
  summary: { total: number; byStatus: Record<string, number>; deliveredPct: number };
}

const STATUS_META: Record<string, { en: string; ta: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  announced:   { en: "Announced",   ta: "அறிவிக்கப்பட்டது",  color: "text-blue-700",   bg: "bg-blue-50",   Icon: Hourglass },
  in_progress: { en: "In Progress", ta: "நடைபெறுகிறது",     color: "text-amber-700",  bg: "bg-amber-50",  Icon: Clock },
  delivered:   { en: "Delivered",   ta: "நிறைவேற்றப்பட்டது", color: "text-green-700",  bg: "bg-green-50",  Icon: CheckCircle2 },
  on_hold:     { en: "On Hold",     ta: "நிறுத்தப்பட்டது",   color: "text-gray-700",   bg: "bg-gray-100",  Icon: AlertCircle },
  dropped:     { en: "Dropped",     ta: "கைவிடப்பட்டது",    color: "text-red-700",    bg: "bg-red-50",    Icon: AlertCircle },
};

export default function Promises({ lang = "ta" }: { lang?: Language }) {
  const [data, setData] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/promises")
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const promises = (data?.promises ?? []).filter((p) => filter === "all" || p.status === filter);
  const title = lang === "ta" ? "வாக்குறுதிகள்" : "Promises";
  const subtitle = lang === "ta"
    ? "மக்களுக்கு கொடுத்த வாக்குறுதிகளும், அவற்றின் நிலையும்"
    : "Public commitments and the status of each one";

  const tabs: { id: string; label: string }[] = [
    { id: "all",         label: lang === "ta" ? "அனைத்தும்" : "All" },
    { id: "delivered",   label: STATUS_META.delivered[lang] },
    { id: "in_progress", label: STATUS_META.in_progress[lang] },
    { id: "announced",   label: STATUS_META.announced[lang] },
    { id: "on_hold",     label: STATUS_META.on_hold[lang] },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {data && data.summary.total > 0 && (
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 to-yellow-50">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-white border-4 border-primary flex items-center justify-center shrink-0">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{data.summary.deliveredPct}%</div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  {lang === "ta" ? "நிறைவேறியது" : "Delivered"}
                </div>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <h2 className="text-lg font-bold">
                  {data.summary.byStatus.delivered ?? 0} / {data.summary.total}{" "}
                  {lang === "ta" ? "வாக்குறுதிகள் நிறைவேற்றப்பட்டுள்ளன" : "promises kept"}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {Object.entries(data.summary.byStatus).map(([s, n]) => {
                  const m = STATUS_META[s];
                  if (!m) return null;
                  return (
                    <Badge key={s} variant="outline" className={`${m.color} ${m.bg} border-0`}>
                      <m.Icon className="w-3 h-3 mr-1" />{n} {m[lang]}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-4 border-b pb-3">
        {tabs.map((tb) => (
          <button key={tb.id}
            onClick={() => setFilter(tb.id)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filter === tb.id ? "bg-primary text-white border-primary" : "bg-white hover:bg-gray-50 border-gray-200"
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-muted-foreground py-10">…</div>}
      {!loading && promises.length === 0 && (
        <div className="text-center text-muted-foreground py-10 border rounded-md">
          {lang === "ta" ? "வாக்குறுதிகள் ஏதும் இல்லை" : "No promises in this view"}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {promises.map((p) => {
          const m = STATUS_META[p.status] ?? STATUS_META.announced;
          const Icon = m.Icon;
          const ttl = lang === "ta" ? (p.titleTa || p.title) : p.title;
          const desc = lang === "ta" ? (p.descriptionTa || p.description) : (p.description || p.descriptionTa);
          return (
            <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {p.imageUrl && (
                <div className="aspect-video bg-gray-100 overflow-hidden">
                  <img src={p.imageUrl} alt={ttl} className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-tight flex-1">{ttl}</h3>
                  <Badge variant="outline" className={`${m.color} ${m.bg} border-0 shrink-0`}>
                    <Icon className="w-3 h-3 mr-1" />{m[lang]}
                  </Badge>
                </div>
                {desc && <p className="text-xs text-muted-foreground line-clamp-3">{desc}</p>}
                <div className="space-y-1">
                  <Progress value={p.progress} className="h-1.5" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p.progress}%</span>
                    {p.targetDate && (
                      <span>
                        {lang === "ta" ? "இலக்கு: " : "Target: "}
                        {new Date(p.targetDate).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                {p.proofUrl && p.status === "delivered" && (
                  <a href={p.proofUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                    {lang === "ta" ? "சான்றுகள்" : "View proof"} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
