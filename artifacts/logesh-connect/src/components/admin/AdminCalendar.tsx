import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { adminApi } from "@/pages/admin/api";
import { type Language, tTask } from "@/lib/i18n";

// Each data source maps to a coloured chip. Appointments are provisioned for
// when the appointments feature lands; the source is fetched defensively and
// silently skipped if the endpoint is unavailable.
type SourceType = "event" | "activity" | "task" | "appointment";

interface CalItem {
  id: string;
  type: SourceType;
  title: string;
  date: Date;
  time?: string | null;
  navTab: string; // admin tab id to deep-link to
}

const SOURCE_STYLE: Record<SourceType, { chip: string; dot: string }> = {
  event:       { chip: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  appointment: { chip: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  activity:    { chip: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  task:        { chip: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-500" },
};

function startOfMonthGrid(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const grid = new Date(first);
  grid.setDate(first.getDate() - first.getDay()); // back to Sunday
  return grid;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

const HOUR_START = 7;
const HOUR_END = 22;

export default function AdminCalendar({
  lang = "ta",
  onNavigate,
}: {
  lang?: Language;
  onNavigate?: (tab: string) => void;
}) {
  const tt = useCallback((k: Parameters<typeof tTask>[1]) => tTask(lang, k), [lang]);
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [items, setItems] = useState<CalItem[]>([]);
  const [filters, setFilters] = useState<Record<SourceType, boolean>>({
    event: true, appointment: true, activity: true, task: true,
  });
  const [selected, setSelected] = useState<{ day: Date; items: CalItem[] } | null>(null);

  const loadData = useCallback(async () => {
    const collected: CalItem[] = [];

    const [eventsRes, activitiesRes, tasksRes] = await Promise.allSettled([
      adminApi.getEvents(1, 200),
      adminApi.getActivities(1, 200),
      adminApi.getTasks(),
    ]);

    if (eventsRes.status === "fulfilled") {
      const list = eventsRes.value?.items ?? eventsRes.value?.events ?? [];
      for (const e of list) {
        if (!e.eventDate) continue;
        const d = new Date(e.eventDate);
        collected.push({
          id: `event-${e.id}`, type: "event", title: e.title,
          date: d, time: d.toTimeString().slice(0, 5), navTab: "events",
        });
      }
    }
    if (activitiesRes.status === "fulfilled") {
      const list = activitiesRes.value?.items ?? activitiesRes.value?.activities ?? [];
      for (const a of list) {
        if (!a.activityDate) continue;
        collected.push({
          id: `activity-${a.id}`, type: "activity", title: a.title,
          date: new Date(a.activityDate), navTab: "activities",
        });
      }
    }
    if (tasksRes.status === "fulfilled") {
      const list = tasksRes.value?.items ?? [];
      for (const t of list) {
        if (!t.dueDate) continue;
        if (t.status === "cancelled") continue;
        collected.push({
          id: `task-${t.id}`, type: "task", title: t.title,
          date: new Date(t.dueDate), time: t.dueTime, navTab: "tasks",
        });
      }
    }

    setItems(collected);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const visibleItems = useMemo(() => items.filter((i) => filters[i.type]), [items, filters]);

  function shift(dir: -1 | 1) {
    setCursor((c) => {
      const n = new Date(c);
      if (view === "month") n.setMonth(c.getMonth() + dir);
      else n.setDate(c.getDate() + dir * 7);
      return n;
    });
  }

  const today = new Date();
  const weekdayLabels = lang === "ta"
    ? ["ஞா", "தி", "செ", "பு", "வி", "வெ", "ச"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const headerLabel = view === "month"
    ? cursor.toLocaleDateString(lang === "ta" ? "ta-IN" : "en-US", { month: "long", year: "numeric" })
    : (() => {
        const s = startOfWeek(cursor);
        const e = new Date(s); e.setDate(s.getDate() + 6);
        return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`;
      })();

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label={tt("prev")}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>{tt("today")}</Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label={tt("next")}><ChevronRight className="w-4 h-4" /></Button>
          <span className="ml-2 font-semibold text-sm">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs rounded-md border ${view === v ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground"}`}
              data-testid={`calendar-view-${v}`}
            >
              {v === "month" ? tt("monthView") : tt("weekView")}
            </button>
          ))}
        </div>
      </div>

      {/* Source filter toggles */}
      <div className="flex gap-3 flex-wrap text-xs">
        {(["event", "activity", "task", "appointment"] as const).map((s) => (
          <label key={s} className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters[s]}
              onChange={(e) => setFilters((f) => ({ ...f, [s]: e.target.checked }))}
              className="accent-current"
            />
            <span className={`w-2.5 h-2.5 rounded-full ${SOURCE_STYLE[s].dot}`} />
            {tt(s === "event" ? "showEvents" : s === "activity" ? "showActivities" : s === "task" ? "showTasks" : "showAppointments")}
          </label>
        ))}
      </div>

      {view === "month" ? (
        <MonthGrid
          cursor={cursor} today={today} items={visibleItems}
          weekdayLabels={weekdayLabels} moreLabel={tt("more")}
          onDayClick={(day, dayItems) => setSelected({ day, items: dayItems })}
        />
      ) : (
        <WeekGrid
          cursor={cursor} today={today} items={visibleItems}
          weekdayLabels={weekdayLabels}
          onItemClick={(item) => setSelected({ day: item.date, items: [item] })}
        />
      )}

      {/* Day / item popover */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{selected.day.toLocaleDateString(lang === "ta" ? "ta-IN" : "en-US", { weekday: "long", day: "numeric", month: "long" })}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
            </div>
            {selected.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tt("noItemsDay")}</p>
            ) : (
              <div className="space-y-2">
                {selected.items.map((it) => (
                  <div key={it.id} className={`rounded border p-2 ${SOURCE_STYLE[it.type].chip}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${SOURCE_STYLE[it.type].dot}`} />
                      <span className="text-sm font-medium flex-1">{it.title}</span>
                    </div>
                    {it.time && <p className="text-xs mt-0.5 opacity-80">{it.time}</p>}
                    {onNavigate && (
                      <button
                        className="text-xs underline mt-1 opacity-90"
                        onClick={() => { onNavigate(it.navTab); setSelected(null); }}
                      >
                        {tt("goToDetail")} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  cursor, today, items, weekdayLabels, moreLabel, onDayClick,
}: {
  cursor: Date; today: Date; items: CalItem[];
  weekdayLabels: string[]; moreLabel: string;
  onDayClick: (day: Date, items: CalItem[]) => void;
}) {
  const gridStart = startOfMonthGrid(cursor);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
  });

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="grid grid-cols-7 bg-gray-50 border-b text-center text-[11px] font-semibold text-muted-foreground">
        {weekdayLabels.map((w) => <div key={w} className="py-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const dayItems = items.filter((it) => sameDay(it.date, d)).sort((a, b) => a.date.getTime() - b.date.getTime());
          const shown = dayItems.slice(0, 3);
          const extra = dayItems.length - shown.length;
          return (
            <div
              key={i}
              onClick={() => onDayClick(d, dayItems)}
              className={`min-h-[92px] border-b border-r p-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${inMonth ? "" : "bg-gray-50/50 text-gray-400"} ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}
            >
              <div className={`text-xs mb-1 inline-flex items-center justify-center ${isToday ? "bg-primary text-white rounded-full w-5 h-5 font-bold" : "font-medium"}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {shown.map((it) => (
                  <div key={it.id} className={`text-[10px] truncate rounded px-1 py-0.5 border ${SOURCE_STYLE[it.type].chip}`}>
                    {it.title}
                  </div>
                ))}
                {extra > 0 && <div className="text-[10px] text-muted-foreground px-1">+{extra} {moreLabel}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  cursor, today, items, weekdayLabels, onItemClick,
}: {
  cursor: Date; today: Date; items: CalItem[];
  weekdayLabels: string[]; onItemClick: (item: CalItem) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  // Items without a meaningful time (e.g. activities, all-day tasks) go to an
  // "all day" band at the top so they aren't lost. When an explicit "HH:MM"
  // time string is present we prefer it; otherwise fall back to the date's
  // hour. Anything at midnight with no time, or outside the visible range, is
  // treated as all-day.
  function itemHour(it: CalItem): number | null {
    if (it.type === "activity") return null;
    let h: number;
    if (it.time && /^\d{1,2}:/.test(it.time)) {
      h = parseInt(it.time.slice(0, 2), 10);
    } else {
      h = it.date.getHours();
      if (h === 0) return null; // date-only / all-day
    }
    if (Number.isNaN(h) || h < HOUR_START || h > HOUR_END) return null;
    return h;
  }

  return (
    <div className="border rounded-lg overflow-auto bg-white">
      <div className="grid grid-cols-8 border-b bg-gray-50 text-center text-[11px] font-semibold text-muted-foreground sticky top-0">
        <div className="py-2" />
        {days.map((d, i) => (
          <div key={i} className={`py-2 ${sameDay(d, today) ? "text-primary" : ""}`}>
            {weekdayLabels[i]} <span className="block text-xs">{d.getDate()}</span>
          </div>
        ))}
      </div>

      {/* All-day band */}
      <div className="grid grid-cols-8 border-b">
        <div className="text-[10px] text-muted-foreground p-1 text-right pr-2">—</div>
        {days.map((d, i) => {
          const allDay = items.filter((it) => sameDay(it.date, d) && itemHour(it) === null);
          return (
            <div key={i} className="border-l p-1 space-y-0.5 min-h-[28px]">
              {allDay.map((it) => (
                <button key={it.id} onClick={() => onItemClick(it)} className={`block w-full text-left text-[10px] truncate rounded px-1 py-0.5 border ${SOURCE_STYLE[it.type].chip}`}>
                  {it.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Hour rows */}
      {hours.map((h) => (
        <div key={h} className="grid grid-cols-8 border-b last:border-b-0">
          <div className="text-[10px] text-muted-foreground p-1 text-right pr-2">{h}:00</div>
          {days.map((d, i) => {
            const slotItems = items.filter((it) => sameDay(it.date, d) && itemHour(it) === h);
            return (
              <div key={i} className="border-l p-1 space-y-0.5 min-h-[36px]">
                {slotItems.map((it) => (
                  <button key={it.id} onClick={() => onItemClick(it)} className={`block w-full text-left text-[10px] truncate rounded px-1 py-0.5 border ${SOURCE_STYLE[it.type].chip}`}>
                    {it.time ? `${it.time} ` : ""}{it.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
