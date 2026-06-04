import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Phone, Mail, MapPin } from "lucide-react";
import { adminApi } from "./api";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

interface Ward {
  id: number;
  name: string;
  area: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  coordinatorEmail: string | null;
  population: number | null;
  households: number | null;
  notes: string | null;
  createdAt: string;
}

const emptyForm = {
  name: "", area: "", coordinatorName: "", coordinatorPhone: "",
  coordinatorEmail: "", population: "", households: "", notes: "",
};

export default function WardAdmin() {
  const { lang } = useLanguage();
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ward | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.getWards()
      .then((d: Ward[]) => setWards(d))
      .catch(() => setError(lc(lang, "Failed to load wards", "வட்டாரங்களை ஏற்ற முடியவில்லை")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(w: Ward) {
    setEditing(w);
    setForm({
      name: w.name,
      area: w.area ?? "",
      coordinatorName: w.coordinatorName ?? "",
      coordinatorPhone: w.coordinatorPhone ?? "",
      coordinatorEmail: w.coordinatorEmail ?? "",
      population: w.population != null ? String(w.population) : "",
      households: w.households != null ? String(w.households) : "",
      notes: w.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError(lc(lang, "Ward name is required", "வட்டாரப் பெயர் தேவை")); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        area: form.area.trim() || null,
        coordinatorName: form.coordinatorName.trim() || null,
        coordinatorPhone: form.coordinatorPhone.trim() || null,
        coordinatorEmail: form.coordinatorEmail.trim() || null,
        population: form.population ? parseInt(form.population) : null,
        households: form.households ? parseInt(form.households) : null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await adminApi.updateWard(editing.id, payload);
      } else {
        await adminApi.createWard(payload);
      }
      setOpen(false);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(lc(lang, "Delete this ward? This cannot be undone.", "இந்த வட்டாரத்தை நீக்கவா? இதை மீட்டெடுக்க முடியாது."))) return;
    await adminApi.deleteWard(id).catch(() => null);
    load();
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{lc(lang, "Ward / Area Management", "வட்டாரம் / பகுதி மேலாண்மை")}</h3>
          <p className="text-sm text-muted-foreground">{wards.length} {lc(lang, "wards configured", "வட்டாரங்கள் அமைக்கப்பட்டுள்ளன")}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> {lc(lang, "Add Ward", "வட்டாரம் சேர்")}
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</p>
      ) : wards.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{lc(lang, "No wards configured yet. Add one to get started.", "இன்னும் வட்டாரங்கள் எதுவும் அமைக்கப்படவில்லை. தொடங்க ஒன்றைச் சேர்க்கவும்.")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {wards.map(w => (
            <Card key={w.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm">{w.name}</h4>
                    {w.area && <p className="text-xs text-muted-foreground">{w.area}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(w)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleDelete(w.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {w.coordinatorName && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {lc(lang, "Coordinator", "ஒருங்கிணைப்பாளர்")}
                    </p>
                    <p className="text-sm font-medium">{w.coordinatorName}</p>
                    {w.coordinatorPhone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {w.coordinatorPhone}
                      </p>
                    )}
                    {w.coordinatorEmail && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {w.coordinatorEmail}
                      </p>
                    )}
                  </div>
                )}
                {(w.population != null || w.households != null) && (
                  <div className="flex gap-4 text-xs pt-1 border-t">
                    {w.population != null && (
                      <div><p className="text-muted-foreground">{lc(lang, "Population", "மக்கள்தொகை")}</p><p className="font-medium">{w.population.toLocaleString()}</p></div>
                    )}
                    {w.households != null && (
                      <div><p className="text-muted-foreground">{lc(lang, "Households", "குடும்பங்கள்")}</p><p className="font-medium">{w.households.toLocaleString()}</p></div>
                    )}
                  </div>
                )}
                {w.notes && <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-2">{w.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? lc(lang, "Edit Ward", "வட்டாரத்தைத் திருத்து") : lc(lang, "Add Ward", "வட்டாரம் சேர்")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">{lc(lang, "Ward Name *", "வட்டாரப் பெயர் *")}</Label>
                <Input value={form.name} onChange={f("name")} placeholder={lc(lang, "e.g., Ward 12 – Alagar Koil Road", "எ.கா., வட்டாரம் 12 – அழகர் கோயில் சாலை")} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Area / Zone", "பகுதி / மண்டலம்")}</Label>
                <Input value={form.area} onChange={f("area")} placeholder={lc(lang, "e.g., North Zone", "எ.கா., வடக்கு மண்டலம்")} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Population", "மக்கள்தொகை")}</Label>
                <Input type="number" value={form.population} onChange={f("population")} placeholder="0" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Households", "குடும்பங்கள்")}</Label>
                <Input type="number" value={form.households} onChange={f("households")} placeholder="0" className="mt-1 text-sm" />
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{lc(lang, "Coordinator Details", "ஒருங்கிணைப்பாளர் விவரங்கள்")}</p>
              <div>
                <Label className="text-xs">{lc(lang, "Name", "பெயர்")}</Label>
                <Input value={form.coordinatorName} onChange={f("coordinatorName")} placeholder={lc(lang, "Coordinator name", "ஒருங்கிணைப்பாளர் பெயர்")} className="mt-1 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Phone", "தொலைபேசி")}</Label>
                  <Input value={form.coordinatorPhone} onChange={f("coordinatorPhone")} placeholder="+91 …" className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Email", "மின்னஞ்சல்")}</Label>
                  <Input type="email" value={form.coordinatorEmail} onChange={f("coordinatorEmail")} placeholder="email@…" className="mt-1 text-sm" />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Notes", "குறிப்புகள்")}</Label>
              <Textarea value={form.notes} onChange={f("notes")} placeholder={lc(lang, "Any special notes about this ward…", "இந்த வட்டாரம் குறித்த சிறப்புக் குறிப்புகள்…")} rows={2} className="mt-1 text-sm" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lc(lang, "Cancel", "ரத்து")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="bg-primary hover:bg-primary/90">
              {saving ? lc(lang, "Saving…", "சேமிக்கிறது…") : editing ? lc(lang, "Save Changes", "மாற்றங்களை சேமி") : lc(lang, "Add Ward", "வட்டாரம் சேர்")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
