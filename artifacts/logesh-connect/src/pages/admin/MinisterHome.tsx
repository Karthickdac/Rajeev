import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sunrise, Sun, Sunset, CalendarClock, AlertTriangle, MessageSquare,
  Newspaper, ExternalLink, ArrowRight, MapPin, Crown, LayoutDashboard,
} from "lucide-react";
import { adminApi } from "./api";
import CdiCard from "./CdiCard";
import { type Language } from "@/lib/i18n";
import { useLeaderConfig, lc } from "@/lib/LeaderConfigContext";
import TodaysAppointments from "@/components/admin/TodaysAppointments";

interface EventItem {
  id: number;
  title: string;
  titleTa: string | null;
  venue: string;
  eventDate: string;
}
interface PressItem {
  id: number;
  source: string;
  title: string;
  url: string;
  publishedAt: string | null;
}
interface NewsItem {
  id: number;
  title: string;
  titleTa: string | null;
  publishedAt: string | null;
}

function goToTab(tab: string) {
  if (window.location.hash === `#${tab}`) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = `#${tab}`;
  }
}

export default function MinisterHome({ lang = "ta" }: { lang?: Language }) {
  const leader = useLeaderConfig();
  const [highPriority, setHighPriority] = useState(0);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [press, setPress] = useState<PressItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminApi.getDashboard(),
      adminApi.getEvents(1, 50),
      adminApi.getPublicPressCoverage(),
      adminApi.getNews(1, 5),
    ]).then((results) => {
      if (cancelled) return;
      const [rDash, rEvents, rPress, rNews] = results;
      if (rDash.status === "fulfilled") {
        const byPriority = (rDash.value?.grievancesByPriority ?? []) as { priority: string; count: number }[];
        setHighPriority(byPriority.filter((p) => /high|urgent|critical/i.test(p.priority)).reduce((s, p) => s + p.count, 0));
      }
      if (rEvents.status === "fulfilled") setEvents((rEvents.value?.items ?? []) as EventItem[]);
      if (rPress.status === "fulfilled") setPress((rPress.value?.items ?? []) as PressItem[]);
      if (rNews.status === "fulfilled") setNews((rNews.value?.items ?? []) as NewsItem[]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const name = lc(lang, leader.nameEn, leader.nameTa);
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? { text: lc(lang, "Good morning", "காலை வணக்கம்"), Icon: Sunrise }
    : hour < 17
      ? { text: lc(lang, "Good afternoon", "மதிய வணக்கம்"), Icon: Sun }
      : { text: lc(lang, "Good evening", "மாலை வணக்கம்"), Icon: Sunset };
  const GreetIcon = greeting.Icon;

  const todayStr = new Date().toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short" }) : "—";
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString(lang === "ta" ? "ta-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" });

  const isSameDay = (d: Date, ref: Date) =>
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
  const todayRef = new Date();
  const todayEvents = events
    .filter((e) => isSameDay(new Date(e.eventDate), todayRef))
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Morning briefing hero */}
      <Card className="overflow-hidden border-[#d4af37]/40 bg-gradient-to-br from-[#0a1f44] via-[#0a1f44] to-[#13284f] text-white">
        <CardContent className="p-5 flex items-center gap-4">
          <img
            src={leader.photoUrl}
            alt={name}
            className="w-16 h-16 rounded-full object-cover border-2 border-[#d4af37] shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[#d4af37] text-sm font-medium">
              <GreetIcon className="w-4 h-4" />
              {greeting.text}
            </div>
            <h1 className="text-xl font-bold truncate flex items-center gap-2">
              {name}
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d4af37] text-[#0a1f44]">
                <Crown className="w-3 h-3" />{lc(lang, "Minister", "அமைச்சர்")}
              </span>
            </h1>
            <p className="text-xs text-white/70 mt-0.5">{todayStr}</p>
          </div>
        </CardContent>
      </Card>

      {/* At-a-glance tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => goToTab("minister-events")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{todayEvents.length}</div>
              <p className="text-xs text-muted-foreground">{lc(lang, "Events today", "இன்றைய நிகழ்வுகள்")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => goToTab("grievances")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{highPriority}</div>
              <p className="text-xs text-muted-foreground">{lc(lang, "High-priority grievances", "முன்னுரிமை புகார்கள்")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => goToTab("minister-press")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{press.length + news.length}</div>
              <p className="text-xs text-muted-foreground">{lc(lang, "Latest headlines", "சமீபத்திய தலைப்புச் செய்திகள்")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CDI summary */}
      <CdiCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's schedule */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              {lc(lang, "Today's Schedule", "இன்றைய அட்டவணை")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{lc(lang, "No events scheduled today.", "இன்று நிகழ்வுகள் இல்லை.")}</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-xs border-b last:border-0 pb-2 last:pb-0">
                    <span className="shrink-0 font-semibold text-primary">{fmtTime(e.eventDate)}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{lc(lang, e.title, e.titleTa || e.title)}</p>
                      <p className="text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{e.venue}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming appointments (read-only) */}
        <TodaysAppointments lang={lang} mode="next" limit={3} />

        {/* Latest press & news */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-primary" />
              {lc(lang, "Latest Headlines", "சமீபத்திய தலைப்புச் செய்திகள்")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {press.slice(0, 3).map((p) => (
              <a key={`p${p.id}`} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2 text-xs group">
                <span className="truncate group-hover:text-primary flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />{p.title}
                </span>
                <span className="shrink-0 text-[9px] text-muted-foreground">{p.source} · {fmtDate(p.publishedAt)}</span>
              </a>
            ))}
            {news.slice(0, 3).map((n) => (
              <div key={`n${n.id}`} className="flex items-start justify-between gap-2 text-xs">
                <span className="truncate">{lc(lang, n.title, n.titleTa || n.title)}</span>
                <span className="shrink-0 text-[9px] text-muted-foreground">{fmtDate(n.publishedAt)}</span>
              </div>
            ))}
            {press.length === 0 && news.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">{lc(lang, "No recent coverage.", "சமீபத்திய செய்திகள் இல்லை.")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={() => goToTab("grievances")} className="gap-2">
          <MessageSquare className="w-4 h-4" />
          {lc(lang, "Review Grievances", "புகார்களை பார்")}
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button onClick={() => goToTab("leader-dashboard")} className="gap-2">
          <LayoutDashboard className="w-4 h-4" />
          {lc(lang, "View Full Dashboard", "முழு டாஷ்போர்டு பார்")}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
