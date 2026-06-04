import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Map as MapIcon, Play, Pause, RefreshCw, Loader2 } from "lucide-react";
import { adminApi } from "./api";
import { useLeaderConfig, lc } from "@/lib/LeaderConfigContext";
import { useLanguage } from "@/lib/LanguageContext";

interface Point { lat: number; lng: number; weight: number; categories: Record<string, number> }
interface HeatResp {
  range: { from: string; to: string };
  totalPoints: number;
  weeks: string[];
  timeline: Array<{ week: string; points: Point[] }>;
}

const today = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };

export default function HeatmapAdmin() {
  const leader = useLeaderConfig();
  const { lang } = useLanguage();
  const [from, setFrom] = useState(today(-90));
  const [to, setTo] = useState(today(0));
  const [data, setData] = useState<HeatResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [weekIdx, setWeekIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cumulative, setCumulative] = useState(true);

  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    setBusy(true); setErr(null);
    try {
      const d = await adminApi.getHeatmapTimeline(from, to);
      setData(d);
      setWeekIdx(Math.max(0, (d.weeks?.length ?? 1) - 1));
    } catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வி")); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  // Init leaflet map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([leader.mapCenterLat, leader.mapCenterLng], leader.mapZoom ?? 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Aggregate the points to show for the current week index (optionally cumulative).
  const currentPoints = useMemo<Point[]>(() => {
    if (!data) return [];
    const slice = cumulative ? data.timeline.slice(0, weekIdx + 1) : [data.timeline[weekIdx]].filter(Boolean);
    const merged = new Map<string, Point>();
    for (const w of slice) {
      for (const p of w.points) {
        const k = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
        const cur = merged.get(k);
        if (!cur) merged.set(k, { ...p, categories: { ...p.categories } });
        else {
          cur.weight += p.weight;
          for (const [c, n] of Object.entries(p.categories)) cur.categories[c] = (cur.categories[c] ?? 0) + n;
        }
      }
    }
    return Array.from(merged.values());
  }, [data, weekIdx, cumulative]);

  // Redraw circles when points change.
  useEffect(() => {
    const layer = layerRef.current; const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (currentPoints.length === 0) return;
    const maxW = Math.max(...currentPoints.map((p) => p.weight));
    for (const p of currentPoints) {
      const intensity = p.weight / maxW;
      const radius = 6 + intensity * 18;
      const color = intensity > 0.66 ? "#b91c1c" : intensity > 0.33 ? "#f59e0b" : "#2563eb";
      const topCat = Object.entries(p.categories).sort((a, b) => b[1] - a[1])[0];
      L.circleMarker([p.lat, p.lng], {
        radius, color, weight: 1, fillColor: color, fillOpacity: 0.55,
      }).bindTooltip(`${p.weight} ${lc(lang, p.weight > 1 ? "grievances" : "grievance", "புகார்கள்")}${topCat ? ` · ${lc(lang, "top", "முதன்மை")}: ${topCat[0]}` : ""}`).addTo(layer);
    }
    // Fit on first paint of a fresh dataset.
    const bounds = L.latLngBounds(currentPoints.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { animate: false });
  }, [currentPoints, lang]);

  // Autoplay
  useEffect(() => {
    if (!playing || !data) return;
    const t = setInterval(() => {
      setWeekIdx((i) => {
        const next = i + 1;
        if (next >= data.weeks.length) { setPlaying(false); return i; }
        return next;
      });
    }, 700);
    return () => clearInterval(t);
  }, [playing, data]);

  const currentWeek = data?.weeks[weekIdx];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" /> {lc(lang, "Grievance Heatmap & Time Slider", "புகார் வெப்ப வரைபடம் & நேர சீவர்")}</h2>
          <p className="text-sm text-muted-foreground">{lc(lang, "Watch where complaints cluster across the constituency, week by week.", "தொகுதி முழுவதும் புகார்கள் எங்கு குவிகின்றன என்பதை வாரம் வாரமாக கண்காணிக்கவும்.")}</p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div><Label className="text-xs">{lc(lang, "From", "முதல்")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">{lc(lang, "To", "வரை")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={load} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      <Card>
        <CardContent className="p-3 space-y-3">
          <div ref={containerRef} style={{ height: 460 }} className="w-full rounded-md border" />

          {data && data.weeks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  {lc(lang, "Week:", "வாரம்:")} <span className="font-semibold">{currentWeek}</span>
                  <span className="text-muted-foreground"> · {currentPoints.length} {lc(lang, "location(s)", "இடம்(கள்)")}, {currentPoints.reduce((a, p) => a + p.weight, 0)} {lc(lang, "grievance(s)", "புகார்(கள்)")} {cumulative ? lc(lang, "to date", "இன்றுவரை") : lc(lang, "this week", "இந்த வாரம்")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={cumulative} onChange={(e) => setCumulative(e.target.checked)} /> {lc(lang, "cumulative", "திரட்டு")}</label>
                  <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)}>
                    {playing ? <><Pause className="w-3 h-3 mr-1" /> {lc(lang, "Pause", "இடைநிறுத்து")}</> : <><Play className="w-3 h-3 mr-1" /> {lc(lang, "Play", "இயக்கு")}</>}
                  </Button>
                </div>
              </div>
              <input
                type="range" min={0} max={data.weeks.length - 1} value={weekIdx}
                onChange={(e) => setWeekIdx(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{data.weeks[0]}</span><span>{data.weeks[data.weeks.length - 1]}</span>
              </div>
            </div>
          )}

          {data && data.weeks.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">{lc(lang, "No geo-tagged grievances in this date range.", "இந்த தேதி வரம்பில் இடம்-குறிக்கப்பட்ட புகார்கள் இல்லை.")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
