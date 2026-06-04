import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import { adminApi } from "./api";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUploader from "@/components/ImageUploader";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

interface NewsItem {
  id: number;
  title: string;
  titleTa?: string | null;
  content: string;
  contentTa?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  category: string;
  featured: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

interface NewsAdminProps {
  fixedCategory?: string;
  categoryLabel?: string;
  categoryLabelTa?: string;
  sectionTitle?: string;
  sectionTitleTa?: string;
}

export default function NewsAdmin({
  fixedCategory,
  categoryLabel = "Article",
  categoryLabelTa = "கட்டுரை",
  sectionTitle = "News & Announcements",
  sectionTitleTa = "செய்திகள் & அறிவிப்புகள்",
}: NewsAdminProps) {
  const { lang } = useLanguage();
  const resolvedCategoryLabel = lc(lang, categoryLabel, categoryLabelTa);
  const resolvedSectionTitle = lc(lang, sectionTitle, sectionTitleTa);
  const defaultCategory = fixedCategory ?? "general";
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState({ title: "", titleTa: "", content: "", contentTa: "", imageUrl: "", thumbnailUrl: "", category: defaultCategory, featured: false, publishedAt: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestingH, setSuggestingH] = useState(false);
  const [suggestedH, setSuggestedH] = useState<Array<{ en: string; ta: string }>>([]);

  const load = (p = page) => {
    setLoading(true);
    adminApi.getNews(p, 15, fixedCategory)
      .then((d: { items: NewsItem[]; total: number }) => { setItems(d.items); setTotal(d.total); })
      .catch(() => setError(lc(lang, "Failed to load news", "செய்திகளை ஏற்ற முடியவில்லை")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  function openCreate() {
    setEditing(null);
    setForm({ title: "", titleTa: "", content: "", contentTa: "", imageUrl: "", thumbnailUrl: "", category: defaultCategory, featured: false, publishedAt: "" });
    setOpen(true);
  }

  function openEdit(item: NewsItem) {
    setEditing(item);
    setForm({
      title: item.title, titleTa: item.titleTa ?? "", content: item.content,
      contentTa: item.contentTa ?? "", imageUrl: item.imageUrl ?? "",
      thumbnailUrl: item.thumbnailUrl ?? "",
      category: item.category, featured: item.featured,
      publishedAt: item.publishedAt ? item.publishedAt.slice(0, 10) : "",
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        imageUrl: form.imageUrl || null,
        thumbnailUrl: form.thumbnailUrl || null,
        titleTa: form.titleTa || null,
        contentTa: form.contentTa || null,
        publishedAt: form.publishedAt || null,
      };
      if (editing) {
        await adminApi.updateNews(editing.id, payload);
      } else {
        await adminApi.createNews(payload);
      }
      setOpen(false);
      setPage(1);
      load(1);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(lc(lang, "Delete this article?", "இந்த கட்டுரையை நீக்கவா?"))) return;
    await adminApi.deleteNews(id).catch(() => null);
    load();
  }

  async function suggestHeadlines() {
    if (!form.content || form.content.length < 10) return;
    setSuggestingH(true); setSuggestedH([]);
    try {
      const r = await adminApi.getHeadlineSuggestions({ content: form.content, category: form.category || undefined });
      setSuggestedH(r.headlines ?? []);
    } catch (e: unknown) {
      setSuggestedH([]);
      const msg = (e as Error)?.message || "";
      setError(/503|OPENAI_API_KEY|not configured/i.test(msg) ? lc(lang, "AI is not configured (missing OpenAI API key).", "AI கட்டமைக்கப்படவில்லை (OpenAI API விசை இல்லை).") : lc(lang, "Failed to suggest headlines.", "தலைப்புகளை பரிந்துரைக்க முடியவில்லை."));
    }
    finally { setSuggestingH(false); }
  }

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{resolvedSectionTitle}</h2>
          <p className="text-sm text-muted-foreground">{total} {lc(lang, "articles", "கட்டுரைகள்")}{fixedCategory ? ` (${fixedCategory})` : ""}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> {lc(lang, "Add", "சேர்")} {resolvedCategoryLabel}
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "No articles yet", "இதுவரை கட்டுரைகள் இல்லை")}</p>
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
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    {item.featured && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{lc(lang, "Featured", "சிறப்பு")}</Badge>}
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.createdAt).toLocaleDateString("en-IN")}
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
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>{lc(lang, "Previous", "முந்தைய")}</Button>
          <span className="text-sm text-muted-foreground">{lc(lang, "Page", "பக்கம்")} {page} {lc(lang, "of", "/")} {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{lc(lang, "Next", "அடுத்து")}</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `${lc(lang, "Edit", "திருத்து")} ${resolvedCategoryLabel}` : `${lc(lang, "New", "புதிய")} ${resolvedCategoryLabel}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lc(lang, "Title (English) *", "தலைப்பு (ஆங்கிலம்) *")}</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Title (Tamil)", "தலைப்பு (தமிழ்)")}</Label>
                <Input value={form.titleTa} onChange={e => setForm(f => ({ ...f, titleTa: e.target.value }))} className="mt-1 text-sm" />
              </div>
            </div>
            {/* AI headline suggestions */}
            {form.content.length >= 10 && (
              <div>
                <Button type="button" size="sm" variant="outline" onClick={suggestHeadlines} disabled={suggestingH} className="gap-1.5 text-xs h-7">
                  {suggestingH ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
                  {lc(lang, "Suggest headlines with AI", "AI மூலம் தலைப்புகளை பரிந்துரை")}
                </Button>
                {suggestedH.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {suggestedH.map((h, i) => (
                      <div key={i} className="border rounded px-2 py-1.5 bg-muted/30 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{h.en}</span>
                          <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] px-1 ml-1" onClick={() => setForm(f => ({ ...f, title: h.en, titleTa: h.ta }))}>{lc(lang, "Use", "பயன்படுத்து")}</Button>
                        </div>
                        <div className="text-muted-foreground truncate">{h.ta}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs">{lc(lang, "Content (English) *", "உள்ளடக்கம் (ஆங்கிலம்) *")}</Label>
              <RichTextEditor
                value={form.content}
                onChange={html => setForm(f => ({ ...f, content: html }))}
                placeholder={lc(lang, "Write article content here…", "கட்டுரை உள்ளடக்கத்தை இங்கே எழுதுங்கள்…")}
                minHeight={140}
              />
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Content (Tamil)", "உள்ளடக்கம் (தமிழ்)")}</Label>
              <RichTextEditor
                value={form.contentTa}
                onChange={html => setForm(f => ({ ...f, contentTa: html }))}
                placeholder="தமிழில் உள்ளடக்கத்தை இங்கே எழுதுங்கள்…"
                minHeight={100}
              />
            </div>
            <ImageUploader
              label={lc(lang, "Image", "படம்")}
              value={form.imageUrl}
              onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
              onThumbnailChange={(url) => setForm(f => ({ ...f, thumbnailUrl: url }))}
            />
            <div>
              <Label className="text-xs">{lc(lang, "Category", "வகை")}</Label>
              <Input value={form.category} readOnly={!!fixedCategory}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className={`mt-1 text-sm ${fixedCategory ? "bg-muted" : ""}`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lc(lang, "Published At", "வெளியிட்ட தேதி")}</Label>
                <Input type="date" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} className="mt-1 text-sm" />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <input type="checkbox" id="featured" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
                <label htmlFor="featured" className="text-sm cursor-pointer">{lc(lang, "Featured article", "சிறப்பு கட்டுரை")}</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lc(lang, "Cancel", "ரத்து")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.content} className="bg-primary hover:bg-primary/90">
              {saving ? lc(lang, "Saving…", "சேமிக்கிறது…") : editing ? lc(lang, "Update", "புதுப்பி") : lc(lang, "Create", "உருவாக்கு")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
