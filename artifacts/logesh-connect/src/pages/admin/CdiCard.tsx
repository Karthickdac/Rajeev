import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Gauge, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { adminApi } from "./api";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";
import type { Language } from "@/lib/i18n";

interface CdiData {
  cdi: number;
  components: { key: string; label: string; score: number; weight: number }[];
  raw: Record<string, number>;
}

function gradeFor(score: number, lang: Language) {
  if (score >= 80) return { label: lc(lang, "Excellent", "சிறப்பு"), color: "text-green-700",  ring: "#16a34a", Icon: CheckCircle2 };
  if (score >= 65) return { label: lc(lang, "Strong", "வலுவானது"),    color: "text-emerald-700", ring: "#10b981", Icon: TrendingUp };
  if (score >= 50) return { label: lc(lang, "Fair", "சராசரி"),      color: "text-amber-700",   ring: "#d97706", Icon: TrendingUp };
  return            { label: lc(lang, "Needs work", "மேம்பாடு தேவை"),      color: "text-red-700",     ring: "#dc2626", Icon: AlertTriangle };
}

export default function CdiCard() {
  const { lang } = useLanguage();
  const [data, setData] = useState<CdiData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getCdi()
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return null; // role-gated; hide on permission errors
  if (!data) return (
    <Card><CardContent className="p-4 text-sm text-muted-foreground">{lc(lang, "Computing CDI…", "CDI கணக்கிடப்படுகிறது…")}</CardContent></Card>
  );

  const grade = gradeFor(data.cdi, lang);
  const dash = (data.cdi / 100) * 283; // 2πr for r=45

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-white via-yellow-50/40 to-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{lc(lang, "Constituency Development Index", "தொகுதி வளர்ச்சி குறியீடு")}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="45" stroke="#e5e7eb" strokeWidth="9" fill="none" />
              <circle cx="50" cy="50" r="45" stroke={grade.ring} strokeWidth="9" fill="none"
                strokeDasharray={`${dash} 283`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-gray-900">{data.cdi}</div>
              <div className={`text-[10px] uppercase ${grade.color} font-semibold`}>{grade.label}</div>
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.components.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{c.label} <span className="opacity-60">({c.weight}%)</span></span>
                  <span className="font-medium">{c.score}</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${c.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          {lc(lang, "Composite of grievance health, promise delivery, monthly engagement, and volunteer base. Updates on every refresh.", "புகார் ஆரோக்கியம், வாக்குறுதி நிறைவேற்றம், மாதாந்திர ஈடுபாடு மற்றும் தன்னார்வலர் அடித்தளம் ஆகியவற்றின் கூட்டுக் குறியீடு. ஒவ்வொரு புதுப்பிப்பின்போதும் மாறும்.")}
        </p>
      </CardContent>
    </Card>
  );
}
