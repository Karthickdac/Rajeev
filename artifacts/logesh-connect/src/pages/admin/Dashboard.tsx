import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from "recharts";
import {
  MessageSquare, Users, Newspaper, Calendar, Image,
  TrendingUp, CheckCircle, Clock, Activity,
} from "lucide-react";
import { adminApi } from "./api";
import CdiCard from "./CdiCard";
import { MyTasksWidget } from "./TasksAdmin";
import { type Language } from "@/lib/i18n";
import { lc } from "@/lib/LeaderConfigContext";

const COLORS = ["#c9181e", "#d4af37", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

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
    totalNews: number;
    totalActivities: number;
    totalGallery: number;
  };
  grievancesByCategory: { category: string; count: number }[];
  grievancesByStatus: { status: string; count: number }[];
  grievancesByPriority: { priority: string; count: number }[];
  monthlyTrend: { month: string; submitted: number; resolved: number }[];
  recentAuditLog: { id: number; actorName: string; action: string; target: string; detail: string | null; createdAt: string }[];
}

export default function Dashboard({ lang = "ta" }: { lang?: Language }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">{lc(lang, "Loading dashboard…", "டாஷ்போர்டு ஏற்றப்படுகிறது…")}</div>;
  if (error) return <div className="text-red-500 py-10 text-center">{error}</div>;
  if (!data) return null;

  const { kpi, grievancesByCategory, grievancesByStatus, monthlyTrend, recentAuditLog } = data;

  const kpiCards = [
    { key: "Total Grievances", label: lc(lang, "Total Grievances", "மொத்த குறைகள்"), value: kpi.totalGrievances, icon: MessageSquare, color: "text-primary", bg: "bg-primary/10", tab: "grievances" },
    { key: "Open Grievances", label: lc(lang, "Open Grievances", "தீர்க்கப்படாத குறைகள்"), value: kpi.openGrievances, icon: Clock, color: "text-amber-500", bg: "bg-amber-50", tab: "grievances" },
    { key: "Resolved", label: lc(lang, "Resolved", "தீர்க்கப்பட்டது"), value: kpi.resolvedGrievances, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", tab: "grievances" },
    { key: "Resolution Rate", label: lc(lang, "Resolution Rate", "தீர்வு விகிதம்"), value: `${kpi.resolutionRate}%`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", tab: "analytics" },
    { key: "Avg Resolution", label: lc(lang, "Avg Resolution", "சராசரி தீர்வு நேரம்"), value: `${kpi.avgResolutionHours}h`, icon: Clock, color: "text-teal-600", bg: "bg-teal-50", tab: "analytics" },
    { key: "Volunteers", label: lc(lang, "Volunteers", "தன்னார்வலர்கள்"), value: kpi.totalVolunteers, icon: Users, color: "text-purple-600", bg: "bg-purple-50", tab: "volunteers" },
    { key: "Pending Volunteers", label: lc(lang, "Pending Volunteers", "நிலுவையில் உள்ள தன்னார்வலர்கள்"), value: kpi.pendingVolunteers, icon: Users, color: "text-orange-600", bg: "bg-orange-50", tab: "volunteers" },
    { key: "News Articles", label: lc(lang, "News Articles", "செய்தி கட்டுரைகள்"), value: kpi.totalNews, icon: Newspaper, color: "text-cyan-600", bg: "bg-cyan-50", tab: "news" },
    { key: "Events This Month", label: lc(lang, "Events This Month", "இந்த மாத நிகழ்வுகள்"), value: kpi.eventsThisMonth, icon: Calendar, color: "text-rose-600", bg: "bg-rose-50", tab: "events" },
    { key: "Gallery Items", label: lc(lang, "Gallery Items", "படத்தொகுப்பு உருப்படிகள்"), value: kpi.totalGallery, icon: Image, color: "text-teal-600", bg: "bg-teal-50", tab: "gallery" },
    { key: "Activities", label: lc(lang, "Activities", "செயல்பாடுகள்"), value: kpi.totalActivities, icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50", tab: "activities" },
  ];

  const goToTab = (tab: string) => {
    if (window.location.hash === `#${tab}`) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = `#${tab}`;
    }
  };

  const formatMonth = (m: string) => {
    const [year, month] = m.split("-");
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleString("en", { month: "short" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{lc(lang, "Dashboard Overview", "டாஷ்போர்டு கண்ணோட்டம்")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{lc(lang, "Real-time constituency data & grievance analytics", "நிகழ்நேர தொகுதி தரவு மற்றும் குறை பகுப்பாய்வு")}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((k) => (
          <Card
            key={k.key}
            role="button"
            tabIndex={0}
            onClick={() => goToTab(k.tab)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToTab(k.tab); } }}
            className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            data-testid={`kpi-card-${k.key.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* My Tasks Today */}
      <MyTasksWidget lang={lang} />

      {/* Constituency Development Index */}
      <CdiCard />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{lc(lang, "Monthly Grievance Trend (Last 6 Months)", "மாதாந்திர குறை போக்கு (கடந்த 6 மாதங்கள்)")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend.map(m => ({ ...m, month: formatMonth(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend iconSize={10} />
                <Line type="monotone" dataKey="submitted" stroke="#c9181e" strokeWidth={2} dot={{ r: 4 }} name={lc(lang, "Submitted", "சமர்ப்பிக்கப்பட்டது")} />
                <Line type="monotone" dataKey="resolved" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name={lc(lang, "Resolved", "தீர்க்கப்பட்டது")} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{lc(lang, "Grievances by Category", "வகை வாரியான குறைகள்")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={grievancesByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#c9181e" radius={[0, 4, 4, 0]} name={lc(lang, "Count", "எண்ணிக்கை")} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resolution rate gauge + status donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{lc(lang, "Resolution Overview", "தீர்வு கண்ணோட்டம்")}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 items-center justify-center flex-wrap">
            {/* Gauge: resolved vs open */}
            <div className="flex flex-col items-center">
              <ResponsiveContainer width={140} height={140}>
                <RadialBarChart
                  cx="50%" cy="50%"
                  innerRadius="60%" outerRadius="100%"
                  startAngle={180} endAngle={0}
                  data={[
                    { name: "Resolved", value: kpi.resolutionRate, fill: "#16a34a" },
                    { name: "Open", value: 100 - kpi.resolutionRate, fill: "#e5e7eb" },
                  ]}
                >
                  <RadialBar dataKey="value" cornerRadius={4} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-xl font-bold text-green-600 -mt-6">{kpi.resolutionRate}%</p>
              <p className="text-xs text-muted-foreground">{lc(lang, "Resolution Rate", "தீர்வு விகிதம்")}</p>
            </div>
            {/* Status breakdown donut */}
            <ResponsiveContainer width={180} height={160}>
              <PieChart>
                <Pie
                  data={grievancesByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%" cy="50%"
                  innerRadius={35} outerRadius={60}
                  label={false}
                >
                  {grievancesByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, lc(lang, "Count", "எண்ணிக்கை")]} />
                <Legend iconSize={8} formatter={(v) => <span className="text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Audit Log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{lc(lang, "Recent Admin Activity", "சமீபத்திய நிர்வாக செயல்பாடு")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAuditLog.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{lc(lang, "No admin activity yet", "இன்னும் நிர்வாக செயல்பாடு இல்லை")}</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {recentAuditLog.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-xs">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-white font-medium
                      ${log.action.startsWith("DELETE") ? "bg-red-500" :
                        log.action.startsWith("CREATE") ? "bg-green-600" : "bg-blue-600"}`}>
                      {log.action}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium">{log.actorName}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className="text-muted-foreground">{log.target}</span>
                      {log.detail && <span className="text-muted-foreground ml-1 truncate">({log.detail})</span>}
                    </div>
                    <span className="shrink-0 text-muted-foreground ml-auto">
                      {new Date(log.createdAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
