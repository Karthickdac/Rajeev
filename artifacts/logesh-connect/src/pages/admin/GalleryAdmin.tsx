import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Image, Film, ExternalLink, ChevronUp, ChevronDown, Filter } from "lucide-react";
import { adminApi } from "./api";
import ImageUploader from "@/components/ImageUploader";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

interface GalleryItem {
  id: number;
  title: string;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  mediaType: "photo" | "video";
  album?: string | null;
  displayOrder: number;
  createdAt: string;
}

const emptyForm = { title: "", mediaUrl: "", thumbnailUrl: "", mediaType: "photo" as "photo" | "video", album: "", displayOrder: 0 };

export default function GalleryAdmin() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [albumFilter, setAlbumFilter] = useState("");
  const [reordering, setReordering] = useState<number | null>(null);

  const load = (p = page, album = albumFilter) => {
    setLoading(true);
    adminApi.getGallery(p, 24, album || undefined)
      .then((d: { items: GalleryItem[]; total: number }) => {
        setItems(d.items.sort((a, b) => a.displayOrder - b.displayOrder || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setTotal(d.total);
      })
      .catch(() => setError(lc(lang, "Failed to load gallery", "படத்தொகுப்பை ஏற்ற முடியவில்லை")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, albumFilter]);

  async function handleSave() {
    setSaving(true);
    try {
      await adminApi.createGallery({
        ...form, thumbnailUrl: form.thumbnailUrl || null, album: form.album || null,
      });
      setOpen(false);
      setForm(emptyForm);
      load(1);
      setPage(1);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(lc(lang, "Remove this item from the gallery?", "இந்த உருப்படியை படத்தொகுப்பிலிருந்து நீக்கவா?"))) return;
    await adminApi.deleteGallery(id).catch(() => null);
    load();
  }

  async function reorder(id: number, direction: "up" | "down") {
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    setReordering(id);
    const newOrder = [...items];
    const [a, b] = [newOrder[idx], newOrder[swapIdx]];
    const tempOrder = a.displayOrder;
    a.displayOrder = b.displayOrder;
    b.displayOrder = tempOrder;
    newOrder[idx] = a; newOrder[swapIdx] = b;
    // swap positions
    newOrder.sort((x, y) => x.displayOrder - y.displayOrder || new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
    setItems([...newOrder]);

    try {
      await Promise.all([
        adminApi.updateGallery(a.id, { displayOrder: a.displayOrder }),
        adminApi.updateGallery(b.id, { displayOrder: b.displayOrder }),
      ]);
    } catch (e: unknown) {
      setError((e as Error).message);
      load();
    } finally {
      setReordering(null);
    }
  }

  const albums = [...new Set(items.map(i => i.album).filter(Boolean))] as string[];
  const totalPages = Math.ceil(total / 24);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">{lc(lang, "Media Gallery", "ஊடக படத்தொகுப்பு")}</h2>
          <p className="text-sm text-muted-foreground">{total} {lc(lang, "items", "உருப்படிகள்")}{albumFilter ? ` ${lc(lang, "in", "—")} "${albumFilter}"` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {albums.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={albumFilter}
                onChange={e => { setAlbumFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              >
                <option value="">{lc(lang, "All Albums", "அனைத்து தொகுப்புகள்")}</option>
                {albums.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
          <Button onClick={() => setOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> {lc(lang, "Add Media", "ஊடகம் சேர்")}
          </Button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((item, idx) => (
            <div key={item.id} className="relative group rounded-lg overflow-hidden border bg-muted/30 aspect-square">
              {item.mediaType === "photo" ? (
                <img
                  src={item.thumbnailUrl ?? item.mediaUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={e => { (e.target as HTMLImageElement).src = ""; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <Film className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                <p className="text-white text-xs text-center font-medium leading-tight line-clamp-2">{item.title}</p>
                {item.album && <p className="text-gray-300 text-xs">{item.album}</p>}
                <div className="flex gap-1 mt-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20"
                    disabled={idx === 0 || reordering === item.id}
                    onClick={() => reorder(item.id, "up")}>
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20"
                    disabled={idx === items.length - 1 || reordering === item.id}
                    onClick={() => reorder(item.id, "down")}>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <a href={item.mediaUrl} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-red-900/40" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="absolute top-1 left-1">
                <Badge className={`text-xs px-1 py-0 ${item.mediaType === "video" ? "bg-blue-600" : "bg-primary"}`}>
                  {item.mediaType === "video" ? <Film className="w-2.5 h-2.5" /> : <Image className="w-2.5 h-2.5" />}
                </Badge>
              </div>
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                #{item.displayOrder}
              </div>
            </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lc(lang, "Add Media", "ஊடகம் சேர்")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">{lc(lang, "Title *", "தலைப்பு *")}</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 text-sm" />
            </div>
            <ImageUploader
              label={lc(lang, "Media URL *", "ஊடக URL *")}
              value={form.mediaUrl}
              onChange={(url) => setForm(f => ({ ...f, mediaUrl: url }))}
              onThumbnailChange={(url) => setForm(f => ({ ...f, thumbnailUrl: url }))}
              placeholder={lc(lang, "https://… or upload below", "https://… அல்லது கீழே பதிவேற்றவும்")}
            />
            <ImageUploader
              label={lc(lang, "Thumbnail (optional)", "சிறுபடம் (விருப்பம்)")}
              value={form.thumbnailUrl}
              onChange={(url) => setForm(f => ({ ...f, thumbnailUrl: url }))}
              placeholder={lc(lang, "https://… (optional)", "https://… (விருப்பம்)")}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lc(lang, "Type", "வகை")}</Label>
                <select
                  value={form.mediaType}
                  onChange={e => setForm(f => ({ ...f, mediaType: e.target.value as "photo" | "video" }))}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="photo">{lc(lang, "Photo", "புகைப்படம்")}</option>
                  <option value="video">{lc(lang, "Video", "வீடியோ")}</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Album / Event Tag", "தொகுப்பு / நிகழ்வு குறிச்சொல்")}</Label>
                <Input value={form.album} onChange={e => setForm(f => ({ ...f, album: e.target.value }))} placeholder={lc(lang, "Optional", "விருப்பம்")} className="mt-1 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Display Order", "வரிசை")}</Label>
              <Input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} className="mt-1 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lc(lang, "Cancel", "ரத்து")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.mediaUrl} className="bg-primary hover:bg-primary/90">
              {saving ? lc(lang, "Adding…", "சேர்க்கிறது…") : lc(lang, "Add to Gallery", "படத்தொகுப்பில் சேர்")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
