import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Activity as ActivityIcon } from "lucide-react";
import type { Language } from "@/lib/i18n";

interface EventRow {
  id: number;
  title: string;
  titleTa: string | null;
  venue: string;
  eventDate: string;
  endDate: string | null;
  category: string;
  imageUrl: string | null;
  description: string | null;
  descriptionTa: string | null;
}
interface ActivityRow {
  id: number;
  title: string;
  titleTa: string | null;
  description: string | null;
  descriptionTa: string | null;
  imageUrl: string | null;
  createdAt: string;
}
interface DiaryData {
  today: EventRow[];
  pastWeek: EventRow[];
  upcoming: EventRow[];
  recentActivities: ActivityRow[];
}

function fmtTime(iso: string, lang: Language) {
  return new Date(iso).toLocaleTimeString(lang === "ta" ? "ta-IN" : "en-IN", { hour: "numeric", minute: "2-digit" });
}
function fmtDay(iso: string, lang: Language) {
  return new Date(iso).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function EventCard({ ev, lang, when }: { ev: EventRow; lang: Language; when: "today" | "past" | "future" }) {
  const ttl = lang === "ta" ? (ev.titleTa || ev.title) : ev.title;
  const desc = lang === "ta" ? (ev.descriptionTa || ev.description) : (ev.description || ev.descriptionTa);
  const tint = when === "today" ? "border-primary/40 bg-primary/5" : when === "future" ? "border-blue-200 bg-blue-50/30" : "border-gray-200";
  return (
    <Card className={`${tint} border-l-4 overflow-hidden`}>
      <CardContent className="p-3 flex gap-3">
        {ev.imageUrl && (
          <img src={ev.imageUrl} alt={ttl} className="w-20 h-20 object-cover rounded shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{fmtTime(ev.eventDate, lang)}</span>
            <span>·</span>
            <span>{fmtDay(ev.eventDate, lang)}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{ev.category}</Badge>
          </div>
          <h3 className="font-semibold text-sm leading-tight mb-1">{ttl}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <MapPin className="w-3 h-3" /> <span className="truncate">{ev.venue}</span>
          </div>
          {desc && <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Diary({ lang = "ta" }: { lang?: Language }) {
  const [data, setData] = useState<DiaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/diary")
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const title = lang === "ta" ? "தினசரி நாட்குறிப்பு" : "Daily Diary";
  const subtitle = lang === "ta" ? "இன்று எங்கே, எதைச் செய்கிறோம்" : "Where the MLA is today, this week, and ahead";

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8 text-center text-muted-foreground">…</div>;
  if (!data) return null;

  const todayStr = new Date().toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="text-center text-sm text-muted-foreground mb-4">{todayStr}</div>

      <section className="mb-8">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          {lang === "ta" ? "இன்று" : "Today"}
          <Badge variant="secondary" className="text-xs">{data.today.length}</Badge>
        </h2>
        {data.today.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
            {lang === "ta" ? "இன்றைக்கு பொது நிகழ்வுகள் இல்லை" : "No public events today"}
          </p>
        ) : (
          <div className="grid gap-3">{data.today.map((e) => <EventCard key={e.id} ev={e} lang={lang} when="today" />)}</div>
        )}
      </section>

      {data.upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-lg mb-3">{lang === "ta" ? "வரும் நிகழ்வுகள்" : "Upcoming"}</h2>
          <div className="grid gap-3">{data.upcoming.map((e) => <EventCard key={e.id} ev={e} lang={lang} when="future" />)}</div>
        </section>
      )}

      {data.recentActivities.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-primary" />
            {lang === "ta" ? "சமீபத்திய நடவடிக்கைகள்" : "Recent Activities"}
          </h2>
          <div className="grid gap-3">
            {data.recentActivities.map((a) => {
              const ttl = lang === "ta" ? (a.titleTa || a.title) : a.title;
              const desc = lang === "ta" ? (a.descriptionTa || a.description) : (a.description || a.descriptionTa);
              return (
                <Card key={a.id}>
                  <CardContent className="p-3 flex gap-3">
                    {a.imageUrl && <img src={a.imageUrl} alt={ttl} className="w-16 h-16 object-cover rounded shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">{fmtDay(a.createdAt, lang)}</div>
                      <h3 className="font-medium text-sm leading-tight">{ttl}</h3>
                      {desc && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{desc}</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {data.pastWeek.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold text-lg mb-3">{lang === "ta" ? "கடந்த வாரம்" : "Past Week"}</h2>
          <div className="grid gap-3">{data.pastWeek.map((e) => <EventCard key={e.id} ev={e} lang={lang} when="past" />)}</div>
        </section>
      )}
    </div>
  );
}
