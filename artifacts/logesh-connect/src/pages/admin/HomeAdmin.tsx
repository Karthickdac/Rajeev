import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, RefreshCw, Eye, EyeOff, AlertCircle } from "lucide-react";
import { adminApi } from "./api";
import {
  HomeView,
  DEFAULT_HOME_HERO,
  type HomeHeroConfig,
} from "@/components/HomeView";
import { useUnsavedChangesGuard } from "@/lib/unsavedChanges";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";
import type { Language } from "@/lib/i18n";

const SAMPLE_SUMMARY = { totalVolunteers: 1240, totalEvents: 32, totalNews: 87 };
const SAMPLE_STATS = {
  roadsBuiltKm: 120,
  waterProjectsCompleted: 30,
  schoolsUpgraded: 45,
  jobsCreated: 5000,
  beneficiariesServed: 25000,
};
const SAMPLE_NEWS = [
  { id: 1, title: "Sample news headline", titleTa: "மாதிரி தலைப்பு", category: "Update", publishedAt: new Date().toISOString(), thumbnailUrl: null, imageUrl: null },
  { id: 2, title: "Another announcement", titleTa: "மற்றொரு அறிவிப்பு", category: "Press", publishedAt: new Date().toISOString(), thumbnailUrl: null, imageUrl: null },
];
const SAMPLE_EVENTS = [
  { id: 1, title: "Public meeting", titleTa: "பொதுக் கூட்டம்", eventDate: new Date(Date.now() + 86400000 * 3).toISOString(), venue: "Constituency Office", thumbnailUrl: null, imageUrl: null },
];
const SAMPLE_ACTIVITIES = [
  { title: "Road inspection completed", titleTa: "சாலை ஆய்வு", location: "Ward 12", activityDate: new Date().toISOString() },
  { title: "Met grievance officers", titleTa: "அதிகாரிகளுடன் சந்திப்பு", location: "Office", activityDate: new Date().toISOString() },
];

const URL_RE = /^https?:\/\/[^\s]+$/i;

function validate(c: HomeHeroConfig, lang: Language): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!c.headline.trim()) errs.headline = lc(lang, "Headline is required", "தலைப்பு அவசியம்");
  if (!c.subheadline.trim()) errs.subheadline = lc(lang, "Subheadline is required", "துணை தலைப்பு அவசியம்");
  if (!c.description.trim()) errs.description = lc(lang, "Description is required", "விவரம் அவசியம்");
  if (!c.primaryCtaLabel.trim()) errs.primaryCtaLabel = lc(lang, "Primary CTA label required", "முதன்மை பொத்தான் தலைப்பு அவசியம்");
  if (!c.primaryCtaHref.trim() || !c.primaryCtaHref.startsWith("/")) errs.primaryCtaHref = lc(lang, "Must start with /", "/ உடன் தொடங்க வேண்டும்");
  if (!c.secondaryCtaLabel.trim()) errs.secondaryCtaLabel = lc(lang, "Secondary CTA label required", "இரண்டாம் பொத்தான் தலைப்பு அவசியம்");
  if (!c.secondaryCtaHref.trim() || !c.secondaryCtaHref.startsWith("/")) errs.secondaryCtaHref = lc(lang, "Must start with /", "/ உடன் தொடங்க வேண்டும்");
  const photo = c.photoUrl.trim();
  if (photo && !URL_RE.test(photo) && !photo.startsWith("/uploads/") && !photo.startsWith("/api/uploads/") && !photo.startsWith("/api/storage/") && !photo.startsWith("/")) {
    errs.photoUrl = lc(lang, "Must be a valid URL or an uploaded image path", "சரியான URL அல்லது பதிவேற்றிய படப் பாதையாக இருக்க வேண்டும்");
  }
  return errs;
}

export default function HomeAdmin() {
  const { lang } = useLanguage();
  const [config, setConfig] = useState<HomeHeroConfig>(DEFAULT_HOME_HERO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [previewLang, setPreviewLang] = useState<"en" | "ta">("en");
  // Snapshot of the last loaded/saved config, used to detect unsaved edits.
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(DEFAULT_HOME_HERO));

  useEffect(() => {
    adminApi.getHomeHero()
      .then((d: Partial<HomeHeroConfig> | null) => {
        const next = d ? { ...DEFAULT_HOME_HERO, ...d } : DEFAULT_HOME_HERO;
        setConfig(next);
        setSavedSnapshot(JSON.stringify(next));
      })
      .catch(() => setError(lc(lang, "Failed to load home hero config", "முகப்பு பக்க அமைப்பை ஏற்ற முடியவில்லை")))
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(() => JSON.stringify(config) !== savedSnapshot, [config, savedSnapshot]);

  // Register with the surrounding admin shell so that switching sidebar
  // sections, browser back/forward, and reload/close all prompt before
  // discarding unsaved edits.
  useUnsavedChangesGuard(isDirty);

  const set = <K extends keyof HomeHeroConfig>(key: K, value: HomeHeroConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  async function handleSave() {
    const errs = validate(config, lang);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError(lc(lang, "Please fix the errors below before saving.", "சேமிப்பதற்கு முன் கீழே உள்ள பிழைகளை சரிசெய்யவும்."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateHomeHero(config);
      // Refresh the dirty baseline so the unsaved-changes guard clears.
      setSavedSnapshot(JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
          <h2 className="text-xl font-bold">{lc(lang, "Home Page CMS", "முகப்பு பக்க CMS")}</h2>
          <p className="text-sm text-muted-foreground">{lc(lang, "Edit the hero copy, CTA buttons, and section headlines on the public home page. Changes appear in the live preview as you type.", "பொது முகப்பு பக்கத்தின் முதன்மை வாசகம், பொத்தான்கள் மற்றும் பிரிவு தலைப்புகளை திருத்தவும். தட்டச்சு செய்யும்போதே மாற்றங்கள் நேரடி முன்னோட்டத்தில் தோன்றும்.")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            data-testid="home-preview-toggle"
            className="gap-1.5"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? lc(lang, "Hide preview", "முன்னோட்டத்தை மறை") : lc(lang, "Show preview", "முன்னோட்டத்தை காட்டு")}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/" target="_blank" className="gap-1.5">
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
          data-testid="home-unsaved-banner"
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

          {/* Hero badge + headline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{lc(lang, "Hero Section", "முதன்மை பகுதி")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Top Badge (EN)", "மேல் பேட்ஜ் (ஆங்கிலம்)")}</Label>
                  <Input value={config.badge} onChange={(e) => set("badge", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Top Badge (TA)", "மேல் பேட்ஜ் (தமிழ்)")}</Label>
                  <Input value={config.badgeTa} onChange={(e) => set("badgeTa", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Headline (EN) *", "தலைப்பு (ஆங்கிலம்) *")}</Label>
                  <Input value={config.headline} onChange={(e) => set("headline", e.target.value)} className={`mt-1 text-sm ${errClass("headline")}`} />
                  {errMsg("headline")}
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Headline (TA)", "தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.headlineTa} onChange={(e) => set("headlineTa", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Sub-headline (EN) *", "துணை தலைப்பு (ஆங்கிலம்) *")}</Label>
                  <Input value={config.subheadline} onChange={(e) => set("subheadline", e.target.value)} className={`mt-1 text-sm ${errClass("subheadline")}`} />
                  {errMsg("subheadline")}
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Sub-headline (TA)", "துணை தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.subheadlineTa} onChange={(e) => set("subheadlineTa", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Description (EN) *", "விவரம் (ஆங்கிலம்) *")}</Label>
                <Textarea value={config.description} onChange={(e) => set("description", e.target.value)} rows={2} className={`mt-1 text-sm ${errClass("description")}`} />
                {errMsg("description")}
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Description (TA)", "விவரம் (தமிழ்)")}</Label>
                <Textarea value={config.descriptionTa} onChange={(e) => set("descriptionTa", e.target.value)} rows={2} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Leader Photo URL", "தலைவர் புகைப்பட URL")}</Label>
                <Input value={config.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://… or /uploads/…" className={`mt-1 text-sm ${errClass("photoUrl")}`} />
                {errMsg("photoUrl")}
              </div>
            </CardContent>
          </Card>

          {/* CTA buttons */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{lc(lang, "Hero Call-to-Action Buttons", "முதன்மை செயல் அழைப்பு பொத்தான்கள்")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Primary Label (EN) *", "முதன்மை தலைப்பு (ஆங்கிலம்) *")}</Label>
                  <Input value={config.primaryCtaLabel} onChange={(e) => set("primaryCtaLabel", e.target.value)} className={`mt-1 text-sm ${errClass("primaryCtaLabel")}`} />
                  {errMsg("primaryCtaLabel")}
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Primary Label (TA)", "முதன்மை தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.primaryCtaLabelTa} onChange={(e) => set("primaryCtaLabelTa", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Link *", "இணைப்பு *")}</Label>
                  <Input value={config.primaryCtaHref} onChange={(e) => set("primaryCtaHref", e.target.value)} placeholder="/grievance" className={`mt-1 text-sm ${errClass("primaryCtaHref")}`} />
                  {errMsg("primaryCtaHref")}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Secondary Label (EN) *", "இரண்டாம் தலைப்பு (ஆங்கிலம்) *")}</Label>
                  <Input value={config.secondaryCtaLabel} onChange={(e) => set("secondaryCtaLabel", e.target.value)} className={`mt-1 text-sm ${errClass("secondaryCtaLabel")}`} />
                  {errMsg("secondaryCtaLabel")}
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Secondary Label (TA)", "இரண்டாம் தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.secondaryCtaLabelTa} onChange={(e) => set("secondaryCtaLabelTa", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Link *", "இணைப்பு *")}</Label>
                  <Input value={config.secondaryCtaHref} onChange={(e) => set("secondaryCtaHref", e.target.value)} placeholder="/volunteer" className={`mt-1 text-sm ${errClass("secondaryCtaHref")}`} />
                  {errMsg("secondaryCtaHref")}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats section copy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{lc(lang, "Stats Section Copy", "புள்ளிவிவர பகுதி வாசகம்")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Headline (EN)", "தலைப்பு (ஆங்கிலம்)")}</Label>
                  <Input value={config.statsHeadline} onChange={(e) => set("statsHeadline", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Headline (TA)", "தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.statsHeadlineTa} onChange={(e) => set("statsHeadlineTa", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Sub-headline (EN)", "துணை தலைப்பு (ஆங்கிலம்)")}</Label>
                  <Input value={config.statsSubheadline} onChange={(e) => set("statsSubheadline", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Sub-headline (TA)", "துணை தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.statsSubheadlineTa} onChange={(e) => set("statsSubheadlineTa", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{lc(lang, "Edit the underlying numbers in", "அடிப்படை எண்களை இங்கே திருத்தவும்:")} <strong>{lc(lang, "Constituency & Wards → Development Statistics", "தொகுதி & வட்டாரங்கள் → வளர்ச்சி புள்ளிவிவரம்")}</strong>.</p>
            </CardContent>
          </Card>

          {/* Grievance CTA */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{lc(lang, "Grievance Call-to-Action Block", "புகார் செயல் அழைப்பு தொகுதி")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Title (EN)", "தலைப்பு (ஆங்கிலம்)")}</Label>
                  <Input value={config.grievanceCtaTitle} onChange={(e) => set("grievanceCtaTitle", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Title (TA)", "தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.grievanceCtaTitleTa} onChange={(e) => set("grievanceCtaTitleTa", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Body (EN)", "உள்ளடக்கம் (ஆங்கிலம்)")}</Label>
                <Textarea value={config.grievanceCtaBody} onChange={(e) => set("grievanceCtaBody", e.target.value)} rows={2} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Body (TA)", "உள்ளடக்கம் (தமிழ்)")}</Label>
                <Textarea value={config.grievanceCtaBodyTa} onChange={(e) => set("grievanceCtaBodyTa", e.target.value)} rows={2} className="mt-1 text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Volunteer CTA */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{lc(lang, "Volunteer Call-to-Action Block", "தன்னார்வலர் செயல் அழைப்பு தொகுதி")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lc(lang, "Title (EN)", "தலைப்பு (ஆங்கிலம்)")}</Label>
                  <Input value={config.volunteerCtaTitle} onChange={(e) => set("volunteerCtaTitle", e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{lc(lang, "Title (TA)", "தலைப்பு (தமிழ்)")}</Label>
                  <Input value={config.volunteerCtaTitleTa} onChange={(e) => set("volunteerCtaTitleTa", e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Body (EN)", "உள்ளடக்கம் (ஆங்கிலம்)")}</Label>
                <Textarea value={config.volunteerCtaBody} onChange={(e) => set("volunteerCtaBody", e.target.value)} rows={2} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{lc(lang, "Body (TA)", "உள்ளடக்கம் (தமிழ்)")}</Label>
                <Textarea value={config.volunteerCtaBodyTa} onChange={(e) => set("volunteerCtaBodyTa", e.target.value)} rows={2} className="mt-1 text-sm" />
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
          <div className="xl:sticky xl:top-4 self-start" data-testid="home-preview-panel">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 bg-muted/40 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" /> {lc(lang, "Live preview", "நேரடி முன்னோட்டம்")}
                </CardTitle>
                <div className="flex gap-1 rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewLang("en")}
                    data-testid="home-preview-lang-en"
                    className={`px-2 py-0.5 text-xs rounded ${previewLang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLang("ta")}
                    data-testid="home-preview-lang-ta"
                    className={`px-2 py-0.5 text-xs rounded ${previewLang === "ta" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    தமிழ்
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[calc(100vh-12rem)] overflow-y-auto bg-background">
                <div className="origin-top-left scale-[0.7] w-[143%]">
                  <HomeView
                    config={config}
                    lang={previewLang}
                    summary={SAMPLE_SUMMARY}
                    stats={SAMPLE_STATS}
                    featuredNews={SAMPLE_NEWS}
                    upcomingEvents={SAMPLE_EVENTS}
                    recentActivities={SAMPLE_ACTIVITIES}
                    gallery={{ items: [] }}
                    embedded
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
