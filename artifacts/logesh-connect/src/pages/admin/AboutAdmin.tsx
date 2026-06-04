import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, RefreshCw, Eye, EyeOff, AlertCircle } from "lucide-react";
import { adminApi } from "./api";
import { AboutView, DEFAULT_ABOUT_CONFIG, type AboutConfig } from "@/components/AboutView";
import { useUnsavedChangesGuard } from "@/lib/unsavedChanges";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";
import type { Language } from "@/lib/i18n";

const DEFAULT_CONFIG: AboutConfig = {
  ...DEFAULT_ABOUT_CONFIG,
  bioBrief: "",
  bioBriefTa: "",
  bioFull: "",
  bioFullTa: "",
};

const URL_RE = /^https?:\/\/[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateConfig(c: AboutConfig, lang: Language): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!c.name.trim()) errs.name = lc(lang, "Name is required", "பெயர் அவசியம்");
  if (!c.designation.trim()) errs.designation = lc(lang, "Designation is required", "பதவி அவசியம்");
  if (!c.constituency.trim()) errs.constituency = lc(lang, "Constituency is required", "தொகுதி அவசியம்");
  if (!c.party.trim()) errs.party = lc(lang, "Party is required", "கட்சி அவசியம்");
  if (!c.bioBrief.trim()) errs.bioBrief = lc(lang, "Brief bio is required", "சுருக்க வாழ்க்கை வரலாறு அவசியம்");
  if (!c.phone.trim()) errs.phone = lc(lang, "Phone is required", "தொலைபேசி அவசியம்");
  if (!c.email.trim()) errs.email = lc(lang, "Email is required", "மின்னஞ்சல் அவசியம்");
  else if (!EMAIL_RE.test(c.email.trim())) errs.email = lc(lang, "Invalid email address", "தவறான மின்னஞ்சல் முகவரி");

  const photo = c.photoUrl.trim();
  if (photo && !URL_RE.test(photo) && !photo.startsWith("/uploads/") && !photo.startsWith("/api/uploads/")) {
    errs.photoUrl = lc(lang, "Must be a valid URL or /uploads/ path", "சரியான URL அல்லது /uploads/ பாதையாக இருக்க வேண்டும்");
  }
  (["facebook", "twitter", "instagram", "youtube"] as const).forEach((k) => {
    const v = c[k].trim();
    if (v && !URL_RE.test(v)) errs[k] = lc(lang, "Must be a valid http(s) URL", "சரியான http(s) URL ஆக இருக்க வேண்டும்");
  });
  return errs;
}

export default function AboutAdmin() {
  const { lang } = useLanguage();
  const [config, setConfig] = useState<AboutConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [previewLang, setPreviewLang] = useState<"en" | "ta">("en");
  // Snapshot of the last saved (or freshly loaded) config, used to detect
  // unsaved edits. Compared via JSON serialization for value equality.
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(DEFAULT_CONFIG));

  useEffect(() => {
    adminApi.getAbout()
      .then((d: AboutConfig | null) => {
        const next = d ? { ...DEFAULT_CONFIG, ...d } : DEFAULT_CONFIG;
        setConfig(next);
        setSavedSnapshot(JSON.stringify(next));
      })
      .catch(() => setError(lc(lang, "Failed to load about config", "சுயவிவர அமைப்பை ஏற்ற முடியவில்லை")))
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(() => JSON.stringify(config) !== savedSnapshot, [config, savedSnapshot]);

  // Auto-clear the green "saved" toast after 3 seconds, with proper cleanup
  // so it can't fire after unmount or stack across rapid saves.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  // Register with the surrounding admin shell so that switching sidebar
  // sections, browser back/forward, and reload/close all prompt before
  // discarding unsaved edits.
  useUnsavedChangesGuard(isDirty);

  const set = <K extends keyof AboutConfig>(key: K, value: AboutConfig[K]) =>
    setConfig(c => ({ ...c, [key]: value }));

  const setHighlight = (i: number, field: keyof AboutConfig["highlights"][0], value: string) =>
    setConfig(c => ({
      ...c,
      highlights: c.highlights.map((h, idx) => idx === i ? { ...h, [field]: value } : h),
    }));

  const addHighlight = () =>
    setConfig(c => ({ ...c, highlights: [...c.highlights, { title: "", titleTa: "", value: "", icon: "Star" }] }));

  const removeHighlight = (i: number) =>
    setConfig(c => ({ ...c, highlights: c.highlights.filter((_, idx) => idx !== i) }));

  async function handleSave() {
    const errs = validateConfig(config, lang);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError(lc(lang, "Please fix the errors below before saving.", "சேமிப்பதற்கு முன் கீழே உள்ள பிழைகளை சரிசெய்யவும்."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateAbout(config);
      // Refresh the dirty baseline so the unsaved-changes banner clears.
      setSavedSnapshot(JSON.stringify(config));
      setSaved(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const errClass = (k: string) => fieldErrors[k] ? "border-red-500 focus-visible:ring-red-500" : "";
  const errMsg = (k: string) => fieldErrors[k] ? <p className="text-xs text-red-500 mt-1">{fieldErrors[k]}</p> : null;

  if (loading) return <div className="py-20 text-center text-muted-foreground">{lc(lang, "Loading…", "ஏற்றுகிறது…")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">{lc(lang, "About Page CMS", "சுயவிவர பக்க CMS")}</h2>
          <p className="text-sm text-muted-foreground">{lc(lang, "Edit the leader's bio, contact details, and highlights. Changes appear in the live preview as you type.", "தலைவரின் வாழ்க்கை வரலாறு, தொடர்பு விவரங்கள் மற்றும் சிறப்பம்சங்களை திருத்தவும். தட்டச்சு செய்யும்போதே மாற்றங்கள் நேரடி முன்னோட்டத்தில் தோன்றும்.")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            data-testid="about-preview-toggle"
            className="gap-1.5"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? lc(lang, "Hide preview", "முன்னோட்டத்தை மறை") : lc(lang, "Show preview", "முன்னோட்டத்தை காட்டு")}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/about" target="_blank" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" /> {lc(lang, "Open public page", "பொது பக்கத்தை திற")}
            </a>
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary hover:bg-primary/90">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? lc(lang, "Saved!", "சேமிக்கப்பட்டது!") : saving ? lc(lang, "Saving…", "சேமிக்கிறது…") : lc(lang, "Save Changes", "மாற்றங்களை சேமி")}
          </Button>
        </div>
      </div>

      {isDirty && (
        <p
          data-testid="about-unsaved-banner"
          className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{lc(lang, "You have unsaved changes. Don't forget to click", "சேமிக்கப்படாத மாற்றங்கள் உள்ளன. இந்த பக்கத்தை விட்டு வெளியேறும் முன்")} <strong>{lc(lang, "Save Changes", "மாற்றங்களை சேமி")}</strong> {lc(lang, "before leaving this page.", "என்பதை கிளிக் செய்ய மறக்காதீர்கள்.")}</span>
        </p>
      )}
      {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      {saved && !isDirty && <p className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2">{lc(lang, "Changes saved successfully.", "மாற்றங்கள் வெற்றிகரமாக சேமிக்கப்பட்டன.")}</p>}

      <div className={showPreview ? "grid grid-cols-1 xl:grid-cols-2 gap-6 items-start" : ""}>
        <div className={`space-y-6 ${showPreview ? "" : "max-w-3xl"}`}>

      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{lc(lang, "Basic Information", "அடிப்படை தகவல்")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Full Name (English) *", "முழு பெயர் (ஆங்கிலம்) *")}</Label>
              <Input value={config.name} onChange={e => set("name", e.target.value)} className={`mt-1 text-sm ${errClass("name")}`} />
              {errMsg("name")}
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Full Name (Tamil)", "முழு பெயர் (தமிழ்)")}</Label>
              <Input value={config.nameTa} onChange={e => set("nameTa", e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Designation *", "பதவி (ஆங்கிலம்) *")}</Label>
              <Input value={config.designation} onChange={e => set("designation", e.target.value)} className={`mt-1 text-sm ${errClass("designation")}`} />
              {errMsg("designation")}
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Designation (Tamil)", "பதவி (தமிழ்)")}</Label>
              <Input value={config.designationTa} onChange={e => set("designationTa", e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Constituency *", "தொகுதி (ஆங்கிலம்) *")}</Label>
              <Input value={config.constituency} onChange={e => set("constituency", e.target.value)} className={`mt-1 text-sm ${errClass("constituency")}`} />
              {errMsg("constituency")}
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Constituency (Tamil)", "தொகுதி (தமிழ்)")}</Label>
              <Input value={config.constituencyTa} onChange={e => set("constituencyTa", e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Party *", "கட்சி (ஆங்கிலம்) *")}</Label>
              <Input value={config.party} onChange={e => set("party", e.target.value)} className={`mt-1 text-sm ${errClass("party")}`} />
              {errMsg("party")}
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Party (Tamil)", "கட்சி (தமிழ்)")}</Label>
              <Input value={config.partyTa} onChange={e => set("partyTa", e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Date of Birth", "பிறந்த தேதி")}</Label>
              <Input value={config.born} onChange={e => set("born", e.target.value)} placeholder={lc(lang, "e.g. 15 April 1975", "எ.கா. 15 ஏப்ரல் 1975")} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Education", "கல்வி")}</Label>
              <Input value={config.education} onChange={e => set("education", e.target.value)} placeholder={lc(lang, "e.g. B.E. (Civil Engineering)", "எ.கா. B.E. (கட்டட பொறியியல்)")} className="mt-1 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">{lc(lang, "Profile Photo URL", "சுயவிவர புகைப்பட URL")}</Label>
            <Input value={config.photoUrl} onChange={e => set("photoUrl", e.target.value)} placeholder="https://… or /uploads/…" className={`mt-1 text-sm ${errClass("photoUrl")}`} />
            {errMsg("photoUrl")}
          </div>
        </CardContent>
      </Card>

      {/* Biography */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{lc(lang, "Biography", "வாழ்க்கை வரலாறு")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{lc(lang, "Brief Bio (English) * — shown on hero section", "சுருக்க வாழ்க்கை வரலாறு (ஆங்கிலம்) * — முதன்மை பகுதியில் காட்டப்படும்")}</Label>
            <Textarea value={config.bioBrief} onChange={e => set("bioBrief", e.target.value)} rows={2} className={`mt-1 text-sm ${errClass("bioBrief")}`} />
            {errMsg("bioBrief")}
          </div>
          <div>
            <Label className="text-xs">{lc(lang, "Brief Bio (Tamil)", "சுருக்க வாழ்க்கை வரலாறு (தமிழ்)")}</Label>
            <Textarea value={config.bioBriefTa} onChange={e => set("bioBriefTa", e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">{lc(lang, "Full Biography (English)", "முழு வாழ்க்கை வரலாறு (ஆங்கிலம்)")}</Label>
            <Textarea value={config.bioFull} onChange={e => set("bioFull", e.target.value)} rows={5} placeholder={lc(lang, "Full biography text…", "முழு வாழ்க்கை வரலாறு உரை…")} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">{lc(lang, "Full Biography (Tamil)", "முழு வாழ்க்கை வரலாறு (தமிழ்)")}</Label>
            <Textarea value={config.bioFullTa} onChange={e => set("bioFullTa", e.target.value)} rows={4} className="mt-1 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Key Achievements */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">{lc(lang, "Achievement Highlights", "சாதனை சிறப்பம்சங்கள்")}</CardTitle>
          <Button size="sm" variant="outline" onClick={addHighlight} className="h-7 text-xs">{lc(lang, "+ Add", "+ சேர்")}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.highlights.map((h, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-end border-b pb-3 last:border-b-0 last:pb-0">
              <div>
                <Label className="text-xs">{lc(lang, "Title (EN)", "தலைப்பு (ஆங்கிலம்)")}</Label>
                <Input value={h.title} onChange={e => setHighlight(i, "title", e.target.value)} className="mt-1 text-xs h-8" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Title (TA)", "தலைப்பு (தமிழ்)")}</Label>
                <Input value={h.titleTa} onChange={e => setHighlight(i, "titleTa", e.target.value)} className="mt-1 text-xs h-8" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Value", "மதிப்பு")}</Label>
                <Input value={h.value} onChange={e => setHighlight(i, "value", e.target.value)} placeholder={lc(lang, "e.g. 120+ km", "எ.கா. 120+ கி.மீ")} className="mt-1 text-xs h-8" />
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-red-500 hover:bg-red-50" onClick={() => removeHighlight(i)}>✕</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{lc(lang, "Contact Information", "தொடர்பு தகவல்")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Phone *", "தொலைபேசி *")}</Label>
              <Input value={config.phone} onChange={e => set("phone", e.target.value)} className={`mt-1 text-sm ${errClass("phone")}`} />
              {errMsg("phone")}
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Email *", "மின்னஞ்சல் *")}</Label>
              <Input type="email" value={config.email} onChange={e => set("email", e.target.value)} className={`mt-1 text-sm ${errClass("email")}`} />
              {errMsg("email")}
            </div>
          </div>
          <div>
            <Label className="text-xs">{lc(lang, "Office Address (English)", "அலுவலக முகவரி (ஆங்கிலம்)")}</Label>
            <Textarea value={config.officeAddress} onChange={e => set("officeAddress", e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">{lc(lang, "Office Address (Tamil)", "அலுவலக முகவரி (தமிழ்)")}</Label>
            <Textarea value={config.officeAddressTa} onChange={e => set("officeAddressTa", e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{lc(lang, "Social Media Links", "சமூக ஊடக இணைப்புகள்")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Facebook URL", "ஃபேஸ்புக் URL")}</Label>
              <Input value={config.facebook} onChange={e => set("facebook", e.target.value)} placeholder="https://facebook.com/…" className={`mt-1 text-sm ${errClass("facebook")}`} />
              {errMsg("facebook")}
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "Twitter/X URL", "ட்விட்டர்/X URL")}</Label>
              <Input value={config.twitter} onChange={e => set("twitter", e.target.value)} placeholder="https://x.com/…" className={`mt-1 text-sm ${errClass("twitter")}`} />
              {errMsg("twitter")}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{lc(lang, "Instagram URL", "இன்ஸ்டாகிராம் URL")}</Label>
              <Input value={config.instagram} onChange={e => set("instagram", e.target.value)} placeholder="https://instagram.com/…" className={`mt-1 text-sm ${errClass("instagram")}`} />
              {errMsg("instagram")}
            </div>
            <div>
              <Label className="text-xs">{lc(lang, "YouTube URL", "யூடியூப் URL")}</Label>
              <Input value={config.youtube} onChange={e => set("youtube", e.target.value)} placeholder="https://youtube.com/…" className={`mt-1 text-sm ${errClass("youtube")}`} />
              {errMsg("youtube")}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 bg-primary hover:bg-primary/90">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? lc(lang, "Saved!", "சேமிக்கப்பட்டது!") : lc(lang, "Save All Changes", "அனைத்து மாற்றங்களையும் சேமி")}
        </Button>
      </div>
        </div>

        {showPreview && (
          <div className="xl:sticky xl:top-4 self-start" data-testid="about-preview-panel">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 bg-muted/40 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" /> {lc(lang, "Live preview", "நேரடி முன்னோட்டம்")}
                </CardTitle>
                <div className="flex gap-1 rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewLang("en")}
                    data-testid="about-preview-lang-en"
                    className={`px-2 py-0.5 text-xs rounded ${previewLang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLang("ta")}
                    data-testid="about-preview-lang-ta"
                    className={`px-2 py-0.5 text-xs rounded ${previewLang === "ta" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    தமிழ்
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-4 max-h-[calc(100vh-12rem)] overflow-y-auto bg-background">
                <AboutView config={config} lang={previewLang} embedded />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
