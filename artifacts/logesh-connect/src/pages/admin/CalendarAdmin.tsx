import AdminCalendar from "@/components/admin/AdminCalendar";
import { type Language, tTask } from "@/lib/i18n";

export default function CalendarAdmin({ lang = "ta" }: { lang?: Language }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{tTask(lang, "calendarTitle")}</h2>
        <p className="text-sm text-muted-foreground">{tTask(lang, "calendarSubtitle")}</p>
      </div>
      <AdminCalendar
        lang={lang}
        onNavigate={(tab) => { window.location.hash = `#${tab}`; }}
      />
    </div>
  );
}
