import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "./api";
import { Save, BarChart3 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

interface ConstituencyStats {
  id?: number;
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

const DEFAULT_STATS: ConstituencyStats = {
  roadsBuiltKm: 0, waterProjectsCompleted: 0, schoolsUpgraded: 0,
  healthClinicsOpened: 0, jobsCreated: 0, beneficiariesServed: 0,
  totalProjects: 0, completedProjects: 0, ongoingProjects: 0,
};

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void; }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input type="number" min={0} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
    </div>
  );
}

export default function ConstituencyAdmin() {
  const { lang } = useLanguage();
  const [stats, setStats] = useState<ConstituencyStats>(DEFAULT_STATS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getConstituencyStats()
      .then((d: ConstituencyStats | null) => { if (d) setStats({ ...DEFAULT_STATS, ...d }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setError(null);
    try {
      await adminApi.updateConstituencyStats(stats);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{lc(lang, "Constituency & Ward Management", "தொகுதி மற்றும் வட்டார மேலாண்மை")}</h2>
        <p className="text-sm text-muted-foreground">{lc(lang, "Update the development statistics shown on the public website", "பொது இணையதளத்தில் காட்டப்படும் வளர்ச்சி புள்ளிவிவரங்களைப் புதுப்பிக்கவும்")}</p>
      </div>
      {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> {lc(lang, "Development Statistics", "வளர்ச்சி புள்ளிவிவரங்கள்")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <NumField label={lc(lang, "Roads Built (km)", "அமைக்கப்பட்ட சாலைகள் (கி.மீ)")} value={stats.roadsBuiltKm} onChange={v => setStats(s => ({ ...s, roadsBuiltKm: v }))} />
            <NumField label={lc(lang, "Water Projects Completed", "நிறைவு செய்யப்பட்ட நீர் திட்டங்கள்")} value={stats.waterProjectsCompleted} onChange={v => setStats(s => ({ ...s, waterProjectsCompleted: v }))} />
            <NumField label={lc(lang, "Schools Upgraded", "மேம்படுத்தப்பட்ட பள்ளிகள்")} value={stats.schoolsUpgraded} onChange={v => setStats(s => ({ ...s, schoolsUpgraded: v }))} />
            <NumField label={lc(lang, "Health Clinics Opened", "திறக்கப்பட்ட சுகாதார நிலையங்கள்")} value={stats.healthClinicsOpened} onChange={v => setStats(s => ({ ...s, healthClinicsOpened: v }))} />
            <NumField label={lc(lang, "Jobs Created", "உருவாக்கப்பட்ட வேலைவாய்ப்புகள்")} value={stats.jobsCreated} onChange={v => setStats(s => ({ ...s, jobsCreated: v }))} />
            <NumField label={lc(lang, "Beneficiaries Served", "பயனடைந்தவர்கள்")} value={stats.beneficiariesServed} onChange={v => setStats(s => ({ ...s, beneficiariesServed: v }))} />
            <NumField label={lc(lang, "Total Projects", "மொத்த திட்டங்கள்")} value={stats.totalProjects} onChange={v => setStats(s => ({ ...s, totalProjects: v }))} />
            <NumField label={lc(lang, "Completed Projects", "நிறைவு செய்யப்பட்ட திட்டங்கள்")} value={stats.completedProjects} onChange={v => setStats(s => ({ ...s, completedProjects: v }))} />
            <NumField label={lc(lang, "Ongoing Projects", "நடைபெற்று வரும் திட்டங்கள்")} value={stats.ongoingProjects} onChange={v => setStats(s => ({ ...s, ongoingProjects: v }))} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-xs text-muted-foreground">{lc(lang, "These figures are displayed in the homepage stats section and About page", "இந்த புள்ளிவிவரங்கள் முகப்புப்பக்க புள்ளிவிவர பகுதியிலும் எங்களைப் பற்றி பக்கத்திலும் காட்டப்படுகின்றன")}</p>
            <Button size="sm" className="gap-1" disabled={saving} onClick={save}>
              <Save className="w-3.5 h-3.5" />
              {saved ? lc(lang, "Saved!", "சேமிக்கப்பட்டது!") : saving ? lc(lang, "Saving…", "சேமிக்கிறது…") : lc(lang, "Save Statistics", "புள்ளிவிவரங்களை சேமி")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
