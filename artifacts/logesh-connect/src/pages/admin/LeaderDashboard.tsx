import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  Printer, Sun, Sunrise, Sunset, CalendarClock, AlertTriangle,
  MessageSquare, TrendingUp, Clock, MapPin, Activity as ActivityIcon,
  Trophy, Users, Newspaper, ExternalLink, Megaphone, Route, Droplets,
  GraduationCap, Stethoscope, Briefcase, HeartHandshake, Building2,
} from "lucide-react";
import { adminApi } from "./api";
import CdiCard from "./CdiCard";
import { type Language } from "@/lib/i18n";
import { useLeaderConfig, lc } from "@/lib/LeaderConfigContext";

const STATUS_COLORS: Record<string, string> = {
  Submitted: "#2563eb",
  "In Progress": "#d4af37",
  Resolved: "#16a34a",
  Closed: "#0891b2",
  Rejected: "#dc2626",
};

interface DashboardData {
  kpi: {
    totalGrievances: number;
    openGrievances: number;
    resolvedGrievances: number;
    resolutionRate: number;
    avgResolutionHours: number;
    totalVolunteers: number;
    pendingVolunteers: number;
    approvedVolunteers: number;
    eventsThisMonth: number;
  };
  grievancesByStatus: { status: string; count: number }[];
  grievancesByPriority: { priority: string; count: number }[];
  monthlyTrend: { month: string; submitted: number; resolved: number }[];
}

interface PromiseItem {
  id: number;
  title: string;
  titleTa: string | null;
  status: string;
  progress: number;
  targetDate: string | null;
  deliveredAt: string | null;
}

interface ConstituencyStats {
  roadsBuiltKm: number;
  waterProjectsCompleted: number;
  schoolsUpgraded: number;
  healthClinicsOpened: number;
  jobsCreated: number;
  beneficiariesServed: number;
  totalProjects: number;
  completedProjects: number;
  ongoingProjects: number;
}

interface EventItem {
  id: number;
  title: string;
  titleTa: string | null;
  venue: string;
  eventDate: string;
  category: string;
}

interface ActivityItem {
  id: number;
  title: string;
  titleTa: string | null;
  location: string | null;
  activityDate: string;
  category: string;
}

interface NewsItem {
  id: number;
  title: string;
  titleTa: string | null;
  category: string;
  publishedAt: string | null;
}

interface PressItem {
  id: number;
  source: string;
  title: string;
  url: string;
  sentiment: string | null;
  publishedAt: string | null;
}

const DEFAULT_TARGETS: Record<keyof Omit<ConstituencyStats, "totalProjects" | "completedProjects" | "ongoingProjects">, number> = {
  roadsBuiltKm: 100,
  waterProjectsCompleted: 50,
  schoolsUpgraded: 30,
  healthClinicsOpened: 20,
  jobsCreated: 10000,
  beneficiariesServed: 50000,
};

function goToTab(tab: string) {
  if (window.location.hash === `#${tab}`) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = `#${tab}`;
  }
}

export default function LeaderDashboard({ lang = "ta", readOnly = false }: { lang?: Language; readOnly?: boolean }) {
  const leader = useLeaderConfig();
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [promises, setPromises] = useState<PromiseItem[]>([]);
  const [stats, setStats] = useState<ConstituencyStats | null>(null);
  const [targets, setTargets] = useState<Record<string, number>>(DEFAULT_TARGETS);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [press, setPress] = useState<PressItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminApi.getDashboard(),
      adminApi.getPublicPromises(),
      adminApi.getConstituencyStats(),
      adminApi.getEvents(1, 50),
      adminApi.getActivities(1, 10),
      adminApi.getNews(1, 5),
      adminApi.getPublicPressCoverage(),
      adminApi.getSettings(),
    ]).then((results) => {
      if (cancelled) return;
      const [rDash, rProm, rStats, rEvents, rAct, rNews, rPress, rSettings] = results;
      if (rDash.status === "fulfilled") setDash(rDash.value as DashboardData);
      if (rProm.status === "fulfilled") setPromises((rProm.value?.promises ?? []) as PromiseItem[]);
      if (rStats.status === "fulfilled") setStats(rStats.value as ConstituencyStats);
      if (rEvents.status === "fulfilled") setEvents((rEvents.value?.items ?? []) as EventItem[]);
      if (rAct.status === "fulfilled") setActivities((rAct.value?.items ?? []) as ActivityItem[]);
      if (rNews.status === "fulfilled") setNews((rNews.value?.items ?? []) as NewsItem[]);
      if (rPress.status === "fulfilled") setPress((rPress.value?.items ?? []) as PressItem[]);
      if (rSettings.status === "fulfilled") {
        const t = (rSettings.value as Record<string, unknown>)?.milestone_targets;
        if (t && typeof t === "object") setTargets({ ...DEFAULT_TARGETS, ...(t as Record<string, number>) });
      }
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

  const todayStr = new Date().toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const now = Date.now();
  const upcomingEvents = [...events]
    .filter((e) => new Date(e.eventDate).getTime() >= now - 86400000)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  const next5Events = upcomingEvents.slice(0, 5);

  const highPriorityCount = (dash?.grievancesByPriority ?? [])
    .filter((p) => /high|urgent|critical/i.test(p.priority))
    .reduce((s, p) => s + p.count, 0);

  const latestMonth = dash?.monthlyTrend?.[dash.monthlyTrend.length - 1];

  // Promise rollups
  const promiseStatus = {
    delivered: promises.filter((p) => p.status === "delivered").length,
    inProgress: promises.filter((p) => p.status === "in_progress").length,
    pending: promises.filter((p) => p.status === "announced" || p.status === "on_hold").length,
  };
  const promiseTotal = promises.length;
  const promiseRing = [
    { name: lc(lang, "Delivered", "நிறைவேற்றப்பட்டது"), value: promiseStatus.delivered, fill: "#16a34a" },
    { name: lc(lang, "In Progress", "நடைபெறுகிறது"), value: promiseStatus.inProgress, fill: "#d4af37" },
    { name: lc(lang, "Pending", "நிலுவையில்"), value: promiseStatus.pending, fill: "#94a3b8" },
  ];
  const nextDuePromises = promises
    .filter((p) => p.status !== "delivered" && p.status !== "dropped" && p.targetDate)
    .sort((a, b) => new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime())
    .slice(0, 3);

  const milestoneDefs: { key: keyof typeof DEFAULT_TARGETS; label: string; Icon: typeof Route }[] = [
    { key: "roadsBuiltKm", label: lc(lang, "Roads built (km)", "சாலைகள் (கி.மீ)"), Icon: Route },
    { key: "waterProjectsCompleted", label: lc(lang, "Water projects", "நீர் திட்டங்கள்"), Icon: Droplets },
    { key: "schoolsUpgraded", label: lc(lang, "Schools upgraded", "பள்ளிகள்"), Icon: GraduationCap },
    { key: "healthClinicsOpened", label: lc(lang, "Health clinics", "சுகாதார மையங்கள்"), Icon: Stethoscope },
    { key: "jobsCreated", label: lc(lang, "Jobs created", "வேலைவாய்ப்புகள்"), Icon: Briefcase },
    { key: "beneficiariesServed", label: lc(lang, "Beneficiaries served", "பயனாளிகள்"), Icon: HeartHandshake },
  ];

  const sentimentColor = (s: string | null) =>
    s === "positive" ? "bg-green-100 text-green-700"
      : s === "negative" ? "bg-red-100 text-red-700"
        : s === "mixed" ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-600";

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">{lc(lang, "Loading leader dashboard…", "தலைமை டாஷ்போர்டு ஏற்றுகிறது…")}</div>;
  }

  return (
    <div className="space-y-5 leader-print">
      {/* Header + print */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{lc(lang, "Leader Dashboard", "தலைமை டாஷ்போர்டு")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{lc(lang, "Daily leadership briefing at a glance", "ஒரே பார்வையில் தினசரி தலைமை அறிக்கை")}</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          {readOnly && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
              {lc(lang, "Read-only", "பார்வை மட்டும்")}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-dashboard">
            <Printer className="w-4 h-4 mr-1.5" />
            {lc(lang, "Print / Export", "அச்சு / ஏற்றுமதி")}
          </Button>
        </div>
      </div>

      {/* Today at a Glance */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-yellow-50/40 to-white print-block">
        <CardContent className="p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <img
              src={leader.photoUrl}
              alt={name}
              className="w-16 h-16 rounded-full object-cover border-2 border-primary/40 shadow-sm"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 text-primary">
                <greeting.Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{greeting.text}, {name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{todayStr}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => goToTab("events")}
                className="text-left rounded-lg bg-white border px-4 py-2.5 hover:border-primary/40 hover:shadow-sm transition-all no-print"
                data-testid="glance-upcoming-events"
              >
                <div className="flex items-center gap-1.5 text-blue-600">
                  <CalendarClock className="w-4 h-4" />
                  <span className="text-2xl font-bold">{upcomingEvents.length}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{lc(lang, "Upcoming events", "வரவிருக்கும் நிகழ்வுகள்")}</p>
              </button>
              <button
                onClick={() => goToTab("grievances")}
                className="text-left rounded-lg bg-white border px-4 py-2.5 hover:border-primary/40 hover:shadow-sm transition-all no-print"
                data-testid="glance-high-priority"
              >
                <div className="flex items-center gap-1.5 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-2xl font-bold">{highPriorityCount}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{lc(lang, "High-priority pending", "உயர் முன்னுரிமை நிலுவை")}</p>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CDI */}
      <div className="print-block"><CdiCard /></div>

      {/* Grievance Health + Promise Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="print-block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              {lc(lang, "Grievance Health", "புகார் நிலை")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center flex-wrap">
              <ResponsiveContainer width={170} height={160}>
                <PieChart>
                  <Pie data={dash?.grievancesByStatus ?? []} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={38} outerRadius={62}>
                    {(dash?.grievancesByStatus ?? []).map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, lc(lang, "Count", "எண்ணிக்கை")]} />
                  <Legend iconSize={8} formatter={(v) => <span className="text-[11px]">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 grid grid-cols-2 gap-3 min-w-[180px]">
                <div className="rounded-lg bg-amber-50 p-2.5">
                  <div className="flex items-center gap-1 text-amber-600"><Clock className="w-3.5 h-3.5" /><span className="text-lg font-bold">{dash?.kpi.openGrievances ?? 0}</span></div>
                  <p className="text-[10px] text-muted-foreground">{lc(lang, "Open", "திறந்தவை")}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-2.5">
                  <div className="flex items-center gap-1 text-green-600"><TrendingUp className="w-3.5 h-3.5" /><span className="text-lg font-bold">{dash?.kpi.resolutionRate ?? 0}%</span></div>
                  <p className="text-[10px] text-muted-foreground">{lc(lang, "Resolution rate", "தீர்வு விகிதம்")}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-2.5">
                  <div className="flex items-center gap-1 text-blue-600"><Clock className="w-3.5 h-3.5" /><span className="text-lg font-bold">{dash?.kpi.avgResolutionHours ?? 0}h</span></div>
                  <p className="text-[10px] text-muted-foreground">{lc(lang, "Avg resolution", "சராசரி தீர்வு")}</p>
                </div>
                <div className="rounded-lg bg-rose-50 p-2.5">
                  <div className="flex items-center gap-1 text-rose-600"><MessageSquare className="w-3.5 h-3.5" /><span className="text-lg font-bold">{latestMonth?.submitted ?? 0}</span></div>
                  <p className="text-[10px] text-muted-foreground">{lc(lang, "New this month", "இம்மாதம் புதியவை")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="print-block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              {lc(lang, "Promise Tracker", "வாக்குறுதி கண்காணிப்பு")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center flex-wrap">
              <div className="relative">
                <ResponsiveContainer width={150} height={150}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="100%" barSize={10} data={promiseRing} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={5} background />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{promiseStatus.delivered}/{promiseTotal}</span>
                  <span className="text-[10px] text-muted-foreground">{lc(lang, "delivered", "நிறைவேறியது")}</span>
                </div>
              </div>
              <div className="flex-1 min-w-[160px] space-y-2">
                {promiseRing.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
                    <span className="text-muted-foreground flex-1">{p.name}</span>
                    <span className="font-semibold">{p.value}</span>
                  </div>
                ))}
                {nextDuePromises.length > 0 && (
                  <div className="pt-1.5 mt-1.5 border-t">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">{lc(lang, "Next due", "அடுத்த காலக்கெடு")}</p>
                    {nextDuePromises.map((p) => (
                      <div key={p.id} className="flex justify-between text-[11px] py-0.5">
                        <span className="truncate max-w-[120px]">{lc(lang, p.title, p.titleTa || p.title)}</span>
                        <span className="text-muted-foreground shrink-0">{fmtDate(p.targetDate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => goToTab("promises")} className="text-[11px] text-primary hover:underline mt-2 no-print">
              {lc(lang, "View all promises →", "அனைத்து வாக்குறுதிகள் →")}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Development Milestones */}
      <Card className="print-block">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            {lc(lang, "Development Milestones", "வளர்ச்சி மைல்கற்கள்")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{lc(lang, "No constituency stats yet.", "தொகுதி புள்ளிவிவரம் இல்லை.")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestoneDefs.map(({ key, label, Icon }) => {
                const value = stats[key] ?? 0;
                const target = targets[key] || DEFAULT_TARGETS[key];
                const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="w-3.5 h-3.5 text-primary" />{label}</span>
                      <span className="font-semibold">{value.toLocaleString()} <span className="opacity-50 font-normal">/ {target.toLocaleString()}</span></span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {stats && (
            <div className="flex gap-4 mt-4 pt-3 border-t text-xs">
              <span className="text-muted-foreground">{lc(lang, "Projects", "திட்டங்கள்")}: <b className="text-gray-900">{stats.completedProjects}</b> / {stats.totalProjects} {lc(lang, "completed", "முடிந்தது")}</span>
              <span className="text-muted-foreground">{lc(lang, "Ongoing", "நடைபெறுபவை")}: <b className="text-gray-900">{stats.ongoingProjects}</b></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Schedule + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="print-block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              {lc(lang, "Upcoming Schedule", "வரவிருக்கும் அட்டவணை")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {next5Events.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{lc(lang, "No upcoming events.", "வரவிருக்கும் நிகழ்வுகள் இல்லை.")}</p>
            ) : (
              <div className="space-y-2.5">
                {next5Events.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 text-xs">
                    <div className="shrink-0 w-12 text-center rounded bg-primary/10 py-1">
                      <div className="text-sm font-bold text-primary">{new Date(e.eventDate).getDate()}</div>
                      <div className="text-[9px] uppercase text-muted-foreground">{new Date(e.eventDate).toLocaleDateString("en", { month: "short" })}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{lc(lang, e.title, e.titleTa || e.title)}</p>
                      <p className="text-muted-foreground flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{e.venue}</p>
                    </div>
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{e.category}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="print-block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-primary" />
              {lc(lang, "Recent Activities", "சமீபத்திய நடவடிக்கைகள்")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{lc(lang, "No activities yet.", "நடவடிக்கைகள் இல்லை.")}</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {activities.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-xs border-b last:border-0 pb-1.5 last:pb-0">
                    <ActivityIcon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{lc(lang, a.title, a.titleTa || a.title)}</p>
                      <p className="text-muted-foreground truncate">
                        {fmtDate(a.activityDate)}{a.location ? ` · ${a.location}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outreach Pulse + Press & Media */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="print-block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {lc(lang, "Outreach Pulse", "மக்கள் தொடர்பு")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-purple-50 p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{dash?.kpi.totalVolunteers ?? 0}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{lc(lang, "Total volunteers", "மொத்த தன்னார்வலர்")}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{dash?.kpi.approvedVolunteers ?? 0}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{lc(lang, "Approved", "அங்கீகரிக்கப்பட்டது")}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{dash?.kpi.pendingVolunteers ?? 0}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{lc(lang, "Pending approval", "ஒப்புதல் நிலுவை")}</p>
              </div>
            </div>
            <button onClick={() => goToTab("volunteers")} className="text-[11px] text-primary hover:underline mt-3 no-print flex items-center gap-1">
              <Megaphone className="w-3 h-3" />{lc(lang, "Manage volunteers →", "தன்னார்வலர்களை நிர்வகி →")}
            </button>
          </CardContent>
        </Card>

        <Card className="print-block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-primary" />
              {lc(lang, "Press & Media", "செய்தி & ஊடகம்")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1.5">{lc(lang, "Latest news", "சமீபத்திய செய்திகள்")}</p>
              {news.length === 0 ? (
                <p className="text-xs text-muted-foreground">{lc(lang, "No news yet.", "செய்திகள் இல்லை.")}</p>
              ) : (
                <div className="space-y-1">
                  {news.slice(0, 5).map((n) => (
                    <div key={n.id} className="flex justify-between gap-2 text-xs">
                      <span className="truncate">{lc(lang, n.title, n.titleTa || n.title)}</span>
                      <span className="text-muted-foreground shrink-0">{fmtDate(n.publishedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {press.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-[10px] uppercase text-muted-foreground mb-1.5">{lc(lang, "Press coverage", "ஊடக செய்திகள்")}</p>
                <div className="space-y-1.5">
                  {press.slice(0, 5).map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2 text-xs group">
                      <span className="truncate group-hover:text-primary flex items-center gap-1">
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />{p.title}
                      </span>
                      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full ${sentimentColor(p.sentiment)}`}>{p.source}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
