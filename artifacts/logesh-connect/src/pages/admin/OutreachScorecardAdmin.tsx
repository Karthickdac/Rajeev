import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Users, MapPin, RefreshCw, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { adminApi } from "./api";

interface ORResp {
  range: { from: string; to: string };
  summary: { total: number; reached: number; pledges: number; reachRate: number };
  workers: Array<{ workerId: number | null; workerName: string; total: number; reached: number; pledges: number; refused: number; issues: number; reachRate: number; byType: Record<string, number> }>;
  wards: Array<{ ward: string; total: number; reached: number; pledges: number }>;
  weekly: Array<{ week: string; total: number; reached: number; pledges: number }>;
}

const today = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };

export default function OutreachScorecardAdmin() {
  const [from, setFrom] = useState(today(-60));
  const [to, setTo] = useState(today(0));
  const [data, setData] = useState<ORResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true); setErr(null);
    try { setData(await adminApi.getOutreach(from, to)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Voter Outreach Scorecard</h2>
          <p className="text-sm text-muted-foreground">Who's calling, who's reaching, and which wards are saturated.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={load} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Contacts</div><div className="text-2xl font-bold">{data.summary.total}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Reached</div><div className="text-2xl font-bold text-green-700">{data.summary.reached}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Reach rate</div><div className="text-2xl font-bold">{data.summary.reachRate}%</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Pledges of support</div><div className="text-2xl font-bold text-primary">{data.summary.pledges}</div></CardContent></Card>
          </div>

          {data.weekly.length > 0 && (
            <Card><CardContent className="p-3">
              <h3 className="font-semibold text-sm mb-2">Weekly trend</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weekly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#94a3b8" name="Total" />
                    <Line type="monotone" dataKey="reached" stroke="#16a34a" name="Reached" />
                    <Line type="monotone" dataKey="pledges" stroke="#c8102e" name="Pledges" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent></Card>
          )}

          <div className="grid lg:grid-cols-2 gap-3">
            <Card><CardContent className="p-3">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Top workers</h3>
              <table className="text-sm w-full">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left py-1">Worker</th><th className="text-right">Calls</th><th className="text-right">Reached</th><th className="text-right">Pledges</th><th className="text-right">Reach %</th></tr>
                </thead>
                <tbody>
                  {data.workers.map((w) => (
                    <tr key={(w.workerId ?? "x") + w.workerName} className="border-b last:border-0">
                      <td className="py-1.5">{w.workerName}</td>
                      <td className="text-right">{w.total}</td>
                      <td className="text-right text-green-700">{w.reached}</td>
                      <td className="text-right text-primary">{w.pledges}</td>
                      <td className="text-right"><Badge variant="outline" className={w.reachRate >= 50 ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50"}>{w.reachRate}%</Badge></td>
                    </tr>
                  ))}
                  {data.workers.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No outreach in this period.</td></tr>}
                </tbody>
              </table>
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> By ward</h3>
              <table className="text-sm w-full">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left py-1">Ward</th><th className="text-right">Contacts</th><th className="text-right">Reached</th><th className="text-right">Pledges</th></tr>
                </thead>
                <tbody>
                  {data.wards.map((w) => (
                    <tr key={w.ward} className="border-b last:border-0">
                      <td className="py-1.5">{w.ward}</td>
                      <td className="text-right">{w.total}</td>
                      <td className="text-right text-green-700">{w.reached}</td>
                      <td className="text-right text-primary">{w.pledges}</td>
                    </tr>
                  ))}
                  {data.wards.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No ward data.</td></tr>}
                </tbody>
              </table>
            </CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}
