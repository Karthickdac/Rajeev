import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, CheckCircle2, Clock, Hourglass, AlertCircle, RefreshCw } from "lucide-react";
import { adminApi } from "./api";

const STATUSES = ["announced", "in_progress", "delivered", "on_hold", "dropped"] as const;
const CATEGORIES = ["infrastructure", "water", "electricity", "education", "healthcare", "agriculture", "welfare", "transport", "employment", "general"] as const;

interface Promise {
  id: number;
  title: string;
  titleTa: string | null;
  description: string | null;
  descriptionTa: string | null;
  category: string;
  status: string;
  progress: number;
  announcedAt: string | null;
  targetDate: string | null;
  deliveredAt: string | null;
  imageUrl: string | null;
  proofUrl: string | null;
  displayOrder: number;
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  announced: Hourglass, in_progress: Clock, delivered: CheckCircle2, on_hold: AlertCircle, dropped: AlertCircle,
};

function emptyPromise(): Partial<Promise> {
  return { title: "", status: "announced", category: "general", progress: 0, displayOrder: 0 };
}

function toLocalInput(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function PromisesAdmin() {
  const [rows, setRows] = useState<Promise[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Promise> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true); setErr(null);
    try {
      const r = await adminApi.getPromises();
      setRows(r.promises ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);

  async function save() {
    if (!editing) return;
    setErr(null);
    try {
      const payload = {
        ...editing,
        targetDate: editing.targetDate ? new Date(editing.targetDate).toISOString() : null,
        announcedAt: editing.announcedAt ? new Date(editing.announcedAt).toISOString() : null,
        deliveredAt: editing.deliveredAt ? new Date(editing.deliveredAt).toISOString() : null,
      };
      if (editing.id) await adminApi.updatePromise(editing.id, payload);
      else await adminApi.createPromise(payload);
      setEditing(null);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this promise?")) return;
    await adminApi.deletePromise(id);
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Promises Tracker</h2>
          <p className="text-sm text-muted-foreground">Track public commitments and what you've delivered. Shown on /promises.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setEditing(emptyPromise())}>
            <Plus className="w-4 h-4 mr-1" /> Add Promise
          </Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded p-6 text-center">No promises yet.</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((p) => {
            const Icon = STATUS_ICON[p.status] ?? Hourglass;
            return (
              <div key={p.id} className="border rounded-md p-3 bg-white flex items-start gap-3">
                <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0">
                  {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm">{p.title}</span>
                    <Badge variant="outline" className="text-xs"><Icon className="w-3 h-3 mr-1" />{p.status}</Badge>
                    <Badge variant="secondary" className="text-xs">{p.category}</Badge>
                    <span className="text-xs text-muted-foreground">{p.progress}%</span>
                  </div>
                  {p.titleTa && <p className="text-xs text-muted-foreground">{p.titleTa}</p>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.targetDate && <>Target: {new Date(p.targetDate).toLocaleDateString()} · </>}
                    {p.deliveredAt && <>Delivered: {new Date(p.deliveredAt).toLocaleDateString()}</>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="border rounded-md p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">{editing.id ? "Edit promise" : "New promise"}</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Title (English)</Label>
              <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">தலைப்பு (Tamil)</Label>
              <Input value={editing.titleTa ?? ""} onChange={(e) => setEditing({ ...editing, titleTa: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description (English)</Label>
              <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">விளக்கம் (Tamil)</Label>
              <Textarea rows={3} value={editing.descriptionTa ?? ""} onChange={(e) => setEditing({ ...editing, descriptionTa: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Progress %</Label>
              <Input type="number" min={0} max={100} value={editing.progress ?? 0}
                onChange={(e) => setEditing({ ...editing, progress: Math.max(0, Math.min(100, Number(e.target.value))) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Display order</Label>
              <Input type="number" value={editing.displayOrder ?? 0}
                onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Announced on</Label>
              <Input type="date" value={toLocalInput(editing.announcedAt)}
                onChange={(e) => setEditing({ ...editing, announcedAt: e.target.value || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target date</Label>
              <Input type="date" value={toLocalInput(editing.targetDate)}
                onChange={(e) => setEditing({ ...editing, targetDate: e.target.value || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivered on</Label>
              <Input type="date" value={toLocalInput(editing.deliveredAt)}
                onChange={(e) => setEditing({ ...editing, deliveredAt: e.target.value || null })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Image URL</Label>
              <Input value={editing.imageUrl ?? ""} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value || null })}
                placeholder="https://..." />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Proof URL (gallery / news / GO link shown when delivered)</Label>
              <Input value={editing.proofUrl ?? ""} onChange={(e) => setEditing({ ...editing, proofUrl: e.target.value || null })}
                placeholder="https://..." />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={!editing.title}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
