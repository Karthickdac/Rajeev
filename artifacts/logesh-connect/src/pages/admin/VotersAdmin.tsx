import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useWards } from "@/lib/useWards";
import { getToken } from "@/lib/auth";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, Search, ChevronLeft, ChevronRight, FileText, Tag as TagIcon, Plus, Pencil, Trash2, X, Download, AlertTriangle, Save, Eraser } from "lucide-react";
import type { Language } from "@/lib/i18n";
import { lc } from "@/lib/LeaderConfigContext";
import { useVoterTags, type VoterTag } from "./VoterTagsAdmin";
import HouseholdsTab from "./HouseholdsTab";
import { Home as HomeIcon } from "lucide-react";
import {
  TimelinePanel, ContactLogPanel, RelationsPanel, ContactInfoDisplay,
  BulkAdvancedActions, VotersAdvancedToolbar,
} from "./VotersAdvancedPanels";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

interface VoterRow {
  id: number;
  epicNumber: string;
  fullName: string;
  fullNameTa: string | null;
  age: number | null;
  gender: string | null;
  relationName: string | null;
  partNumber: string | null;
  serialInPart: number | null;
  pollingStationId: number | null;
  boothName: string | null;
  boothNo: string | null;
}

interface VoterDetail extends VoterRow {
  relationType: string | null;
  relationNameTa: string | null;
  houseNumber: string | null;
  addressLine: string | null;
  wardId: number | null;
  sourceImportId: number | null;
  sourcePdf: string | null;
  sourcePage: number | null;
  householdId: number | null;
  phone: string | null;
  whatsappOptIn: boolean;
  email: string | null;
  altContact: string | null;
  createdAt: string;
  updatedAt: string;
  tags: VoterTag[];
}

interface VoterNote {
  id: number;
  voterId: number;
  body: string;
  authorId: number | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchResponse {
  items: VoterRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface BoothOption { id: number; boothNo: string; name: string }

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const tok = getToken();
  const r = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (r.status === 404) throw new Error("not_found");
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

async function fetchBooths(wardId: number): Promise<BoothOption[]> {
  const r = await fetch(`${BASE}/api/wards/${wardId}/polling-stations`);
  return r.ok ? (r.json() as Promise<BoothOption[]>) : [];
}

interface VotersAdminProps { lang?: Language }

export default function VotersAdmin({ lang = "ta" }: VotersAdminProps) {
  const { data: wards = [] } = useWards();
  const { data: me } = useGetMe();
  // Source PDF endpoint (/admin/voters/imports/:id) is super_admin-only;
  // hide the link for everyone else to avoid a confusing 403.
  const canViewSourcePdf = me?.role === "super_admin";
  const isAdminRole = me?.role === "super_admin" || me?.role === "admin";
  const isSuperAdmin = me?.role === "super_admin";
  const { data: tagCatalog } = useVoterTags();
  const allTags = useMemo(() => tagCatalog?.items ?? [], [tagCatalog]);

  // Bilingual display toggle (defaults to incoming admin lang).
  const [displayLang, setDisplayLang] = useState<Language>(lang);
  useEffect(() => { setDisplayLang(lang); }, [lang]);

  // Filter inputs (uncommitted)
  const [qInput, setQInput] = useState("");
  const [wardInput, setWardInput] = useState("all");
  const [boothInput, setBoothInput] = useState("all");
  const [genderInput, setGenderInput] = useState("all");
  const [minAgeInput, setMinAgeInput] = useState("");
  const [maxAgeInput, setMaxAgeInput] = useState("");
  const [tagFilterIds, setTagFilterIds] = useState<number[]>([]);

  // Reset booth when ward changes (booth list is ward-scoped).
  useEffect(() => { setBoothInput("all"); }, [wardInput]);

  const wardForBooths = wardInput !== "all" ? parseInt(wardInput, 10) : null;
  const { data: boothOpts = [] } = useQuery({
    queryKey: ["voter-booth-opts", wardForBooths],
    queryFn: () => (wardForBooths ? fetchBooths(wardForBooths) : Promise.resolve([])),
    enabled: !!wardForBooths,
    staleTime: 5 * 60_000,
  });

  // Committed filter values that drive the query.
  const [filters, setFilters] = useState<{
    q: string; wardId: string; boothId: string; gender: string;
    minAge: string; maxAge: string; tagIds: number[];
  }>({
    q: "", wardId: "all", boothId: "all", gender: "all", minAge: "", maxAge: "", tagIds: [],
  });
  const [page, setPage] = useState(1);
  const limit = 25;

  function applyFilters() {
    setPage(1);
    setFilters({
      q: qInput.trim(),
      wardId: wardInput,
      boothId: boothInput,
      gender: genderInput,
      minAge: minAgeInput,
      maxAge: maxAgeInput,
      tagIds: [...tagFilterIds],
    });
  }
  function clearFilters() {
    setQInput(""); setWardInput("all"); setBoothInput("all");
    setGenderInput("all"); setMinAgeInput(""); setMaxAgeInput("");
    setTagFilterIds([]);
    setFilters({ q: "", wardId: "all", boothId: "all", gender: "all", minAge: "", maxAge: "", tagIds: [] });
    setPage(1);
  }

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.wardId !== "all") p.set("wardId", filters.wardId);
    if (filters.boothId !== "all") p.set("boothId", filters.boothId);
    if (filters.gender !== "all") p.set("gender", filters.gender);
    if (filters.minAge) p.set("minAge", filters.minAge);
    if (filters.maxAge) p.set("maxAge", filters.maxAge);
    if (filters.tagIds.length > 0) p.set("tagIds", filters.tagIds.join(","));
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [filters, page]);

  const { data, isFetching, error } = useQuery<SearchResponse>({
    queryKey: ["voter-search", queryString],
    queryFn: () => authJson<SearchResponse>(`/admin/voters?${queryString}`),
    staleTime: 30_000,
  });

  // Detail panel
  const [detailId, setDetailId] = useState<number | null>(null);
  // Tab + deep-link state. Voters can pivot to Households via the
  // "View household" link inside the voter detail; that path stashes
  // the household id in sessionStorage and switches the active tab.
  const [activeTab, setActiveTab] = useState<"voters" | "households">("voters");
  const [pendingHouseholdId, setPendingHouseholdId] = useState<number | null>(null);

  // Bulk selection — Set of voter ids selected across pages. Persists
  // until the operator clears it or runs an action. We deliberately
  // keep selections cross-page so an operator can curate, then act.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  // Inline edit + delete state for the detail sheet.
  const [editingDetail, setEditingDetail] = useState(false);
  const qcMain = useQueryClient();
  // Deep-link from GrievanceOfficer: clicking a linked-voter chip
  // stashes the voter id in sessionStorage and navigates here.
  useEffect(() => {
    const pending = sessionStorage.getItem("openVoterId");
    if (pending) {
      sessionStorage.removeItem("openVoterId");
      const vid = parseInt(pending, 10);
      if (Number.isFinite(vid) && vid > 0) {
        setActiveTab("voters");
        setDetailId(vid);
      }
    }
    const pendingHh = sessionStorage.getItem("openHouseholdId");
    if (pendingHh) {
      sessionStorage.removeItem("openHouseholdId");
      const hid = parseInt(pendingHh, 10);
      if (Number.isFinite(hid) && hid > 0) {
        setActiveTab("households");
        setPendingHouseholdId(hid);
      }
    }
  }, []);
  const { data: detail, isFetching: detailLoading, error: detailError } = useQuery<VoterDetail>({
    queryKey: ["voter-detail", detailId],
    queryFn: () => authJson<VoterDetail>(`/admin/voters/${detailId}`),
    enabled: detailId != null,
    staleTime: 30_000,
    retry: false,
  });

  const wardNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const w of wards) m.set(w.id, w.name);
    return m;
  }, [wards]);

  useEffect(() => { setPage(1); }, [filters]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function pickName(en: string, ta: string | null): string {
    if (displayLang === "ta" && ta) return ta;
    return en;
  }
  function pickSubName(en: string, ta: string | null): string | null {
    if (displayLang === "ta" && ta) return en; // show EN as subtitle when TA primary
    if (displayLang === "en" && ta) return ta;
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{lc(displayLang, "Voters", "வாக்காளர்கள்")}</h2>
          <p className="text-sm text-muted-foreground">
            {lc(displayLang,
              "Search the electoral roll within your assigned wards. Officers see only voters in their area; admins see all. Every search and detail view is audited.",
              "உங்களுக்கு ஒதுக்கப்பட்ட வட்டாரங்களில் உள்ள வாக்காளர் பட்டியலில் தேடுங்கள். அலுவலர்கள் தங்கள் பகுதியில் உள்ள வாக்காளர்களை மட்டுமே காண்பர்; நிர்வாகிகள் அனைவரையும் காண்பர். ஒவ்வொரு தேடலும் விவரக் காட்சியும் தணிக்கை செய்யப்படுகிறது.")}
          </p>
        </div>
        {isSuperAdmin && (
          <VotersAdvancedToolbar
            onJumpToVoter={(id) => { setActiveTab("voters"); setDetailId(id); }}
            currentFilter={(() => {
              // Sanitize: drop "all"/empty values + cast numerics so the
              // backend voterFilterSchema (strict) accepts the payload.
              const out: Record<string, unknown> = {};
              if (filters.q.trim()) out.q = filters.q.trim();
              if (filters.wardId !== "all") out.wardId = parseInt(filters.wardId, 10);
              if (filters.boothId !== "all") out.boothId = parseInt(filters.boothId, 10);
              if (filters.gender !== "all") out.gender = filters.gender;
              if (filters.minAge) out.minAge = parseInt(filters.minAge, 10);
              if (filters.maxAge) out.maxAge = parseInt(filters.maxAge, 10);
              if (filters.tagIds.length > 0) out.tagIds = filters.tagIds;
              return out;
            })()}
          />
        )}
        {/* EN/TA presentation toggle (mirrors AboutAdmin pattern) */}
        <div className="flex gap-1 rounded-md border bg-background p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setDisplayLang("en")}
            data-testid="voters-lang-en"
            className={`px-2.5 py-1 text-xs rounded ${displayLang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setDisplayLang("ta")}
            data-testid="voters-lang-ta"
            className={`px-2.5 py-1 text-xs rounded ${displayLang === "ta" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            தமிழ்
          </button>
        </div>
      </div>

      {/* Tabs: Voters / Households */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("voters")}
          data-testid="tab-voters"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "voters" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Search className="w-3.5 h-3.5 inline mr-1.5" />
          {lc(displayLang, "Voters", "வாக்காளர்கள்")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("households")}
          data-testid="tab-households"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "households" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <HomeIcon className="w-3.5 h-3.5 inline mr-1.5" />
          {lc(displayLang, "Households", "குடும்பங்கள்")}
        </button>
      </div>

      {activeTab === "households" && (
        <HouseholdsTab
          lang={displayLang}
          initialOpenId={pendingHouseholdId}
          onInitialOpenConsumed={() => setPendingHouseholdId(null)}
        />
      )}

      {activeTab === "voters" && <>
      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[260px]">
              <label className="text-xs font-medium block mb-1">{lc(displayLang, "Search", "தேடு")}</label>
              <Search className="w-4 h-4 absolute left-2 top-[30px] text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder={lc(displayLang, "Name (EN/TA) or EPIC number…", "பெயர் (ஆங்கிலம்/தமிழ்) அல்லது EPIC எண்…")}
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                data-testid="input-voter-search"
              />
            </div>
            <div className="w-44">
              <label className="text-xs font-medium block mb-1">{lc(displayLang, "Ward", "வட்டாரம்")}</label>
              <Select value={wardInput} onValueChange={setWardInput}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-voter-ward"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lc(displayLang, "All wards", "அனைத்து வட்டாரங்கள்")}</SelectItem>
                  {wards.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <label className="text-xs font-medium block mb-1">
                {lc(displayLang, "Booth", "வாக்குச்சாவடி")} {wardForBooths == null && <span className="text-muted-foreground/70">{lc(displayLang, "(pick a ward first)", "(முதலில் ஒரு வட்டாரத்தை தேர்ந்தெடுக்கவும்)")}</span>}
              </label>
              <Select value={boothInput} onValueChange={setBoothInput} disabled={!wardForBooths}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-voter-booth"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lc(displayLang, "All booths", "அனைத்து வாக்குச்சாவடிகள்")}</SelectItem>
                  {boothOpts.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>#{b.boothNo} — {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-xs font-medium block mb-1">{lc(displayLang, "Gender", "பாலினம்")}</label>
              <Select value={genderInput} onValueChange={setGenderInput}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lc(displayLang, "Any", "அனைத்தும்")}</SelectItem>
                  <SelectItem value="M">{lc(displayLang, "Male", "ஆண்")}</SelectItem>
                  <SelectItem value="F">{lc(displayLang, "Female", "பெண்")}</SelectItem>
                  <SelectItem value="O">{lc(displayLang, "Other", "மற்றவை")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <label className="text-xs font-medium block mb-1">{lc(displayLang, "Min age", "குறைந்தபட்ச வயது")}</label>
              <Input
                className="h-9 text-sm" type="number" min={0} max={150}
                value={minAgeInput}
                onChange={(e) => setMinAgeInput(e.target.value)}
              />
            </div>
            <div className="w-24">
              <label className="text-xs font-medium block mb-1">{lc(displayLang, "Max age", "அதிகபட்ச வயது")}</label>
              <Input
                className="h-9 text-sm" type="number" min={0} max={150}
                value={maxAgeInput}
                onChange={(e) => setMaxAgeInput(e.target.value)}
              />
            </div>
            {/* Tag filter (multi-select via popover) */}
            <div className="min-w-[200px]">
              <label className="text-xs font-medium block mb-1">{lc(displayLang, "Tags", "குறிச்சொற்கள்")}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs justify-start font-normal w-full" data-testid="button-voter-tag-filter">
                    <TagIcon className="w-3.5 h-3.5 mr-1.5" />
                    {tagFilterIds.length === 0
                      ? lc(displayLang, "Any tag", "ஏதேனும் குறிச்சொல்")
                      : `${tagFilterIds.length} ${lc(displayLang, `tag${tagFilterIds.length === 1 ? "" : "s"} selected`, "குறிச்சொற்கள் தேர்ந்தெடுக்கப்பட்டன")}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="text-xs text-muted-foreground mb-2 px-1">{lc(displayLang, "Show voters with any of:", "இவற்றில் ஏதேனும் கொண்ட வாக்காளர்களைக் காட்டு:")}</div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {allTags.length === 0 && (
                      <div className="text-xs text-muted-foreground px-2 py-3 text-center">{lc(displayLang, "No tags defined yet.", "இன்னும் குறிச்சொற்கள் வரையறுக்கப்படவில்லை.")}</div>
                    )}
                    {allTags.map(t => {
                      const checked = tagFilterIds.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setTagFilterIds(prev => e.target.checked
                                ? Array.from(new Set([...prev, t.id]))
                                : prev.filter(id => id !== t.id));
                            }}
                          />
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="truncate">{displayLang === "ta" && t.nameTa ? t.nameTa : t.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {tagFilterIds.length > 0 && (
                    <button
                      type="button"
                      className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-1 border-t"
                      onClick={() => setTagFilterIds([])}
                    >
                      {lc(displayLang, "Clear tag filter", "குறிச்சொல் வடிகட்டியை அழி")}
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="ghost" className="h-9" onClick={clearFilters}>{lc(displayLang, "Clear", "அழி")}</Button>
              <Button size="sm" className="h-9 bg-primary text-white hover:bg-primary/90" onClick={applyFilters} data-testid="button-voter-search">
                <Search className="w-4 h-4 mr-1" /> {lc(displayLang, "Search", "தேடு")}
              </Button>
            </div>
          </div>
          <ExportBar filters={filters} total={total} displayLang={displayLang} />
          {isSuperAdmin && (
            <div className="flex items-center gap-2 border-t pt-3 flex-wrap">
              <span className="text-xs text-muted-foreground">{lc(displayLang, "Cleanup tools:", "சுத்தம் செய்யும் கருவிகள்:")}</span>
              <Button
                size="sm" variant="outline" className="h-8 text-xs"
                onClick={async () => {
                  try {
                    const r = await authJson<{ count: number; sampleEpics: string[] }>(
                      `/admin/voters/bulk-delete/preview`,
                      { method: "POST", body: JSON.stringify({ filter: { epicPrefix: "OCR-" } }) },
                    );
                    if (r.count === 0) {
                      alert(lc(displayLang, "No surrogate-EPIC voters found. Nothing to clean up.", "மாற்று-EPIC வாக்காளர்கள் எவரும் இல்லை. சுத்தம் செய்ய எதுவும் இல்லை."));
                      return;
                    }
                    const samp = r.sampleEpics.slice(0, 5).join("\n  ");
                    if (!window.confirm(
                      lc(displayLang,
                        `Permanently delete ${r.count.toLocaleString()} voter${r.count === 1 ? "" : "s"} whose EPIC begins with "OCR-"?\n\nSample EPICs:\n  ${samp}\n\nThis also removes their tags and notes. Linked grievances are preserved.`,
                        `EPIC எண் "OCR-" உடன் தொடங்கும் ${r.count.toLocaleString()} வாக்காளர்களை நிரந்தரமாக நீக்கவா?\n\nமாதிரி EPIC-கள்:\n  ${samp}\n\nஇது அவர்களின் குறிச்சொற்கள் மற்றும் குறிப்புகளையும் நீக்கும். தொடர்புடைய புகார்கள் பாதுகாக்கப்படும்.`),
                    )) return;
                    const del = await authJson<{ ok: boolean; deletedCount: number }>(
                      `/admin/voters/bulk-delete`,
                      { method: "POST", body: JSON.stringify({ filter: { epicPrefix: "OCR-" }, confirmCount: r.count }) },
                    );
                    invalidateAllVoterQueries(qcMain);
                    setSelectedIds(new Set());
                    alert(lc(displayLang,
                      `Deleted ${del.deletedCount.toLocaleString()} surrogate-EPIC voters.`,
                      `${del.deletedCount.toLocaleString()} மாற்று-EPIC வாக்காளர்கள் நீக்கப்பட்டனர்.`));
                  } catch (e) {
                    alert(lc(displayLang, `Cleanup failed: ${(e as Error).message}`, `சுத்தம் செய்தல் தோல்வியடைந்தது: ${(e as Error).message}`));
                  }
                }}
                data-testid="button-cleanup-surrogates"
              >
                <Eraser className="w-3.5 h-3.5 mr-1" /> {lc(displayLang, "Delete surrogate-EPIC voters (OCR-…)", "மாற்று-EPIC வாக்காளர்களை நீக்கு (OCR-…)")}
              </Button>
              <span className="text-xs text-muted-foreground italic">
                {lc(displayLang,
                  "Removes voters whose EPIC was synthesized because OCR failed to read it. Use after re-running an import with better OCR.",
                  "OCR படிக்கத் தவறியதால் EPIC எண் செயற்கையாக உருவாக்கப்பட்ட வாக்காளர்களை நீக்குகிறது. சிறந்த OCR உடன் இறக்குமதியை மீண்டும் இயக்கிய பின் பயன்படுத்தவும்.")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk actions bar — visible while any voter row is checked. */}
      {selectedIds.size > 0 && (
        <div
          className="sticky top-2 z-20 mx-1 mb-2 rounded-md border bg-background shadow-md px-4 py-2 flex items-center gap-3 text-sm"
          data-testid="voter-bulk-actions-bar"
        >
          <span className="font-medium">
            {lc(displayLang, `${selectedIds.size.toLocaleString()} selected`, `${selectedIds.size.toLocaleString()} தேர்ந்தெடுக்கப்பட்டது`)}
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            {lc(displayLang, "Clear", "அழி")}
          </Button>
          {isSuperAdmin && (
            <Button
              size="sm" variant="destructive" className="h-7 text-xs ml-auto"
              data-testid="button-bulk-delete-selected"
              onClick={async () => {
                const ids = Array.from(selectedIds);
                if (!window.confirm(lc(displayLang,
                  `Permanently delete ${ids.length} voter${ids.length === 1 ? "" : "s"}? This also removes their tags and notes.`,
                  `${ids.length} வாக்காளர்களை நிரந்தரமாக நீக்கவா? இது அவர்களின் குறிச்சொற்கள் மற்றும் குறிப்புகளையும் நீக்கும்.`))) return;
                try {
                  const r = await authJson<{ ok: boolean; deletedCount: number }>(
                    `/admin/voters/bulk-delete`,
                    { method: "POST", body: JSON.stringify({ voterIds: ids }) },
                  );
                  setSelectedIds(new Set());
                  invalidateAllVoterQueries(qcMain);
                  alert(lc(displayLang, `Deleted ${r.deletedCount} voters.`, `${r.deletedCount} வாக்காளர்கள் நீக்கப்பட்டனர்.`));
                } catch (e) {
                  alert(lc(displayLang, `Bulk delete failed: ${(e as Error).message}`, `மொத்த நீக்கம் தோல்வியடைந்தது: ${(e as Error).message}`));
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> {lc(displayLang, "Delete", "நீக்கு")} {selectedIds.size}
            </Button>
          )}
          {isSuperAdmin && (
            <BulkAdvancedActions
              selectedIds={Array.from(selectedIds)}
              allTags={allTags}
              onDone={() => { setSelectedIds(new Set()); invalidateAllVoterQueries(qcMain); }}
            />
          )}
        </div>
      )}

      {/* Results table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {isFetching ? lc(displayLang, "Loading…", "ஏற்றுகிறது…") : (
                error ? <span className="text-destructive">{lc(displayLang, "Error", "பிழை")}: {(error as Error).message}</span>
                : lc(displayLang,
                    `${total.toLocaleString()} voter${total === 1 ? "" : "s"} matched`,
                    `${total.toLocaleString()} வாக்காளர்கள் பொருந்தினர்`)
              )}
            </span>
            {total > 0 && <span>{lc(displayLang, `Page ${page} of ${totalPages}`, `பக்கம் ${page} / ${totalPages}`)}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {isSuperAdmin && (
                    <th className="text-left pl-4 pr-1 py-2 w-8">
                      <input
                        type="checkbox"
                        aria-label={lc(displayLang, "Select all on this page", "இந்தப் பக்கத்தில் அனைத்தையும் தேர்ந்தெடு")}
                        data-testid="checkbox-select-all-page"
                        checked={items.length > 0 && items.every((v) => selectedIds.has(v.id))}
                        ref={(el) => {
                          if (!el) return;
                          const sel = items.filter((v) => selectedIds.has(v.id)).length;
                          el.indeterminate = sel > 0 && sel < items.length;
                        }}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) items.forEach((v) => next.add(v.id));
                            else items.forEach((v) => next.delete(v.id));
                            return next;
                          });
                        }}
                      />
                    </th>
                  )}
                  {[
                    ["Name", lc(displayLang, "Name", "பெயர்")],
                    ["EPIC", "EPIC"],
                    ["Age", lc(displayLang, "Age", "வயது")],
                    ["Gender", lc(displayLang, "Gender", "பாலினம்")],
                    ["Booth", lc(displayLang, "Booth", "வாக்குச்சாவடி")],
                    ["Part / Sl.", lc(displayLang, "Part / Sl.", "பகுதி / வரிசை")],
                    ["actions", ""],
                  ].map(([key, label]) => (
                    <th key={key} className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(v => (
                  <tr key={v.id} className={`hover:bg-muted/20 ${selectedIds.has(v.id) ? "bg-primary/5" : ""}`}>
                    {isSuperAdmin && (
                      <td className="pl-4 pr-1 py-2 w-8">
                        <input
                          type="checkbox"
                          aria-label={lc(displayLang, `Select voter ${v.epicNumber}`, `வாக்காளர் ${v.epicNumber} ஐ தேர்ந்தெடு`)}
                          data-testid={`checkbox-select-voter-${v.id}`}
                          checked={selectedIds.has(v.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(v.id); else next.delete(v.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <div className="font-medium">{pickName(v.fullName, v.fullNameTa)}</div>
                      {pickSubName(v.fullName, v.fullNameTa) && (
                        <div className="text-xs text-muted-foreground">{pickSubName(v.fullName, v.fullNameTa)}</div>
                      )}
                      {v.relationName && <div className="text-xs text-muted-foreground">{lc(displayLang, "c/o", "பராமரிப்பில்")} {v.relationName}</div>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{v.epicNumber}</td>
                    <td className="px-4 py-2">{v.age ?? "—"}</td>
                    <td className="px-4 py-2">
                      {v.gender ? <Badge variant="outline" className="text-xs">{v.gender}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {v.boothNo ? (
                        <span className="text-xs">#{v.boothNo} {v.boothName ?? ""}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {v.partNumber ? `${v.partNumber}${v.serialInPart ? ` / ${v.serialInPart}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetailId(v.id)} data-testid={`button-view-voter-${v.id}`}>
                        {lc(displayLang, "View", "பார்")}
                      </Button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !isFetching && (
                  <tr><td colSpan={isSuperAdmin ? 8 : 7} className="text-center text-muted-foreground py-12">
                    {lc(displayLang, "No voters match your filters.", "உங்கள் வடிகட்டிகளுக்கு பொருந்தும் வாக்காளர்கள் இல்லை.")}
                  </td></tr>
                )}
                {isFetching && items.length === 0 && (
                  <tr><td colSpan={isSuperAdmin ? 8 : 7} className="text-center text-muted-foreground py-12">
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="px-4 py-2 border-t flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" className="h-8" disabled={page <= 1 || isFetching} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" /> {lc(displayLang, "Prev", "முந்தைய")}
              </Button>
              <Button size="sm" variant="outline" className="h-8" disabled={!data?.hasMore || isFetching} onClick={() => setPage(p => p + 1)}>
                {lc(displayLang, "Next", "அடுத்த")} <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail slide-over */}
      <Sheet open={detailId != null} onOpenChange={(o) => { if (!o) { setDetailId(null); setEditingDetail(false); } }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto" data-testid="voter-detail-sheet">
          <SheetHeader>
            <SheetTitle>{detail ? pickName(detail.fullName, detail.fullNameTa) : (detailLoading ? lc(displayLang, "Loading…", "ஏற்றுகிறது…") : lc(displayLang, "Voter", "வாக்காளர்"))}</SheetTitle>
            {detail && pickSubName(detail.fullName, detail.fullNameTa) && (
              <SheetDescription>{pickSubName(detail.fullName, detail.fullNameTa)}</SheetDescription>
            )}
          </SheetHeader>
          {detailError && (
            <div className="mt-4 text-sm text-destructive">
              {(detailError as Error).message === "not_found"
                ? lc(displayLang, "This voter is not available (it may be outside your assigned area).", "இந்த வாக்காளர் கிடைக்கவில்லை (உங்களுக்கு ஒதுக்கப்பட்ட பகுதிக்கு வெளியே இருக்கலாம்).")
                : (detailError as Error).message}
            </div>
          )}
          {detail && isSuperAdmin && !editingDetail && (
            <div className="mt-3 flex items-center gap-2 border-b pb-3" data-testid="voter-detail-actions">
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setEditingDetail(true)}
                data-testid="button-edit-voter"
              >
                <Pencil className="w-3 h-3 mr-1" /> {lc(displayLang, "Edit", "திருத்து")}
              </Button>
              <Button
                size="sm" variant="destructive" className="h-7 text-xs"
                data-testid="button-delete-voter"
                onClick={async () => {
                  if (!window.confirm(
                    lc(displayLang,
                      `Permanently delete voter ${detail.epicNumber} (${detail.fullName})?\n\nThis also removes their tags and notes. Linked grievances are preserved.`,
                      `வாக்காளர் ${detail.epicNumber} (${detail.fullName}) ஐ நிரந்தரமாக நீக்கவா?\n\nஇது அவர்களின் குறிச்சொற்கள் மற்றும் குறிப்புகளையும் நீக்கும். தொடர்புடைய புகார்கள் பாதுகாக்கப்படும்.`),
                  )) return;
                  try {
                    await authJson<{ ok: boolean }>(`/admin/voters/${detail.id}`, { method: "DELETE" });
                    invalidateAllVoterQueries(qcMain);
                    setDetailId(null);
                  } catch (e) {
                    alert(lc(displayLang, `Delete failed: ${(e as Error).message}`, `நீக்குதல் தோல்வியடைந்தது: ${(e as Error).message}`));
                  }
                }}
              >
                <Trash2 className="w-3 h-3 mr-1" /> {lc(displayLang, "Delete", "நீக்கு")}
              </Button>
            </div>
          )}
          {detail && editingDetail && (
            <EditVoterForm
              voter={detail}
              displayLang={displayLang}
              onCancel={() => setEditingDetail(false)}
              onSaved={() => {
                setEditingDetail(false);
                invalidateAllVoterQueries(qcMain);
              }}
            />
          )}
          {detail && !editingDetail && (
            <div className="mt-4 space-y-4 text-sm">
              <Field label="EPIC">{detail.epicNumber}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={lc(displayLang, "Age", "வயது")}>{detail.age ?? "—"}</Field>
                <Field label={lc(displayLang, "Gender", "பாலினம்")}>{detail.gender ?? "—"}</Field>
              </div>
              {(detail.relationName || detail.relationType) && (
                <Field label={detail.relationType ? lc(displayLang, `${capitalize(detail.relationType)} name`, `${capitalize(detail.relationType)} பெயர்`) : lc(displayLang, "Relation", "உறவு")}>
                  {pickName(detail.relationName ?? "—", detail.relationNameTa)}
                  {pickSubName(detail.relationName ?? "", detail.relationNameTa) && (
                    <span className="block text-xs text-muted-foreground">{pickSubName(detail.relationName ?? "", detail.relationNameTa)}</span>
                  )}
                </Field>
              )}
              {(detail.houseNumber || detail.addressLine) && (
                <Field label={lc(displayLang, "Address", "முகவரி")}>
                  {detail.houseNumber && <div>{detail.houseNumber}</div>}
                  {detail.addressLine && <div className="text-muted-foreground">{detail.addressLine}</div>}
                </Field>
              )}
              <Field label={lc(displayLang, "Ward", "வட்டாரம்")}>
                {detail.wardId != null
                  ? (wardNameById.get(detail.wardId) ?? lc(displayLang, `Ward #${detail.wardId}`, `வட்டாரம் #${detail.wardId}`))
                  : "—"}
              </Field>
              <Field label={lc(displayLang, "Booth", "வாக்குச்சாவடி")}>
                {detail.boothNo
                  ? <>#{detail.boothNo} {detail.boothName ?? ""}</>
                  : lc(displayLang, "Unassigned", "ஒதுக்கப்படவில்லை")}
                {detail.partNumber && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    {lc(displayLang, "Part", "பகுதி")} {detail.partNumber}{detail.serialInPart ? ` · ${lc(displayLang, "Sl.", "வரிசை")} ${detail.serialInPart}` : ""}
                  </span>
                )}
              </Field>
              {detail.sourcePdf && (
                <Field label={lc(displayLang, "Source PDF", "மூல PDF")}>
                  {canViewSourcePdf && detail.sourceImportId != null ? (
                    <a
                      href={`${BASE}/api/admin/voters/imports/${detail.sourceImportId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs"
                      data-testid="voter-source-pdf-link"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {detail.sourcePdf}
                      {detail.sourcePage ? <span className="text-muted-foreground">(p.{detail.sourcePage})</span> : null}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="w-3.5 h-3.5" />
                      {detail.sourcePdf}
                      {detail.sourcePage ? ` (p.${detail.sourcePage})` : ""}
                    </span>
                  )}
                </Field>
              )}
              {detail.householdId != null && (
                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{lc(displayLang, "Household", "குடும்பம்")}</div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    data-testid="link-voter-household"
                    onClick={() => {
                      sessionStorage.setItem("openHouseholdId", String(detail.householdId));
                      setActiveTab("households");
                      setPendingHouseholdId(detail.householdId);
                      setDetailId(null);
                    }}
                  >
                    <HomeIcon className="w-3.5 h-3.5" />
                    {lc(displayLang, "View household & members", "குடும்பம் & உறுப்பினர்களைப் பார்")}
                  </button>
                </div>
              )}
              <ContactInfoDisplay
                phone={detail.phone}
                whatsappOptIn={detail.whatsappOptIn}
                email={detail.email}
                altContact={detail.altContact}
              />
              <TagsPanel voterId={detail.id} initialTags={detail.tags} allTags={allTags} displayLang={displayLang} />
              <NotesPanel voterId={detail.id} me={me} isAdminRole={isAdminRole} displayLang={displayLang} />
              <GrievancesPanel voterId={detail.id} displayLang={displayLang} />
              {isSuperAdmin && (
                <>
                  <ContactLogPanel voterId={detail.id} />
                  <RelationsPanel voterId={detail.id} />
                  <div className="border-t pt-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{lc(displayLang, "Activity timeline", "செயல்பாட்டு காலவரிசை")}</div>
                    <TimelinePanel voterId={detail.id} />
                  </div>
                </>
              )}
              <div className="text-xs text-muted-foreground border-t pt-3">
                {lc(displayLang, "Last updated", "கடைசியாக புதுப்பிக்கப்பட்டது")} {new Date(detail.updatedAt).toLocaleString()}
              </div>
            </div>
          )}
          {detailLoading && !detail && (
            <div className="mt-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          )}
        </SheetContent>
      </Sheet>
      </>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// Invalidates every cached query whose key starts with "voter" — this
// covers the actual list (`voter-search`), detail (`voter-detail`),
// per-voter tags/notes/grievances, and the booth options. Used after
// any voter-mutating action (edit / delete / bulk-delete / cleanup) so
// the table and detail panel reflect the new state immediately.
function invalidateAllVoterQueries(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey)
      && typeof q.queryKey[0] === "string"
      && q.queryKey[0].startsWith("voter"),
  });
}

interface VoterGrievanceItem {
  id: number;
  ticketNo: string;
  category: string;
  status: string;
  priority: string;
  ward: string | null;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

function GrievancesPanel({ voterId, displayLang }: { voterId: number; displayLang: Language }) {
  const { data, isLoading, error } = useQuery<{ items: VoterGrievanceItem[] }>({
    queryKey: ["voter-grievances", voterId],
    queryFn: () => authJson<{ items: VoterGrievanceItem[] }>(`/admin/voters/${voterId}/grievances`),
  });
  const items = data?.items ?? [];
  return (
    <div className="border-t pt-3" data-testid="voter-grievances-panel">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {lc(displayLang, "Grievances", "புகார்கள்")} ({items.length})
      </div>
      {isLoading && <div className="text-xs text-muted-foreground">{lc(displayLang, "Loading…", "ஏற்றுகிறது…")}</div>}
      {error && (
        <div className="text-xs text-destructive">
          {(error as Error).message}
        </div>
      )}
      {!isLoading && !error && items.length === 0 && (
        <div className="text-xs text-muted-foreground italic">
          {lc(displayLang, "No grievances linked to this voter yet.", "இந்த வாக்காளருடன் இன்னும் எந்த புகாரும் இணைக்கப்படவில்லை.")}
        </div>
      )}
      <div className="space-y-2">
        {items.map((g) => (
          <button
            type="button"
            key={g.id}
            className="block w-full text-left rounded border bg-muted/20 p-2 text-sm hover:bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer"
            data-testid={`voter-grievance-${g.id}`}
            title={lc(displayLang, "Open grievance", "புகாரைத் திற")}
            onClick={() => {
              // Stash the grievance id and switch the admin shell to the
              // Grievances tab — GrievanceOfficer reads this on mount.
              sessionStorage.setItem("openGrievanceId", String(g.id));
              window.location.hash = "#grievances";
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-primary font-semibold">{g.ticketNo}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(g.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">{g.category}</Badge>
              <Badge variant="outline" className="text-[10px]">{g.status}</Badge>
              <Badge variant="outline" className="text-[10px]">{g.priority}</Badge>
              {g.ward && <span className="text-[10px] text-muted-foreground">· {g.ward}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TagsPanel({
  voterId, initialTags, allTags, displayLang,
}: {
  voterId: number;
  initialTags: VoterTag[];
  allTags: VoterTag[];
  displayLang: Language;
}) {
  const qc = useQueryClient();
  const { data } = useQuery<{ items: VoterTag[] }>({
    queryKey: ["voter-tags", voterId],
    queryFn: () => authJson<{ items: VoterTag[] }>(`/admin/voters/${voterId}/tags`),
    initialData: { items: initialTags },
  });
  const tags = data?.items ?? [];
  const tagIdSet = useMemo(() => new Set(tags.map(t => t.id)), [tags]);

  const save = useMutation({
    mutationFn: async (ids: number[]) => {
      return authJson<{ items: VoterTag[] }>(
        `/admin/voters/${voterId}/tags`,
        { method: "PUT", body: JSON.stringify({ tagIds: ids }) },
      );
    },
    onSuccess: (resp) => {
      qc.setQueryData(["voter-tags", voterId], resp);
      qc.invalidateQueries({ queryKey: ["voter-detail", voterId] });
    },
  });

  function toggle(id: number) {
    const next = tagIdSet.has(id)
      ? tags.filter(t => t.id !== id).map(t => t.id)
      : [...tags.map(t => t.id), id];
    save.mutate(next);
  }

  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Tags", "குறிச்சொற்கள்")}</div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" data-testid="button-add-voter-tag">
              <Plus className="w-3 h-3 mr-1" /> {lc(displayLang, "Edit", "திருத்து")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="text-xs text-muted-foreground mb-2 px-1">{lc(displayLang, "Toggle tags:", "குறிச்சொற்களை மாற்று:")}</div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {allTags.length === 0 && (
                <div className="text-xs text-muted-foreground p-2 text-center">{lc(displayLang, "No tags defined.", "குறிச்சொற்கள் வரையறுக்கப்படவில்லை.")}</div>
              )}
              {allTags.map(t => (
                <label key={t.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer text-sm">
                  <input
                    type="checkbox" checked={tagIdSet.has(t.id)}
                    onChange={() => toggle(t.id)}
                    disabled={save.isPending}
                  />
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="truncate">{displayLang === "ta" && t.nameTa ? t.nameTa : t.name}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground italic">{lc(displayLang, "No tags yet", "இன்னும் குறிச்சொற்கள் இல்லை")}</span>
        )}
        {tags.map(t => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: t.color }}
            data-testid={`voter-tag-chip-${t.id}`}
          >
            {displayLang === "ta" && t.nameTa ? t.nameTa : t.name}
            <button
              type="button"
              className="hover:bg-white/20 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center"
              onClick={() => toggle(t.id)}
              disabled={save.isPending}
              aria-label={lc(displayLang, `Remove ${t.name}`, `${t.name} ஐ அகற்று`)}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      {save.error && (
        <div className="text-xs text-destructive mt-1">{(save.error as Error).message}</div>
      )}
    </div>
  );
}

function NotesPanel({
  voterId, me, isAdminRole, displayLang,
}: {
  voterId: number;
  me: { id: number; role: string } | undefined;
  isAdminRole: boolean;
  displayLang: Language;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: VoterNote[] }>({
    queryKey: ["voter-notes", voterId],
    queryFn: () => authJson<{ items: VoterNote[] }>(`/admin/voters/${voterId}/notes`),
  });
  const notes = data?.items ?? [];
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const create = useMutation({
    mutationFn: (body: string) => authJson<VoterNote>(
      `/admin/voters/${voterId}/notes`,
      { method: "POST", body: JSON.stringify({ body }) },
    ),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["voter-notes", voterId] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => authJson<VoterNote>(
      `/admin/voters/${voterId}/notes/${id}`,
      { method: "PUT", body: JSON.stringify({ body }) },
    ),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["voter-notes", voterId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => authJson<{ ok: boolean }>(
      `/admin/voters/${voterId}/notes/${id}`, { method: "DELETE" },
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voter-notes", voterId] }),
  });

  function canEdit(n: VoterNote): boolean {
    if (isAdminRole) return true;
    return me?.id != null && n.authorId === me.id;
  }

  return (
    <div className="border-t pt-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{lc(displayLang, "Notes", "குறிப்புகள்")}</div>
      <div className="space-y-2 mb-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={lc(displayLang, "Add a private note about this voter…", "இந்த வாக்காளர் பற்றி தனிப்பட்ட குறிப்பைச் சேர்க்கவும்…")}
          rows={2}
          className="text-sm"
          data-testid="textarea-voter-note"
        />
        <div className="flex justify-end">
          <Button
            size="sm" className="h-7 text-xs"
            disabled={!draft.trim() || create.isPending}
            onClick={() => create.mutate(draft.trim())}
            data-testid="button-add-voter-note"
          >
            {create.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {lc(displayLang, "Add note", "குறிப்பைச் சேர்")}
          </Button>
        </div>
        {create.error && (
          <div className="text-xs text-destructive">{(create.error as Error).message}</div>
        )}
      </div>
      {isLoading && <div className="text-xs text-muted-foreground">{lc(displayLang, "Loading notes…", "குறிப்புகள் ஏற்றப்படுகின்றன…")}</div>}
      <div className="space-y-2">
        {notes.length === 0 && !isLoading && (
          <div className="text-xs text-muted-foreground italic">{lc(displayLang, "No notes yet.", "இன்னும் குறிப்புகள் இல்லை.")}</div>
        )}
        {notes.map(n => (
          <div key={n.id} className="rounded border bg-muted/20 p-2 text-sm" data-testid={`voter-note-${n.id}`}>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{n.authorName}</span>
              <span>{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            {editingId === n.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingId(null)}>{lc(displayLang, "Cancel", "ரத்து")}</Button>
                  <Button
                    size="sm" className="h-6 text-xs"
                    disabled={!editingBody.trim() || update.isPending}
                    onClick={() => update.mutate({ id: n.id, body: editingBody.trim() })}
                  >
                    {lc(displayLang, "Save", "சேமி")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="whitespace-pre-wrap break-words">{n.body}</div>
                {canEdit(n) && (
                  <div className="flex justify-end gap-1 mt-1">
                    <Button
                      size="sm" variant="ghost" className="h-6 px-1.5 text-xs"
                      onClick={() => { setEditingId(n.id); setEditingBody(n.body); }}
                      data-testid={`button-edit-voter-note-${n.id}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                      disabled={del.isPending}
                      onClick={() => {
                        if (window.confirm(lc(displayLang, "Delete this note?", "இந்த குறிப்பை நீக்கவா?"))) del.mutate(n.id);
                      }}
                      data-testid={`button-delete-voter-note-${n.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </>
            )}
            {n.updatedAt !== n.createdAt && editingId !== n.id && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {lc(displayLang, "edited", "திருத்தப்பட்டது")} {new Date(n.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export bar (task #47) ────────────────────────────────
// Renders below the filter inputs in the Voters tab. Submits the
// currently-applied filter set to POST /api/admin/voters/export and
// streams the response as a download. Above the server-side row
// threshold the API replies 403 password_required — we surface a
// password prompt and retry once with the same filter payload.
function ExportBar({
  filters,
  total,
  displayLang,
}: {
  filters: { q: string; wardId: string; boothId: string; gender: string; minAge: string; maxAge: string; tagIds: number[] };
  total: number;
  displayLang: Language;
}) {
  const [running, setRunning] = useState<null | "csv" | "xlsx">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pwGate, setPwGate] = useState<null | {
    format: "csv" | "xlsx"; rowCount: number; threshold: number;
  }>(null);
  const [password, setPassword] = useState("");
  // Default: only the columns visible in the table on screen. Toggle
  // ON to include the extra back-end fields (address, household,
  // relation type) — keeps the export honest to "matches on-screen".
  const [allFields, setAllFields] = useState(false);

  // Mirrors VotersAdmin's table columns.
  const VISIBLE_COLS = [
    "fullName", "fullNameTa", "epicNumber", "age", "gender",
    "relationName", "boothNo", "boothName", "partNumber", "serialInPart",
  ];
  const ALL_COLS = [
    ...VISIBLE_COLS,
    "id", "relationType", "houseNumber", "addressLine", "householdLabel",
  ];

  function buildPayload(): Record<string, unknown> {
    const f: Record<string, unknown> = {};
    if (filters.q) f.q = filters.q;
    if (filters.wardId !== "all") f.wardId = parseInt(filters.wardId, 10);
    if (filters.boothId !== "all") f.boothId = parseInt(filters.boothId, 10);
    if (filters.gender !== "all") f.gender = filters.gender;
    if (filters.minAge) f.minAge = parseInt(filters.minAge, 10);
    if (filters.maxAge) f.maxAge = parseInt(filters.maxAge, 10);
    if (filters.tagIds.length > 0) f.tagIds = filters.tagIds;
    return f;
  }

  async function runExport(format: "csv" | "xlsx", pw?: string) {
    setRunning(format);
    setStatus(lc(displayLang, "Preparing export…", "ஏற்றுமதி தயாராகிறது…"));
    setError(null);
    try {
      const tok = getToken();
      const r = await fetch(`${BASE}/api/admin/voters/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({
          format,
          filters: buildPayload(),
          columns: allFields ? ALL_COLS : VISIBLE_COLS,
          ...(pw ? { password: pw } : {}),
        }),
      });
      if (r.status === 403) {
        const body = await r.json().catch(() => ({}));
        if (body.error === "password_required") {
          setRunning(null);
          setStatus(null);
          setPwGate({ format, rowCount: body.rowCount ?? 0, threshold: body.threshold ?? 0 });
          return;
        }
        throw new Error(body.message ?? lc(displayLang, "Forbidden", "அனுமதி மறுக்கப்பட்டது"));
      }
      if (r.status === 401) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message ?? lc(displayLang, "Incorrect password.", "தவறான கடவுச்சொல்."));
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const rows = r.headers.get("X-Voter-Export-Rows") ?? "?";
      setStatus(lc(displayLang, `Streaming ${rows} rows…`, `${rows} வரிசைகள் பதிவிறக்கப்படுகின்றன…`));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const filename = (r.headers.get("Content-Disposition") ?? "")
        .match(/filename="([^"]+)"/)?.[1] ?? `voters.${format}`;
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setStatus(lc(displayLang, `Downloaded ${rows} rows as ${filename}`, `${rows} வரிசைகள் ${filename} ஆக பதிவிறக்கப்பட்டன`));
      setPwGate(null);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
      setStatus(null);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flex items-center gap-2 border-t pt-3 flex-wrap" data-testid="voter-export-bar">
      <span className="text-xs text-muted-foreground mr-1">
        {lc(displayLang,
          `Export current filter (${total.toLocaleString()} match${total === 1 ? "" : "es"}):`,
          `தற்போதைய வடிகட்டியை ஏற்றுமதி செய் (${total.toLocaleString()} பொருத்தம்):`)}
      </span>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allFields}
          onChange={(e) => setAllFields(e.target.checked)}
          data-testid="checkbox-export-all-fields"
        />
        {lc(displayLang, "Include all fields (address, household, relation type)", "அனைத்து புலங்களையும் சேர் (முகவரி, குடும்பம், உறவு வகை)")}
      </label>
      <Button
        size="sm" variant="outline" className="h-8 text-xs"
        disabled={running !== null || total === 0}
        onClick={() => runExport("csv")}
        data-testid="button-export-csv"
      >
        {running === "csv" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
        {lc(displayLang, "Export CSV", "CSV ஏற்றுமதி")}
      </Button>
      <Button
        size="sm" variant="outline" className="h-8 text-xs"
        disabled={running !== null || total === 0}
        onClick={() => runExport("xlsx")}
        data-testid="button-export-xlsx"
      >
        {running === "xlsx" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
        {lc(displayLang, "Export Excel", "Excel ஏற்றுமதி")}
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
      {error && <span className="text-xs text-destructive" data-testid="voter-export-error">{error}</span>}

      {pwGate && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => { if (running === null) { setPwGate(null); setPassword(""); } }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            data-testid="voter-export-password-modal"
          >
            <h3 className="font-semibold text-base">{lc(displayLang, "Confirm large export", "பெரிய ஏற்றுமதியை உறுதிப்படுத்து")}</h3>
            <p className="text-sm text-muted-foreground">
              {displayLang === "ta" ? (
                <><strong>{pwGate.rowCount.toLocaleString()}</strong> வாக்காளர் பதிவுகளை நீங்கள் பதிவிறக்க உள்ளீர்கள், இது {pwGate.threshold.toLocaleString()}-வரிசை வரம்பை விட அதிகம். உறுதிப்படுத்த உங்கள் கணக்கு கடவுச்சொல்லை மீண்டும் உள்ளிடவும்.</>
              ) : (
                <>You're about to download <strong>{pwGate.rowCount.toLocaleString()}</strong> voter records, which is above the {pwGate.threshold.toLocaleString()}-row threshold. Re-enter your account password to confirm.</>
              )}
            </p>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && password) runExport(pwGate.format, password); }}
              placeholder={lc(displayLang, "Your password", "உங்கள் கடவுச்சொல்")}
              data-testid="input-export-password"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost" size="sm"
                disabled={running !== null}
                onClick={() => { setPwGate(null); setPassword(""); }}
              >
                {lc(displayLang, "Cancel", "ரத்து")}
              </Button>
              <Button
                size="sm" className="bg-primary text-white"
                disabled={!password || running !== null}
                onClick={() => runExport(pwGate.format, password)}
                data-testid="button-confirm-export-password"
              >
                {running ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                {lc(displayLang, "Confirm export", "ஏற்றுமதியை உறுதிப்படுத்து")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline voter edit form (super_admin) ─────────────────────────
//
// Reused inside the voter detail Sheet. Displays the editable subset
// of voter columns; on save, PATCHes only the fields that actually
// changed so the audit log delta is meaningful. Booth assignment is
// intentionally NOT editable here — use the Households / bulk
// reassign flows for that, since picking a booth needs a search UI.
interface VoterDetailForEdit {
  phone?: string | null;
  whatsappOptIn?: boolean;
  email?: string | null;
  altContact?: string | null;
  id: number;
  epicNumber: string;
  fullName: string;
  fullNameTa: string | null;
  age: number | null;
  // Schema-level type is `string | null`; we narrow on read.
  gender: string | null;
  relationType: string | null;
  relationName: string | null;
  relationNameTa: string | null;
  houseNumber: string | null;
  addressLine: string | null;
  partNumber: string | null;
  serialInPart: number | null;
}

function EditVoterForm({
  voter, onCancel, onSaved, displayLang,
}: {
  voter: VoterDetailForEdit;
  onCancel: () => void;
  onSaved: () => void;
  displayLang: Language;
}) {
  const [form, setForm] = useState({
    epicNumber: voter.epicNumber ?? "",
    fullName: voter.fullName ?? "",
    fullNameTa: voter.fullNameTa ?? "",
    age: voter.age != null ? String(voter.age) : "",
    gender: ((voter.gender === "M" || voter.gender === "F" || voter.gender === "O")
      ? voter.gender
      : "") as "" | "M" | "F" | "O",
    relationType: (voter.relationType ?? "") as string,
    relationName: voter.relationName ?? "",
    relationNameTa: voter.relationNameTa ?? "",
    houseNumber: voter.houseNumber ?? "",
    addressLine: voter.addressLine ?? "",
    partNumber: voter.partNumber ?? "",
    serialInPart: voter.serialInPart != null ? String(voter.serialInPart) : "",
    phone: voter.phone ?? "",
    whatsappOptIn: voter.whatsappOptIn ?? false,
    email: voter.email ?? "",
    altContact: voter.altContact ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a sparse PATCH body containing ONLY changed fields. We
  // distinguish "" → null (clear) from no-change by comparing against
  // the original voter values normalized the same way.
  function buildPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    const norm = (s: string) => s.trim();
    function diff<T>(field: string, current: T, originalRaw: unknown) {
      const original = originalRaw == null ? "" : String(originalRaw);
      if (typeof current === "string") {
        const c = norm(current);
        if (c !== original) patch[field] = c === "" ? null : c;
      } else if (current !== originalRaw) {
        patch[field] = current;
      }
    }
    diff("epicNumber", form.epicNumber.toUpperCase(), voter.epicNumber);
    if (norm(form.fullName) !== voter.fullName) {
      patch["fullName"] = norm(form.fullName);
    }
    diff("fullNameTa", form.fullNameTa, voter.fullNameTa);
    // Age: empty string clears the field.
    {
      const c = form.age.trim();
      const orig = voter.age != null ? String(voter.age) : "";
      if (c !== orig) patch["age"] = c === "" ? null : Number.parseInt(c, 10);
    }
    {
      const c = form.gender;
      const orig = voter.gender ?? "";
      if (c !== orig) patch["gender"] = c === "" ? null : c;
    }
    {
      const c = form.relationType;
      const orig = voter.relationType ?? "";
      if (c !== orig) patch["relationType"] = c === "" ? null : c;
    }
    diff("relationName", form.relationName, voter.relationName);
    diff("relationNameTa", form.relationNameTa, voter.relationNameTa);
    diff("houseNumber", form.houseNumber, voter.houseNumber);
    diff("addressLine", form.addressLine, voter.addressLine);
    diff("partNumber", form.partNumber, voter.partNumber);
    {
      const c = form.serialInPart.trim();
      const orig = voter.serialInPart != null ? String(voter.serialInPart) : "";
      if (c !== orig) patch["serialInPart"] = c === "" ? null : Number.parseInt(c, 10);
    }
    diff("phone", form.phone, voter.phone);
    diff("email", form.email, voter.email);
    diff("altContact", form.altContact, voter.altContact);
    if (form.whatsappOptIn !== (voter.whatsappOptIn ?? false)) {
      patch["whatsappOptIn"] = form.whatsappOptIn;
    }
    return patch;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    if (!form.fullName.trim()) {
      setError(lc(displayLang, "Name cannot be empty.", "பெயர் காலியாக இருக்கக்கூடாது."));
      return;
    }
    if (!form.epicNumber.trim()) {
      setError(lc(displayLang, "EPIC cannot be empty.", "EPIC காலியாக இருக்கக்கூடாது."));
      return;
    }
    setSaving(true);
    try {
      await authJson(`/admin/voters/${voter.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 text-sm" data-testid="form-edit-voter">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">EPIC</label>
        <Input
          value={form.epicNumber}
          onChange={(e) => setField("epicNumber", e.target.value)}
          className="font-mono uppercase mt-0.5 h-8 text-sm"
          maxLength={40}
          data-testid="input-edit-epic"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Full name", "முழு பெயர்")}</label>
        <Input
          value={form.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
          className="mt-0.5 h-8 text-sm"
          maxLength={200}
          data-testid="input-edit-name"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Full name (Tamil)", "முழு பெயர் (தமிழ்)")}</label>
        <Input
          value={form.fullNameTa}
          onChange={(e) => setField("fullNameTa", e.target.value)}
          className="mt-0.5 h-8 text-sm"
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Age", "வயது")}</label>
          <Input
            type="number" min={0} max={150}
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
            className="mt-0.5 h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Gender", "பாலினம்")}</label>
          <select
            value={form.gender}
            onChange={(e) => setField("gender", e.target.value as typeof form.gender)}
            className="mt-0.5 h-8 w-full rounded-md border bg-background px-2 text-sm"
            data-testid="select-edit-gender"
          >
            <option value="">—</option>
            <option value="M">{lc(displayLang, "Male", "ஆண்")}</option>
            <option value="F">{lc(displayLang, "Female", "பெண்")}</option>
            <option value="O">{lc(displayLang, "Other", "மற்றவை")}</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Relation type", "உறவு வகை")}</label>
          <select
            value={form.relationType}
            onChange={(e) => setField("relationType", e.target.value)}
            className="mt-0.5 h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">—</option>
            <option value="father">{lc(displayLang, "Father", "தந்தை")}</option>
            <option value="mother">{lc(displayLang, "Mother", "தாய்")}</option>
            <option value="husband">{lc(displayLang, "Husband", "கணவர்")}</option>
            <option value="wife">{lc(displayLang, "Wife", "மனைவி")}</option>
            <option value="guardian">{lc(displayLang, "Guardian", "பாதுகாவலர்")}</option>
            <option value="other">{lc(displayLang, "Other", "மற்றவை")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Relation name", "உறவினர் பெயர்")}</label>
          <Input
            value={form.relationName}
            onChange={(e) => setField("relationName", e.target.value)}
            className="mt-0.5 h-8 text-sm"
            maxLength={200}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Relation name (Tamil)", "உறவினர் பெயர் (தமிழ்)")}</label>
        <Input
          value={form.relationNameTa}
          onChange={(e) => setField("relationNameTa", e.target.value)}
          className="mt-0.5 h-8 text-sm"
          maxLength={200}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "House number", "வீட்டு எண்")}</label>
        <Input
          value={form.houseNumber}
          onChange={(e) => setField("houseNumber", e.target.value)}
          className="mt-0.5 h-8 text-sm"
          maxLength={80}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Address line", "முகவரி வரி")}</label>
        <Input
          value={form.addressLine}
          onChange={(e) => setField("addressLine", e.target.value)}
          className="mt-0.5 h-8 text-sm"
          maxLength={500}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Part number", "பகுதி எண்")}</label>
          <Input
            value={form.partNumber}
            onChange={(e) => setField("partNumber", e.target.value)}
            className="mt-0.5 h-8 text-sm"
            maxLength={20}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{lc(displayLang, "Serial in part", "பகுதியில் வரிசை")}</label>
          <Input
            type="number" min={0} max={100000}
            value={form.serialInPart}
            onChange={(e) => setField("serialInPart", e.target.value)}
            className="mt-0.5 h-8 text-sm"
          />
        </div>
      </div>
      <div className="border-t pt-3 mt-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{lc(displayLang, "Contact", "தொடர்பு")}</div>
        <div className="space-y-2">
          <Input
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder={lc(displayLang, "Phone (e.g. +91 9876543210)", "தொலைபேசி (எ.கா. +91 9876543210)")}
            className="h-8 text-sm" maxLength={40}
            data-testid="input-edit-phone"
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.whatsappOptIn}
              onChange={(e) => setField("whatsappOptIn", e.target.checked)}
              data-testid="checkbox-edit-whatsapp"
            /> {lc(displayLang, "WhatsApp opt-in", "வாட்ஸ்அப் ஒப்புதல்")}
          </label>
          <Input
            type="email" value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder={lc(displayLang, "Email", "மின்னஞ்சல்")} className="h-8 text-sm" maxLength={200}
          />
          <Input
            value={form.altContact}
            onChange={(e) => setField("altContact", e.target.value)}
            placeholder={lc(displayLang, "Alt contact (relative's number, landline…)", "மாற்று தொடர்பு (உறவினரின் எண், நிலையான தொலைபேசி…)")}
            className="h-8 text-sm" maxLength={200}
          />
        </div>
      </div>
      {error && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel} disabled={saving}>
          {lc(displayLang, "Cancel", "ரத்து")}
        </Button>
        <Button
          type="submit" size="sm" className="h-8"
          disabled={saving || !form.fullName.trim() || !form.epicNumber.trim()}
          data-testid="button-save-voter-edit"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          {lc(displayLang, "Save", "சேமி")}
        </Button>
      </div>
    </form>
  );
}
