import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, CheckCircle2, Clock, Hourglass, AlertCircle, RefreshCw } from "lucide-react";
import { adminApi } from "./api";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";
import type { Language } from "@/lib/i18n";

const STATUSES = ["announced", "in_progress", "delivered", "on_hold", "dropped"] as const;
const CATEGORIES = ["infrastructure", "water", "electricity", "education", "healthcare", "agriculture", "welfare", "transport", "employment", "general"] as const;

const STATUS_TA: Record<string, string> = {
  announced: "அறிவிக்கப்பட்டது",
  in_progress: "செயல்பாட்டில்",
  delivered: "நிறைவேற்றப்பட்டது",
  on_hold: "நிறுத்தி வைக்கப்பட்டது",
  dropped: "கைவிடப்பட்டது",
};
const CATEGORY_TA: Record<string, string> = {
  infrastructure: "உள்கட்டமைப்பு",
  water: "தண்ணீர்",
  electricity: "மின்சாரம்",
  education: "கல்வி",
  healthcare: "சுகாதாரம்",
  agriculture: "விவசாயம்",
  welfare: "நலன்",
  transport: "போக்குவரத்து",
  employment: "வேலைவாய்ப்பு",
  general: "பொது",
};
const statusLabel = (lang: Language, s: string) => lc(lang, s, STATUS_TA[s] ?? s);
const categoryLabel = (lang: Language, c: string) => lc(lang, c, CATEGORY_TA[c] ?? c);

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
  const { lang } = useLanguage();
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
      setErr(e instanceof Error ? e.message : lc(lang, "Failed", "தோல்வியடைந்தது"));
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
    } catch (e) { setErr(e instanceof Error ? e.message : lc(lang, "Save failed", "சேமிப்பு தோல்வியடைந்தது")); }
  }

  async function remove(id: number) {
    if (!window.confirm(lc(lang, "Delete this promise?", "இந்த வாக்குறுதியை நீக்கவா?"))) return;
    await adminApi.deletePromise(id);
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{lc(lang, "Promises Tracker", "வாக்குறுதிகள் கண்காணிப்பு")}</h2>
          <p className="text-sm text-muted-foreground">{lc(lang, "Track public commitments and what you've delivered. Shown on /promises.", "பொது வாக்குறுதிகளையும் நிறைவேற்றியவற்றையும் கண்காணிக்கவும். /promises பக்கத்தில் காட்டப்படும்.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {lc(lang, "Refresh", "புதுப்பி")}
          </Button>
          <Button size="sm" onClick={() => setEditing(emptyPromise())}>
            <Plus className="w-4 h-4 mr-1" /> {lc(lang, "Add Promise", "வாக்குறுதி சேர்")}
          </Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded p-6 text-center">{lc(lang, "No promises yet.", "இன்னும் வாக்குறுதிகள் இல்லை.")}</div>
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
                    <Badge variant="outline" className="text-xs"><Icon className="w-3 h-3 mr-1" />{statusLabel(lang, p.status)}</Badge>
                    <Badge variant="secondary" className="text-xs">{categoryLabel(lang, p.category)}</Badge>
                    <span className="text-xs text-muted-foreground">{p.progress}%</span>
                  </div>
                  {p.titleTa && <p className="text-xs text-muted-foreground">{p.titleTa}</p>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.targetDate && <>{lc(lang, "Target", "இலக்கு")}: {new Date(p.targetDate).toLocaleDateString()} · </>}
                    {p.deliveredAt && <>{lc(lang, "Delivered", "நிறைவேற்றப்பட்டது")}: {new Date(p.deliveredAt).toLocaleDateString()}</>}
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
            <h3 className="font-medium text-sm">{editing.id ? lc(lang, "Edit promise", "வாக்குறுதியைத் திருத்து") : lc(lang, "New promise", "புதிய வாக்குறுதி")}</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{lc(lang, "Title (English)", "தலைப்பு (ஆங்கிலம்)")}</Label>
              <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{lc(lang, "Title (Tamil)", "தலைப்பு (தமிழ்)")}</Label>
              <Input value={editing.titleTa ?? ""} onChange={(e) => setEditing({ ...editing, titleTa: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{lc(lang, "Description (English)", "விவரம் (ஆங்கிலம்)")}</Label>
              <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{lc(lang, "Description (Tamil)", "விவரம் (தமிழ்)")}</Label>
              <Textarea rows={3} value={editing.descriptionTa ?? ""} onChange={(e) => setEditing({ ...editing, descriptionTa: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Category", "வகை")}</Label>
              <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{categoryLabel(lang, c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Status", "நிலை")}</Label>
              <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(lang, s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Progress %", "முன்னேற்றம் %")}</Label>
              <Input type="number" min={0} max={100} value={editing.progress ?? 0}
                onChange={(e) => setEditing({ ...editing, progress: Math.max(0, Math.min(100, Number(e.target.value))) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Display order", "வரிசை")}</Label>
              <Input type="number" value={editing.displayOrder ?? 0}
                onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Announced on", "அறிவித்த தேதி")}</Label>
              <Input type="date" value={toLocalInput(editing.announcedAt)}
                onChange={(e) => setEditing({ ...editing, announcedAt: e.target.value || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Target date", "இலக்கு தேதி")}</Label>
              <Input type="date" value={toLocalInput(editing.targetDate)}
                onChange={(e) => setEditing({ ...editing, targetDate: e.target.value || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{lc(lang, "Delivered on", "நிறைவேற்றிய தேதி")}</Label>
              <Input type="date" value={toLocalInput(editing.deliveredAt)}
                onChange={(e) => setEditing({ ...editing, deliveredAt: e.target.value || null })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{lc(lang, "Image URL", "பட URL")}</Label>
              <Input value={editing.imageUrl ?? ""} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value || null })}
                placeholder="https://..." />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{lc(lang, "Proof URL (gallery / news / GO link shown when delivered)", "சான்று URL (நிறைவேற்றியதும் காட்டப்படும் படத்தொகுப்பு / செய்தி / அரசாணை இணைப்பு)")}</Label>
              <Input value={editing.proofUrl ?? ""} onChange={(e) => setEditing({ ...editing, proofUrl: e.target.value || null })}
                placeholder="https://..." />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>{lc(lang, "Cancel", "ரத்து")}</Button>
            <Button size="sm" onClick={save} disabled={!editing.title}>{lc(lang, "Save", "சேமி")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
