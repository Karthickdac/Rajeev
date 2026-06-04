import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, RefreshCw, Loader2 } from "lucide-react";
import { adminApi } from "./api";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

interface EscResp {
  summary: { totalOpen: number; breached: number; highRisk: number; unassigned: number };
  items: Array<{
    id: number; ticketNo: string; name: string; phone: string;
    effectiveCategory: string; effectivePriority: string; status: string;
    ward: string | null; ageHours: number; slaTargetHours: number;
    riskScore: number; reasons: string[]; aiSummary: string | null;
  }>;
}

const riskColor = (s: number) =>
  s >= 4 ? "bg-red-100 text-red-800 border-red-300" :
  s >= 2 ? "bg-amber-100 text-amber-800 border-amber-300" :
           "bg-blue-50 text-blue-700 border-blue-200";

export default function EscalationsAdmin() {
  const { lang } = useLanguage();
  const [data, setData] = useState<EscResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true); setErr(null);
    try { setData(await adminApi.getEscalations()); }
    catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Flame className="w-5 h-5 text-orange-600" /> {lc(lang, "Predictive Escalation", "முன்கணிப்பு உயர்வு")}</h2>
          <p className="text-sm text-muted-foreground">{lc(lang, "Open grievances ranked by SLA-aware risk score (age ratio × priority × status). Tackle the top of this list first.", "SLA-சார்ந்த ஆபத்து மதிப்பெண் (வயது விகிதம் × முன்னுரிமை × நிலை) அடிப்படையில் தரவரிசைப்படுத்தப்பட்ட திறந்த புகார்கள். இந்தப் பட்டியலின் மேலுள்ளவற்றை முதலில் கையாளவும்.")}</p>
        </div>
        <Button onClick={load} disabled={busy} variant="outline" size="sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} <span className="ml-1">{lc(lang, "Refresh", "புதுப்பி")}</span>
        </Button>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <S label={lc(lang, "Open", "திறந்த")} v={data.summary.totalOpen} />
            <S label={lc(lang, "SLA breached", "SLA மீறப்பட்டது")} v={data.summary.breached} tone="bad" />
            <S label={lc(lang, "High risk", "அதிக ஆபத்து")} v={data.summary.highRisk} tone="warn" />
            <S label={lc(lang, "Unassigned", "ஒதுக்கப்படாதது")} v={data.summary.unassigned} tone="warn" />
          </div>

          <div className="grid gap-1.5">
            {data.items.length === 0 && (
              <div className="text-sm text-muted-foreground border rounded p-4 text-center">{lc(lang, "No tickets above the risk threshold. ✓", "ஆபத்து வரம்பிற்கு மேல் டிக்கெட்டுகள் இல்லை. ✓")}</div>
            )}
            {data.items.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{t.ticketNo}</span>
                        <span className="font-medium text-sm">{t.name}</span>
                        <Badge variant="outline" className="text-xs">{t.effectiveCategory}</Badge>
                        <Badge variant="outline" className="text-xs">{t.status}</Badge>
                        <Badge variant="outline" className="text-xs">{t.effectivePriority}</Badge>
                      </div>
                      {t.aiSummary && <div className="text-xs text-gray-700 mt-1 line-clamp-2">{t.aiSummary}</div>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.reasons.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {lc(lang, "age", "வயது")} {t.ageHours}h / {lc(lang, "target", "இலக்கு")} {t.slaTargetHours}h · {t.ward || lc(lang, "no ward", "வட்டாரம் இல்லை")} · {t.phone}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-base font-bold whitespace-nowrap ${riskColor(t.riskScore)}`}>
                      {t.riskScore}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function S({ label, v, tone }: { label: string; v: number; tone?: "warn" | "bad" }) {
  const c = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-foreground";
  return <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-2xl font-bold ${c}`}>{v}</div></CardContent></Card>;
}
