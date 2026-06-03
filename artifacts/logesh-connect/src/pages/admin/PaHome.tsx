import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarClock, MessageSquare, AlertTriangle, Users, MapPin,
  Plus, Newspaper, Activity as ActivityIcon, ClipboardList, Loader2,
  UserCheck, Radio,
} from "lucide-react";
import { adminApi } from "./api";
import { type Language } from "@/lib/i18n";
import { lc } from "@/lib/LeaderConfigContext";

interface EventItem {
  id: number;
  title: string;
  titleTa: string | null;
  venue: string;
  eventDate: string;
}
interface GrievanceItem {
  id: number;
  ticketNo: string;
  name: string;
  category: string;
  ward: string | null;
  priority: string;
  status: string;
  createdAt: string;
}

const OPEN_STATUSES = ["Submitted", "Under Review", "Assigned", "In Progress"];
const PRIORITY_COLOR: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};

function goToTab(tab: string) {
  if (window.location.hash === `#${tab}`) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = `#${tab}`;
  }
}

export default function PaHome({ lang = "ta" }: { lang?: Language }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [grievances, setGrievances] = useState<GrievanceItem[]>([]);
  const [escalations, setEscalations] = useState(0);
  const [highPriority, setHighPriority] = useState(0);
  const [newVolunteers, setNewVolunteers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadGrievances = () =>
    adminApi.getGrievances(1).then((r) => {
      setGrievances(((r?.items ?? []) as GrievanceItem[]).filter((g) => OPEN_STATUSES.includes(g.status)).slice(0, 10));
    }).catch(() => setGrievances([]));

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminApi.getDashboard(),
      adminApi.getEvents(1, 50),
      adminApi.getGrievances(1),
      adminApi.getEscalations?.(),
    ]).then((results) => {
      if (cancelled) return;
      const [rDash, rEvents, rGriev, rEsc] = results;
      if (rDash.status === "fulfilled") {
        const d = rDash.value as { grievancesByPriority?: { priority: string; count: number }[]; kpi?: { newVolunteersThisWeek?: number } };
        setHighPriority((d.grievancesByPriority ?? []).filter((p) => /high|urgent|critical/i.test(p.priority)).reduce((s, p) => s + p.count, 0));
        setNewVolunteers(d.kpi?.newVolunteersThisWeek ?? 0);
      }
      if (rEvents.status === "fulfilled") setEvents((rEvents.value?.items ?? []) as EventItem[]);
      if (rGriev.status === "fulfilled") {
        setGrievances(((rGriev.value?.items ?? []) as GrievanceItem[]).filter((g) => OPEN_STATUSES.includes(g.status)).slice(0, 10));
      }
      if (rEsc && rEsc.status === "fulfilled") {
        const e = rEsc.value as { items?: unknown[] } | unknown[];
        setEscalations(Array.isArray(e) ? e.length : (e?.items?.length ?? 0));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString(lang === "ta" ? "ta-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" });
  const fmtDay = (d: string) =>
    new Date(d).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" });

  const now = Date.now();
  const upcoming = [...events]
    .filter((e) => {
      const t = new Date(e.eventDate).getTime();
      return t >= now - 86400000 && t <= now + 2 * 86400000;
    })
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await adminApi.updateGrievanceStatus(id, status);
      await loadGrievances();
    } catch {
      /* swallow — list reload reflects truth */
    } finally {
      setUpdatingId(null);
    }
  };

  const quickActions = [
    { label: lc(lang, "Log Activity", "செயல்பாடு பதிவு"), icon: ActivityIcon, tab: "activities" },
    { label: lc(lang, "Add Event", "நிகழ்வு சேர்"), icon: Plus, tab: "events" },
    { label: lc(lang, "Post News", "செய்தி இடு"), icon: Newspaper, tab: "news" },
    { label: lc(lang, "Assign Grievance", "புகார் ஒதுக்கு"), icon: UserCheck, tab: "grievances" },
    { label: lc(lang, "Send Broadcast", "ஒளிபரப்பு அனுப்பு"), icon: Radio, tab: "broadcast" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{lc(lang, "PA Workspace", "தனிப்பட்ட உதவியாளர் பணியிடம்")}</h1>
        <p className="text-sm text-muted-foreground">{lc(lang, "Your daily workflow at a glance.", "உங்கள் தினசரி பணிகள் ஒரே பார்வையில்.")}</p>
      </div>

      {/* Top stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CalendarClock className="w-4 h-4" />{lc(lang, "Upcoming events", "வரவிருக்கும் நிகழ்வுகள்")}</div>
          <div className="text-2xl font-bold">{upcoming.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MessageSquare className="w-4 h-4" />{lc(lang, "Open grievances", "திறந்த புகார்கள்")}</div>
          <div className="text-2xl font-bold">{grievances.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="w-4 h-4" />{lc(lang, "Pending tasks", "நிலுவை பணிகள்")}</div>
          <div className="text-2xl font-bold">{escalations + highPriority}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Users className="w-4 h-4" />{lc(lang, "New volunteers", "புதிய தன்னார்வலர்கள்")}</div>
          <div className="text-2xl font-bold">{newVolunteers}</div>
        </CardContent></Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{lc(lang, "Quick Actions", "விரைவு செயல்கள்")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.tab} variant="outline" size="sm" className="gap-2" onClick={() => goToTab(a.tab)}>
                <Icon className="w-4 h-4" />{a.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Grievance queue */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" />{lc(lang, "Grievance Queue", "புகார் வரிசை")}</CardTitle></CardHeader>
          <CardContent>
            {grievances.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{lc(lang, "No open grievances. 🎉", "திறந்த புகார்கள் இல்லை. 🎉")}</p>
            ) : (
              <div className="space-y-2">
                {grievances.map((g) => (
                  <div key={g.id} className="border-b last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{g.ticketNo}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[g.priority] ?? "bg-slate-100 text-slate-600"}`}>{g.priority}</span>
                    </div>
                    <p className="text-xs font-medium truncate">{g.category}{g.ward ? ` · ${g.ward}` : ""}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{g.status}</span>
                      <div className="flex gap-1">
                        {g.status !== "In Progress" && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" disabled={updatingId === g.id} onClick={() => updateStatus(g.id, "In Progress")}>
                            {updatingId === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : lc(lang, "Start", "தொடங்கு")}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-green-700" disabled={updatingId === g.id} onClick={() => updateStatus(g.id, "Resolved")}>
                          {lc(lang, "Resolve", "தீர்")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="link" size="sm" className="mt-2 px-0 h-auto text-xs" onClick={() => goToTab("grievances")}>{lc(lang, "Open full grievance list →", "முழு புகார் பட்டியல் →")}</Button>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" />{lc(lang, "Schedule (next 48h)", "அட்டவணை (அடுத்த 48 மணி)")}</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{lc(lang, "Nothing scheduled soon.", "விரைவில் எதுவும் இல்லை.")}</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-xs border-b last:border-0 pb-2 last:pb-0">
                    <div className="shrink-0 text-center">
                      <div className="font-semibold text-primary">{fmtTime(e.eventDate)}</div>
                      <div className="text-[9px] text-muted-foreground">{fmtDay(e.eventDate)}</div>
                    </div>
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
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-900">
            {lc(lang,
              `You have ${escalations} escalation(s) and ${highPriority} high-priority grievance(s) needing attention.`,
              `${escalations} மேல்முறையீடு(கள்) மற்றும் ${highPriority} முன்னுரிமை புகார்(கள்) கவனம் தேவை.`)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
