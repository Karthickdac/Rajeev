import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin, Sparkles, Loader2 } from "lucide-react";
import { adminApi } from "./api";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUploader from "@/components/ImageUploader";

interface ActivityItem {
  id: number;
  title: string;
  titleTa?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  activityDate: string;
  location?: string | null;
  category: string;
  createdAt: string;
}

const emptyForm = {
  title: "", titleTa: "", description: "", descriptionTa: "",
  imageUrl: "", thumbnailUrl: "", activityDate: "", location: "", category: "general",
};

export default function ActivitiesAdmin() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [expandedAi, setExpandedAi] = useState<{ description_en: string; description_ta: string } | null>(null);

  const load = (p = page) => {
    setLoading(true);
    adminApi.getActivities(p, 15)
      .then((d: { items: ActivityItem[]; total: number }) => { setItems(d.items); setTotal(d.total); })
      .catch(() => setError("Failed to load activities"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  function openCreate() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(item: ActivityItem) {
    setEditing(item);
    setForm({
      title: item.title, titleTa: item.titleTa ?? "", description: item.description ?? "",
      descriptionTa: "", imageUrl: item.imageUrl ?? "", thumbnailUrl: item.thumbnailUrl ?? "",
      activityDate: item.activityDate.slice(0, 10), location: item.location ?? "", category: item.category,
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form, imageUrl: form.imageUrl || null, thumbnailUrl: form.thumbnailUrl || null,
        titleTa: form.titleTa || null,
        description: form.description || null, location: form.location || null,
      };
      if (editing) await adminApi.updateActivity(editing.id, payload);
      else await adminApi.createActivity(payload);
      setOpen(false);
      load(page);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this activity?")) return;
    await adminApi.deleteActivity(id).catch(() => null);
    load();
  }

  async function handleExpandAi() {
    if (!form.title) return;
    setExpanding(true); setExpandedAi(null);
    try {
      const r = await adminApi.expandActivity({ title: form.title, draft: form.description || undefined, category: form.category || undefined });
      setExpandedAi(r);
    } catch (e: unknown) {
      setExpandedAi(null);
      const msg = (e as Error)?.message || "";
      setError(/503|OPENAI_API_KEY|not configured/i.test(msg) ? "AI is not configured (missing OpenAI API key)." : "Failed to expand with AI.");
    }
    finally { setExpanding(false); }
  }

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Field Activities</h2>
          <p className="text-sm text-muted-foreground">{total} activities</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Activity
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading…</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-start gap-4">
                {(item.thumbnailUrl ?? item.imageUrl) && (
                  <img src={item.thumbnailUrl ?? item.imageUrl ?? ""} alt="" loading="lazy" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{item.title}</p>
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                  </div>
                  {item.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3" /> {item.location}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(item.activityDate).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Activity" : "New Activity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Title (English) *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Title (Tamil)</Label>
                <Input value={form.titleTa} onChange={e => setForm(f => ({ ...f, titleTa: e.target.value }))} className="mt-1 text-sm" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Description</Label>
                <Button type="button" size="sm" variant="outline" onClick={handleExpandAi} disabled={expanding || !form.title} className="gap-1 text-xs h-6 px-2">
                  {expanding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
                  Expand with AI
                </Button>
              </div>
              <RichTextEditor
                value={form.description}
                onChange={html => setForm(f => ({ ...f, description: html }))}
                placeholder="Activity description…"
                minHeight={120}
              />
              {expandedAi && (
                <div className="mt-2 border rounded-md p-2 bg-muted/30 space-y-2 text-xs">
                  <p className="text-muted-foreground font-medium">AI suggested:</p>
                  <div>
                    <p className="font-medium mb-0.5">English</p>
                    <p className="text-muted-foreground line-clamp-3">{expandedAi.description_en}</p>
                    <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] px-1 mt-1" onClick={() => { setForm(f => ({ ...f, description: expandedAi.description_en })); setExpandedAi(null); }}>Use English</Button>
                  </div>
                  <div>
                    <p className="font-medium mb-0.5">Tamil</p>
                    <p className="text-muted-foreground line-clamp-3">{expandedAi.description_ta}</p>
                    <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] px-1 mt-1" onClick={() => { setForm(f => ({ ...f, description: expandedAi.description_ta })); setExpandedAi(null); }}>Use Tamil</Button>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Activity Date *</Label>
                <Input type="date" value={form.activityDate} onChange={e => setForm(f => ({ ...f, activityDate: e.target.value }))} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Location</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="mt-1 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="mt-1 text-sm" />
            </div>
            <ImageUploader
              label="Image"
              value={form.imageUrl}
              onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
              onThumbnailChange={(url) => setForm(f => ({ ...f, thumbnailUrl: url }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.activityDate} className="bg-primary hover:bg-primary/90">
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
