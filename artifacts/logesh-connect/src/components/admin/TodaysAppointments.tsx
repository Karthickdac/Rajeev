import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Clock, MapPin, Phone, Loader2 } from "lucide-react";
import { adminApi } from "@/pages/admin/api";
import { type Language } from "@/lib/i18n";

interface Appointment {
  id: number;
  ticketNo: string;
  name: string;
  phone: string;
  category: string;
  subject: string;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  location: string | null;
}

const STATUS_CLS: Record<string, string> = {
  Approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Rescheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
};

function goToTab(tab: string) {
  if (window.location.hash === `#${tab}`) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = `#${tab}`;
  }
}

/**
 * Compact upcoming-appointments widget.
 * - mode="today": only confirmed appointments scheduled for today (PA view).
 * - mode="next": the next N upcoming confirmed appointments (Minister read-only).
 */
export default function TodaysAppointments({
  lang = "ta",
  mode = "today",
  limit = 3,
}: {
  lang?: Language;
  mode?: "today" | "next";
  limit?: number;
}) {
  const lc = (en: string, ta: string) => (lang === "ta" ? ta : en);
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const to = mode === "today"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      : new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

    adminApi.getAppointments({ limit: 50, from: from.toISOString(), to: to.toISOString() })
      .then((res) => {
        if (cancelled) return;
        const list = ((res?.items ?? []) as Appointment[])
          .filter((a) => (a.status === "Approved" || a.status === "Rescheduled") && a.scheduledDate)
          .sort((a, b) => {
            const da = new Date(`${a.scheduledDate}`).getTime();
            const db = new Date(`${b.scheduledDate}`).getTime();
            return da - db;
          });
        setItems(mode === "next" ? list.slice(0, limit) : list);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, limit]);

  const fmtTime = (a: Appointment) => a.scheduledTime ?? a.preferredTime ?? "";
  const fmtDay = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";

  const title = mode === "today"
    ? lc("Today's Appointments", "இன்றைய சந்திப்புகள்")
    : lc("Upcoming Appointments", "வரவிருக்கும் சந்திப்புகள்");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />{title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {mode === "today"
              ? lc("No appointments scheduled today.", "இன்று சந்திப்புகள் இல்லை.")
              : lc("No upcoming appointments.", "வரவிருக்கும் சந்திப்புகள் இல்லை.")}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-xs border-b last:border-0 pb-2 last:pb-0">
                <div className="shrink-0 text-center min-w-[52px]">
                  <div className="font-semibold text-primary flex items-center justify-center gap-0.5"><Clock className="w-3 h-3" />{fmtTime(a)}</div>
                  {mode === "next" && <div className="text-[9px] text-muted-foreground">{fmtDay(a.scheduledDate)}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium truncate">{a.name}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_CLS[a.status] ?? "bg-slate-100 text-slate-600"}`}>{a.category}</span>
                  </div>
                  <p className="text-muted-foreground truncate">{a.subject}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.phone}</span>
                    {a.location && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{a.location}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {mode === "today" && (
          <Button variant="link" size="sm" className="mt-2 px-0 h-auto text-xs" onClick={() => goToTab("appointments")}>
            {lc("Manage appointments →", "சந்திப்புகளை நிர்வகி →")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
