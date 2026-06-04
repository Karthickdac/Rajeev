import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, CheckCircle, XCircle, Clock, Download } from "lucide-react";
import { adminApi } from "./api";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";
import type { Language } from "@/lib/i18n";

interface VolunteerItem {
  id: number;
  name: string;
  nameTa?: string | null;
  email?: string | null;
  phone: string;
  ward?: string | null;
  constituency: string;
  skills?: string | null;
  message?: string | null;
  status: string;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "pending", "approved", "rejected"];

function filterLabel(lang: Language, f: string): string {
  switch (f) {
    case "all": return lc(lang, "All", "அனைத்தும்");
    case "pending": return lc(lang, "Pending", "நிலுவையில்");
    case "approved": return lc(lang, "Approved", "அங்கீகரிக்கப்பட்டது");
    case "rejected": return lc(lang, "Rejected", "நிராகரிக்கப்பட்டது");
    default: return f;
  }
}

function statusBadge(status: string, lang: Language) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 border-green-200">{lc(lang, "Approved", "அங்கீகரிக்கப்பட்டது")}</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200">{lc(lang, "Rejected", "நிராகரிக்கப்பட்டது")}</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{lc(lang, "Pending", "நிலுவையில்")}</Badge>;
}

function toCSV(items: VolunteerItem[], lang: Language): string {
  const headers = [
    lc(lang, "ID", "அடையாள எண்"),
    lc(lang, "Name", "பெயர்"),
    lc(lang, "Name (Tamil)", "பெயர் (தமிழ்)"),
    lc(lang, "Email", "மின்னஞ்சல்"),
    lc(lang, "Phone", "தொலைபேசி"),
    lc(lang, "Ward", "வட்டாரம்"),
    lc(lang, "Constituency", "தொகுதி"),
    lc(lang, "Skills", "திறன்கள்"),
    lc(lang, "Message", "செய்தி"),
    lc(lang, "Status", "நிலை"),
    lc(lang, "Registered", "பதிவு செய்த தேதி"),
  ];
  const rows = items.map(v => [
    String(v.id), v.name, v.nameTa ?? "", v.email ?? "", v.phone,
    v.ward ?? "", v.constituency, v.skills ?? "", v.message ?? "",
    v.status, new Date(v.createdAt).toLocaleDateString("en-IN"),
  ]);
  return [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function VolunteersAdmin() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<VolunteerItem[]>([]);
  const [allItems, setAllItems] = useState<VolunteerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = (p = page, f = filter) => {
    setLoading(true);
    adminApi.getVolunteers(p, f === "all" ? undefined : f)
      .then((d: { items: VolunteerItem[]; total: number }) => { setItems(d.items); setTotal(d.total); })
      .catch(() => setError(lc(lang, "Failed to load volunteers", "தன்னார்வலர்களை ஏற்ற முடியவில்லை")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, filter]);

  async function updateStatus(id: number, status: string) {
    setUpdating(id);
    try {
      await adminApi.updateVolunteerStatus(id, status);
      setItems(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUpdating(null);
    }
  }

  async function exportCSV() {
    setExporting(true);
    try {
      // Fetch up to 1000 volunteers for export
      const d = await adminApi.getVolunteers(1, filter === "all" ? undefined : filter) as { items: VolunteerItem[]; total: number };
      // Fetch all pages
      const pages = Math.min(Math.ceil(d.total / 20), 10);
      const allData: VolunteerItem[] = [...d.items];
      for (let p = 2; p <= pages; p++) {
        const pd = await adminApi.getVolunteers(p, filter === "all" ? undefined : filter) as { items: VolunteerItem[] };
        allData.push(...pd.items);
      }
      const csv = toCSV(allData, lang);
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `volunteers-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.ceil(total / 20);
  const pendingCount = filter === "all" ? items.filter(v => v.status === "pending").length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">{lc(lang, "Volunteer Management", "தன்னார்வலர் மேலாண்மை")}</h2>
          <p className="text-sm text-muted-foreground">{total} {lc(lang, "volunteers", "தன்னார்வலர்கள்")}{pendingCount > 0 && ` • ${pendingCount} ${lc(lang, "pending review", "பரிசீலனைக்கு நிலுவையில்")}`}</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={exporting} onClick={exportCSV}>
          <Download className="w-3.5 h-3.5" />
          {exporting ? lc(lang, "Exporting…", "ஏற்றுமதி செய்கிறது…") : lc(lang, "Export CSV", "CSV ஏற்றுமதி")}
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b pb-2">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-md font-medium capitalize transition-colors
              ${filter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            {filterLabel(lang, f)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "No volunteers found", "தன்னார்வலர்கள் இல்லை")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((v) => (
            <Card key={v.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{v.name}</p>
                      {v.nameTa && <p className="text-xs text-muted-foreground">{v.nameTa}</p>}
                      {statusBadge(v.status, lang)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" /> {v.phone}
                      </div>
                      {v.email && <span className="text-xs text-muted-foreground">{v.email}</span>}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {v.constituency}{v.ward ? `, ${lc(lang, "Ward", "வட்டாரம்")} ${v.ward}` : ""}
                      </div>
                    </div>
                    {v.skills && <p className="text-xs text-muted-foreground mt-0.5">{lc(lang, "Skills", "திறன்கள்")}: {v.skills}</p>}
                    {v.message && <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-1">"{v.message}"</p>}
                    <p className="text-xs text-muted-foreground mt-1">{lc(lang, "Registered", "பதிவு செய்தது")} {new Date(v.createdAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {v.status !== "approved" && (
                      <Button size="sm" variant="outline"
                        className="h-8 text-xs text-green-600 border-green-200 hover:bg-green-50 gap-1"
                        disabled={updating === v.id} onClick={() => updateStatus(v.id, "approved")}>
                        <CheckCircle className="w-3.5 h-3.5" /> {lc(lang, "Approve", "அங்கீகரி")}
                      </Button>
                    )}
                    {v.status !== "rejected" && (
                      <Button size="sm" variant="outline"
                        className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50 gap-1"
                        disabled={updating === v.id} onClick={() => updateStatus(v.id, "rejected")}>
                        <XCircle className="w-3.5 h-3.5" /> {lc(lang, "Reject", "நிராகரி")}
                      </Button>
                    )}
                    {v.status !== "pending" && (
                      <Button size="sm" variant="outline"
                        className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 gap-1"
                        disabled={updating === v.id} onClick={() => updateStatus(v.id, "pending")}>
                        <Clock className="w-3.5 h-3.5" /> {lc(lang, "Pending", "நிலுவையில்")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>{lc(lang, "Previous", "முந்தைய")}</Button>
          <span className="text-sm text-muted-foreground">{lc(lang, "Page", "பக்கம்")} {page} {lc(lang, "of", "/")} {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{lc(lang, "Next", "அடுத்து")}</Button>
        </div>
      )}
    </div>
  );
}
