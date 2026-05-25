import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Timer, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { adminApi } from "./api";

interface SlaResp {
  range: { from: string; to: string };
  summary: { total: number; resolved: number; breaches: number; openBreaches: number; breachRate: number; resolutionRate: number };
  byCategory: Array<{ category: string; slaTargetHours: number; total: number; resolved: number; avgResolutionHours: number | null; breachCount: number; openBreachCount: number; breachRate: number }>;
  overdue: Array<{ id: number; ticketNo: string; name: string; category: string; priority: string; status: string; ward: string | null; ageHours: number; overdueHours: number; slaTargetHours: number }>;
}

function today(offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10);
}

export default function SlaAdmin() {
  const [from, setFrom] = useState(today(-90));
  const [to, setTo] = useState(today(0));
  const [data, setData] = useState<SlaResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true); setErr(null);
    try { setData(await adminApi.getSla(from, to)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Timer className="w-5 h-5 text-primary" /> SLA Performance</h2>
          <p className="text-sm text-muted-foreground">Grievance resolution against per-category service-level targets.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={load} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
      {!data && busy && <div className="text-muted-foreground text-sm">Loading…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Total" value={data.summary.total} />
            <Stat label="Resolved" value={data.summary.resolved} tone="ok" />
            <Stat label="Resolution rate" value={`${data.summary.resolutionRate}%`} />
            <Stat label="SLA breaches" value={data.summary.breaches} tone="warn" />
            <Stat label="Open breaches" value={data.summary.openBreaches} tone="bad" />
          </div>

          <Card>
            <CardContent className="p-3">
              <h3 className="font-semibold text-sm mb-2">By category</h3>
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1">Category</th>
                      <th className="text-right">SLA (hrs)</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Resolved</th>
                      <th className="text-right">Avg actual (hrs)</th>
                      <th className="text-right">Breaches</th>
                      <th className="text-right">Breach %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCategory.map((c) => (
                      <tr key={c.category} className="border-b last:border-0">
                        <td className="py-1.5">{c.category}</td>
                        <td className="text-right">{c.slaTargetHours}</td>
                        <td className="text-right">{c.total}</td>
                        <td className="text-right">{c.resolved}</td>
                        <td className="text-right">{c.avgResolutionHours ?? "—"}</td>
                        <td className="text-right">{c.breachCount}{c.openBreachCount ? <span className="text-red-600"> ({c.openBreachCount} open)</span> : null}</td>
                        <td className="text-right">
                          <Badge variant="outline" className={c.breachRate > 30 ? "bg-red-50 text-red-700 border-red-200" : c.breachRate > 10 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"}>{c.breachRate}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /> Most overdue open tickets</h3>
              {data.overdue.length === 0 ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> All open tickets are within SLA — nice work.</div>
              ) : (
                <div className="grid gap-1.5">
                  {data.overdue.map((o) => (
                    <div key={o.id} className="border rounded p-2 flex items-center justify-between gap-3 hover:bg-gray-50">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{o.ticketNo} — {o.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {o.category} · {o.ward || "no ward"} · {o.status} · priority {o.priority}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">+{o.overdueHours}h overdue</Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">age {o.ageHours}h / target {o.slaTargetHours}h</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" | "bad" }) {
  const colors = tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "text-foreground";
  return (
    <Card><CardContent className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${colors}`}>{value}</div>
    </CardContent></Card>
  );
}
