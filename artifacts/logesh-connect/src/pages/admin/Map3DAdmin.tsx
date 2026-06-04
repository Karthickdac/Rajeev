import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { HexagonLayer, ScreenGridLayer } from "@deck.gl/aggregation-layers";
import { ColumnLayer } from "@deck.gl/layers";
import type { PickingInfo, MapViewState } from "@deck.gl/core";
import { Map as MapLibre, NavigationControl } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes, Layers as LayersIcon, RotateCw, Loader2 } from "lucide-react";
import { adminApi } from "./api";
import { useLeaderConfig, lc } from "@/lib/LeaderConfigContext";
import { useLanguage } from "@/lib/LanguageContext";

// Free OSM raster style — no API key required.
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

interface Point { lat: number; lng: number; weight: number; categories: Record<string, number> }
interface HeatResp { timeline: Array<{ week: string; points: Point[] }> }

type Mode = "hex" | "column" | "grid";

const today = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };

export default function Map3DAdmin() {
  const leader = useLeaderConfig();
  const { lang } = useLanguage();
  const [from, setFrom] = useState(today(-90));
  const [to, setTo] = useState(today(0));
  const [mode, setMode] = useState<Mode>("hex");
  const [data, setData] = useState<HeatResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const defaultView: MapViewState = {
    longitude: leader.mapCenterLng,
    latitude: leader.mapCenterLat,
    zoom: leader.mapZoom ?? 11.5,
    pitch: 55,
    bearing: -15,
  };
  const [view, setView] = useState<MapViewState>(defaultView);

  async function load() {
    setBusy(true); setErr(null);
    try {
      const d = (await adminApi.getHeatmapTimeline(from, to)) as HeatResp;
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : lc(lang, "Failed to load", "ஏற்ற முடியவில்லை"));
    } finally { setBusy(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Flatten all weeks → unique points (sum weights across weeks if the
  // same rounded bucket appears in multiple weeks).
  const points = useMemo(() => {
    if (!data) return [] as Array<{ position: [number, number]; weight: number; topCategory: string }>;
    const merged = new Map<string, { position: [number, number]; weight: number; categories: Record<string, number> }>();
    for (const wk of data.timeline) {
      for (const p of wk.points) {
        const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
        const ex = merged.get(key);
        if (ex) {
          ex.weight += p.weight;
          for (const [c, n] of Object.entries(p.categories || {})) ex.categories[c] = (ex.categories[c] || 0) + n;
        } else {
          merged.set(key, { position: [p.lng, p.lat], weight: p.weight, categories: { ...p.categories } });
        }
      }
    }
    return Array.from(merged.values()).map((p) => {
      const top = Object.entries(p.categories).sort((a, b) => b[1] - a[1])[0];
      return { position: p.position, weight: p.weight, topCategory: top?.[0] ?? "Others" };
    });
  }, [data]);

  const totalGrievances = useMemo(() => points.reduce((s, p) => s + p.weight, 0), [points]);

  const layers = useMemo(() => {
    if (!points.length) return [];
    if (mode === "hex") {
      return [new HexagonLayer<typeof points[number]>({
        id: "hex",
        data: points,
        getPosition: (d) => d.position,
        getElevationWeight: (d) => d.weight,
        elevationAggregation: "SUM",
        elevationScale: 30,
        extruded: true,
        radius: 200,
        coverage: 0.9,
        pickable: true,
        opacity: 0.85,
        colorRange: [
          [255, 240, 200], [255, 210, 140], [255, 170, 90],
          [240, 110, 60], [200, 30, 30], [120, 0, 30],
        ],
        material: { ambient: 0.7, diffuse: 0.6, shininess: 32, specularColor: [255, 255, 255] },
      })];
    }
    if (mode === "column") {
      return [new ColumnLayer<typeof points[number]>({
        id: "columns",
        data: points,
        getPosition: (d) => d.position,
        getElevation: (d) => d.weight * 60,
        getFillColor: (d) => {
          const w = Math.min(d.weight / 5, 1);
          return [200 + Math.round(55 * w), Math.round(120 * (1 - w)), Math.round(60 * (1 - w))];
        },
        extruded: true,
        radius: 80,
        elevationScale: 1,
        pickable: true,
        opacity: 0.9,
      })];
    }
    return [new ScreenGridLayer<typeof points[number]>({
      id: "grid",
      data: points,
      getPosition: (d) => d.position,
      getWeight: (d) => d.weight,
      cellSizePixels: 24,
      opacity: 0.75,
      colorRange: [
        [255, 245, 215, 60], [255, 200, 120, 130], [255, 140, 60, 180],
        [220, 60, 40, 215], [160, 0, 30, 245], [90, 0, 20, 255],
      ],
    })];
  }, [points, mode]);

  // Tooltip handler. For HexagonLayer the picked object is the *bin*, which
  // exposes `elevationValue` (the SUM we asked for via elevationAggregation).
  // For ColumnLayer it's the raw datum with our own `weight`. ScreenGridLayer
  // is not pickable in this view.
  type HexBin = { elevationValue?: number; colorValue?: number; points?: unknown[] };
  type ColDatum = { weight: number; topCategory: string };
  const getTooltip = (info: PickingInfo<HexBin | ColDatum>): string | null => {
    const o = info.object;
    if (!o) return null;
    if (mode === "hex") {
      const bin = o as HexBin;
      const total = bin.elevationValue ?? bin.colorValue ?? bin.points?.length ?? 0;
      return lc(lang, `${Math.round(total)} grievances in this area`, `இந்தப் பகுதியில் ${Math.round(total)} புகார்கள்`);
    }
    const d = o as ColDatum;
    if (typeof d.weight === "number") return lc(lang, `${d.weight} grievances\nTop: ${d.topCategory ?? "—"}`, `${d.weight} புகார்கள்\nமுதன்மை: ${d.topCategory ?? "—"}`);
    return null;
  };

  const modeButton = (m: Mode, label: string) => (
    <Button size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{label}</Button>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="w-6 h-6" /> {lc(lang, "3D Grievance Map", "முப்பரிமாண புகார் வரைபடம்")}</h1>
        <div className="text-sm text-muted-foreground">{lc(lang, `${totalGrievances} grievances across ${points.length} locations`, `${points.length} இடங்களில் ${totalGrievances} புகார்கள்`)}</div>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div><Label>{lc(lang, "From", "முதல்")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label>{lc(lang, "To", "வரை")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={load} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : lc(lang, "Reload", "மீளேற்று")}</Button>
          <div className="flex items-center gap-1 ml-2 border rounded p-1">
            <LayersIcon className="w-4 h-4 mx-1 text-muted-foreground" />
            {modeButton("hex", lc(lang, "3D Hexagons", "முப்பரிமாண அறுகோணங்கள்"))}
            {modeButton("column", lc(lang, "Columns", "நெடுவரிசைகள்"))}
            {modeButton("grid", lc(lang, "Heat Grid", "வெப்பக் கட்டம்"))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setView(defaultView)}>
            <RotateCw className="w-4 h-4 mr-1" /> {lc(lang, "Reset view", "காட்சியை மீட்டமை")}
          </Button>
        </CardContent>
      </Card>

      {err && <Card><CardContent className="pt-6 text-destructive">{err}</CardContent></Card>}

      <Card>
        <CardContent className="pt-6">
          <div style={{ position: "relative", height: "640px", width: "100%", borderRadius: 8, overflow: "hidden", background: "#0c1116" }}>
            <DeckGL
              viewState={view}
              onViewStateChange={(p) => setView(p.viewState as MapViewState)}
              controller
              layers={layers}
              getTooltip={getTooltip}
            >
              <MapLibre mapStyle={MAP_STYLE} reuseMaps>
                <NavigationControl position="top-right" visualizePitch />
              </MapLibre>
            </DeckGL>
            {!points.length && !busy && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70 pointer-events-none">
                {lc(lang, "No geo-tagged grievances in this range", "இந்த வரம்பில் இடம்-குறிக்கப்பட்ட புகார்கள் இல்லை")}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {lc(lang, "Drag to pan · Right-drag to rotate · Scroll to zoom. Bar height = grievance volume; deeper red = more reports.", "இழுத்து நகர்த்தவும் · வலது-இழுப்பால் சுழற்றவும் · உருட்டி பெரிதாக்கவும். பட்டையின் உயரம் = புகார் அளவு; அடர் சிவப்பு = அதிக புகார்கள்.")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
