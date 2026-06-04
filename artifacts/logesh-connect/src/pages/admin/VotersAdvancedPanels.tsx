import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { adminApi } from "./api";
import {
  Phone, MessageCircle, MapPin, Mail, Trash2, Plus, Loader2, Users2,
  AlertCircle, GitMerge, Sparkles, BarChart3, Bookmark, Printer, Save,
} from "lucide-react";
import type { VoterTag } from "./VoterTagsAdmin";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

// =============================================================
// In-sheet panels (Timeline / ContactLog / Relations)
// =============================================================

export function TimelinePanel({ voterId }: { voterId: number }) {
  const { lang } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: ["voter-timeline", voterId],
    queryFn: () => adminApi.getVoterTimeline(voterId),
    staleTime: 15_000,
  });
  if (isLoading) return <div className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> {lc(lang, "Loading timeline…", "காலவரிசை ஏற்றுகிறது…")}</div>;
  if (error) return <div className="text-xs text-destructive">{(error as Error).message}</div>;
  const items = data?.items ?? [];
  if (items.length === 0) return <div className="text-xs text-muted-foreground italic">{lc(lang, "No activity yet.", "இதுவரை செயல்பாடு இல்லை.")}</div>;
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {items.map((it, idx) => {
        const time = new Date(it.at).toLocaleString();
        const d = it.data;
        if (it.kind === "contact") {
          return (
            <div key={idx} className="border-l-2 border-blue-500 pl-2 py-1 text-xs">
              <div className="font-medium">📞 {String(d.contactType)} {d.outcome ? `· ${String(d.outcome)}` : ""}</div>
              <div className="text-muted-foreground">{String(d.summary)}</div>
              <div className="text-[10px] text-muted-foreground">{time} · {String(d.contactedByName)}</div>
            </div>
          );
        }
        if (it.kind === "note") {
          return (
            <div key={idx} className="border-l-2 border-amber-500 pl-2 py-1 text-xs">
              <div className="font-medium">📝 {lc(lang, "Note", "குறிப்பு")}</div>
              <div className="text-muted-foreground">{String(d.body)}</div>
              <div className="text-[10px] text-muted-foreground">{time} · {String(d.authorName)}</div>
            </div>
          );
        }
        if (it.kind === "grievance") {
          return (
            <div key={idx} className="border-l-2 border-red-500 pl-2 py-1 text-xs">
              <div className="font-medium">⚠️ {lc(lang, "Grievance", "புகார்")} #{String(d.ticketNo)} <Badge variant="outline" className="ml-1 text-[9px]">{String(d.status)}</Badge></div>
              <div className="text-muted-foreground">{String(d.category)}: {String(d.description).slice(0, 80)}…</div>
              <div className="text-[10px] text-muted-foreground">{time}</div>
            </div>
          );
        }
        if (it.kind === "tag") {
          return (
            <div key={idx} className="border-l-2 pl-2 py-1 text-xs" style={{ borderColor: String(d.color) }}>
              <div className="font-medium">🏷️ {lc(lang, "Tag", "குறிச்சொல்")}: {String(d.name)}</div>
              <div className="text-[10px] text-muted-foreground">{time} · {String(d.assignedByName)}</div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export function ContactLogPanel({ voterId }: { voterId: number }) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["voter-contact-log", voterId],
    queryFn: () => adminApi.getVoterContactLog(voterId),
    staleTime: 10_000,
  });
  const [contactType, setContactType] = useState("call");
  const [outcome, setOutcome] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await adminApi.createVoterContactLog(voterId, {
        contactType, outcome: outcome || null, summary: summary.trim(),
      });
      setSummary(""); setOutcome("");
      qc.invalidateQueries({ queryKey: ["voter-contact-log", voterId] });
      qc.invalidateQueries({ queryKey: ["voter-timeline", voterId] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function del(id: number) {
    if (!confirm(lc(lang, "Delete this contact log entry?", "இந்த தொடர்பு பதிவை நீக்கவா?"))) return;
    try {
      await adminApi.deleteVoterContactLog(voterId, id);
      qc.invalidateQueries({ queryKey: ["voter-contact-log", voterId] });
      qc.invalidateQueries({ queryKey: ["voter-timeline", voterId] });
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="border-t pt-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{lc(lang, "Contact log", "தொடர்பு பதிவு")}</div>
      <div className="space-y-2 mb-3" data-testid="contact-log-add">
        <div className="grid grid-cols-2 gap-2">
          <Select value={contactType} onValueChange={setContactType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="call">{lc(lang, "Call", "அழைப்பு")}</SelectItem>
              <SelectItem value="sms">{lc(lang, "SMS", "குறுஞ்செய்தி")}</SelectItem>
              <SelectItem value="whatsapp">{lc(lang, "WhatsApp", "வாட்ஸ்அப்")}</SelectItem>
              <SelectItem value="visit">{lc(lang, "Visit", "நேரில் சந்திப்பு")}</SelectItem>
              <SelectItem value="email">{lc(lang, "Email", "மின்னஞ்சல்")}</SelectItem>
              <SelectItem value="other">{lc(lang, "Other", "மற்றவை")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={outcome || "none"} onValueChange={(v) => setOutcome(v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={lc(lang, "Outcome…", "முடிவு…")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{lc(lang, "— outcome —", "— முடிவு —")}</SelectItem>
              <SelectItem value="reached">{lc(lang, "Reached", "தொடர்பு கிடைத்தது")}</SelectItem>
              <SelectItem value="no_answer">{lc(lang, "No answer", "பதில் இல்லை")}</SelectItem>
              <SelectItem value="wrong_number">{lc(lang, "Wrong number", "தவறான எண்")}</SelectItem>
              <SelectItem value="refused">{lc(lang, "Refused", "மறுத்தார்")}</SelectItem>
              <SelectItem value="scheduled_followup">{lc(lang, "Scheduled follow-up", "தொடர் சந்திப்பு திட்டமிடப்பட்டது")}</SelectItem>
              <SelectItem value="promised_support">{lc(lang, "Promised support", "ஆதரவு வாக்குறுதி")}</SelectItem>
              <SelectItem value="issue_logged">{lc(lang, "Issue logged", "பிரச்சினை பதிவு செய்யப்பட்டது")}</SelectItem>
              <SelectItem value="other">{lc(lang, "Other", "மற்றவை")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={summary} onChange={(e) => setSummary(e.target.value)}
          placeholder={lc(lang, "Brief summary of the interaction…", "உரையாடலின் சுருக்கம்…")} rows={2}
          className="text-xs" maxLength={1000}
          data-testid="textarea-contact-summary"
        />
        <Button size="sm" onClick={add} disabled={saving || !summary.trim()} className="h-7 text-xs" data-testid="button-add-contact">
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          {lc(lang, "Log contact", "தொடர்பைப் பதிவு செய்")}
        </Button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {isLoading && <div className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin" /></div>}
        {data?.items.map((c) => (
          <div key={String(c.id)} className="text-xs border rounded p-2 flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">
                {String(c.contactType)} {c.outcome ? `· ${String(c.outcome)}` : ""}
              </div>
              <div className="text-muted-foreground">{String(c.summary)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(String(c.contactedAt)).toLocaleString()} · {String(c.contactedByName)}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => del(Number(c.id))} aria-label={lc(lang, "Delete", "நீக்கு")}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        {data && data.items.length === 0 && <div className="text-xs text-muted-foreground italic">{lc(lang, "No contacts logged yet.", "இதுவரை தொடர்புகள் பதிவு செய்யப்படவில்லை.")}</div>}
      </div>
    </div>
  );
}

export function RelationsPanel({ voterId }: { voterId: number }) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["voter-relations", voterId],
    queryFn: () => adminApi.getVoterRelations(voterId),
    staleTime: 10_000,
  });
  const [search, setSearch] = useState("");
  const [searchHits, setSearchHits] = useState<Array<{ id: number; epicNumber: string; fullName: string }>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [kind, setKind] = useState("spouse");

  async function runSearch() {
    if (!search.trim()) return;
    try {
      const r = await fetch(`/api/admin/voters?q=${encodeURIComponent(search.trim())}&limit=8`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("nc_token") ?? ""}` },
      });
      if (r.ok) {
        const j = await r.json();
        setSearchHits(j.items ?? []);
      }
    } catch (e) { console.error(e); }
  }
  async function add() {
    if (!selectedId) return;
    try {
      await adminApi.createVoterRelation(voterId, { relatedVoterId: selectedId, kind });
      setSearch(""); setSearchHits([]); setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["voter-relations", voterId] });
    } catch (e) { alert((e as Error).message); }
  }
  async function del(id: number) {
    if (!confirm(lc(lang, "Remove this relation? Both directions will be removed.", "இந்த உறவை நீக்கவா? இரு திசைகளும் நீக்கப்படும்."))) return;
    try {
      await adminApi.deleteVoterRelation(voterId, id);
      qc.invalidateQueries({ queryKey: ["voter-relations", voterId] });
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="border-t pt-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{lc(lang, "Relations", "உறவுகள்")}</div>
      <div className="space-y-2 mb-3">
        <div className="flex gap-1.5">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lc(lang, "Search voter (name / EPIC)…", "வாக்காளரைத் தேடு (பெயர் / EPIC)…")} className="h-7 text-xs" />
          <Button size="sm" onClick={runSearch} className="h-7 text-xs">{lc(lang, "Find", "கண்டறி")}</Button>
        </div>
        {searchHits.length > 0 && (
          <div className="border rounded max-h-32 overflow-y-auto">
            {searchHits.map((h) => (
              <button key={h.id} type="button"
                onClick={() => { setSelectedId(h.id); setSearchHits([]); setSearch(`${h.fullName} (${h.epicNumber})`); }}
                className="block w-full text-left px-2 py-1 hover:bg-muted text-xs">
                {h.fullName} <span className="text-muted-foreground">{h.epicNumber}</span>
              </button>
            ))}
          </div>
        )}
        {selectedId && (
          <div className="flex gap-1.5">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spouse">{lc(lang, "Spouse", "மனைவி/கணவர்")}</SelectItem>
                <SelectItem value="parent">{lc(lang, "Parent", "பெற்றோர்")}</SelectItem>
                <SelectItem value="child">{lc(lang, "Child", "குழந்தை")}</SelectItem>
                <SelectItem value="sibling">{lc(lang, "Sibling", "உடன்பிறப்பு")}</SelectItem>
                <SelectItem value="in_law">{lc(lang, "In-law", "சம்பந்தி")}</SelectItem>
                <SelectItem value="other">{lc(lang, "Other", "மற்றவை")}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={add} className="h-7 text-xs">{lc(lang, "Add", "சேர்")}</Button>
          </div>
        )}
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {isLoading && <div className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin" /></div>}
        {data?.items.map((r) => (
          <div key={String(r.id)} className="text-xs border rounded p-1.5 flex items-center justify-between">
            <div>
              <Badge variant="outline" className="mr-1 text-[10px]">{String(r.kind)}</Badge>
              <span className="font-medium">{String(r.relatedName)}</span>
              <span className="text-muted-foreground ml-1">{String(r.relatedEpic)}</span>
            </div>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => del(Number(r.id))}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        {data && data.items.length === 0 && <div className="text-xs text-muted-foreground italic">{lc(lang, "No relations recorded.", "உறவுகள் எதுவும் பதிவு செய்யப்படவில்லை.")}</div>}
      </div>
    </div>
  );
}

// =============================================================
// Detail-sheet contact info display (read-only summary)
// =============================================================

export function ContactInfoDisplay(props: { phone: string | null; whatsappOptIn: boolean; email: string | null; altContact: string | null }) {
  const { lang } = useLanguage();
  const { phone, whatsappOptIn, email, altContact } = props;
  if (!phone && !email && !altContact) return null;
  return (
    <div className="border-t pt-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{lc(lang, "Contact", "தொடர்பு")}</div>
      <div className="space-y-1 text-sm">
        {phone && (
          <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground" /> {phone} {whatsappOptIn && <Badge variant="secondary" className="text-[9px]"><MessageCircle className="w-2.5 h-2.5 mr-0.5" />WhatsApp</Badge>}</div>
        )}
        {email && <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-muted-foreground" /> {email}</div>}
        {altContact && <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-muted-foreground" /> {altContact}</div>}
      </div>
    </div>
  );
}

// =============================================================
// Bulk advanced actions (in the bulk-bar)
// =============================================================

export function BulkAdvancedActions({
  selectedIds, allTags, onDone,
}: {
  selectedIds: number[];
  allTags: VoterTag[];
  onDone: () => void;
}) {
  const { lang } = useLanguage();
  const [mode, setMode] = useState<"none" | "tag-add" | "tag-remove" | "reassign">("none");
  const [tagId, setTagId] = useState<number | null>(null);
  const [boothId, setBoothId] = useState<string>("");
  const [working, setWorking] = useState(false);

  async function run() {
    if (mode === "tag-add" || mode === "tag-remove") {
      if (!tagId) return;
      setWorking(true);
      try {
        const r = await adminApi.bulkVoterOp({ action: mode, tagId, voterIds: selectedIds });
        alert(lc(lang, `${r.affectedCount} affected.`, `${r.affectedCount} பேர் பாதிக்கப்பட்டனர்.`));
        setMode("none"); setTagId(null);
        onDone();
      } catch (e) { alert((e as Error).message); }
      finally { setWorking(false); }
    } else if (mode === "reassign") {
      const psid = parseInt(boothId, 10);
      if (!Number.isFinite(psid) || psid <= 0) { alert(lc(lang, "Enter a valid booth id", "சரியான வாக்குச்சாவடி எண்ணை உள்ளிடவும்")); return; }
      if (!confirm(lc(lang, `Reassign ${selectedIds.length} voters to booth #${psid}?`, `${selectedIds.length} வாக்காளர்களை வாக்குச்சாவடி #${psid}-க்கு மாற்றவா?`))) return;
      setWorking(true);
      try {
        const r = await adminApi.bulkVoterOp({ action: "reassign-booth", newPollingStationId: psid, voterIds: selectedIds });
        alert(lc(lang, `${r.affectedCount} reassigned.`, `${r.affectedCount} பேர் மாற்றப்பட்டனர்.`));
        setMode("none"); setBoothId("");
        onDone();
      } catch (e) { alert((e as Error).message); }
      finally { setWorking(false); }
    }
  }

  if (mode === "none") {
    return (
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMode("tag-add")} data-testid="button-bulk-tag-add">
          + {lc(lang, "Tag", "குறிச்சொல்")}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMode("tag-remove")}>
          − {lc(lang, "Tag", "குறிச்சொல்")}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMode("reassign")} data-testid="button-bulk-reassign">
          {lc(lang, "Reassign booth", "வாக்குச்சாவடியை மாற்று")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 border-l pl-2">
      {(mode === "tag-add" || mode === "tag-remove") && (
        <>
          <Select value={tagId ? String(tagId) : ""} onValueChange={(v) => setTagId(parseInt(v, 10))}>
            <SelectTrigger className="h-7 text-xs w-44" data-testid="select-bulk-tag"><SelectValue placeholder={lc(lang, "Pick a tag…", "ஒரு குறிச்சொல்லைத் தேர்வுசெய்…")} /></SelectTrigger>
            <SelectContent>
              {allTags.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs" disabled={working || !tagId} onClick={run} data-testid="button-bulk-apply">
            {working ? <Loader2 className="w-3 h-3 animate-spin" /> : (mode === "tag-add" ? lc(lang, "Add tag", "குறிச்சொல் சேர்") : lc(lang, "Remove tag", "குறிச்சொல் நீக்கு"))}
          </Button>
        </>
      )}
      {mode === "reassign" && (
        <>
          <Input
            value={boothId} onChange={(e) => setBoothId(e.target.value)}
            placeholder={lc(lang, "Booth id…", "வாக்குச்சாவடி எண்…")} className="h-7 text-xs w-28"
            data-testid="input-bulk-booth-id"
          />
          <Button size="sm" className="h-7 text-xs" disabled={working || !boothId} onClick={run}>
            {working ? <Loader2 className="w-3 h-3 animate-spin" /> : lc(lang, "Reassign", "மாற்று")}
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setMode("none"); setTagId(null); setBoothId(""); }}>
        {lc(lang, "Cancel", "ரத்து")}
      </Button>
    </div>
  );
}

// =============================================================
// Lab dialogs (Duplicates / Analytics / Segments / Callsheet)
// =============================================================

export function VotersAdvancedToolbar({
  onJumpToVoter, currentFilter,
}: {
  onJumpToVoter: (voterId: number) => void;
  currentFilter: Record<string, unknown>;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <DuplicatesDialog onJumpToVoter={onJumpToVoter} />
      <AnalyticsDialog />
      <SegmentsDialog currentFilter={currentFilter} />
      <CallsheetDialog currentFilter={currentFilter} />
    </div>
  );
}

function DuplicatesDialog({ onJumpToVoter }: { onJumpToVoter: (id: number) => void }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["voter-duplicates"],
    queryFn: () => adminApi.getVoterDuplicates(50),
    enabled: open,
    staleTime: 60_000,
  });
  const [primaryByGroup, setPrimaryByGroup] = useState<Record<string, number>>({});
  const [merging, setMerging] = useState<string | null>(null);

  async function merge(groupKey: string, members: Array<Record<string, unknown>>) {
    const primaryId = primaryByGroup[groupKey] ?? Number(members[0].id);
    const dupIds = members.map((m) => Number(m.id)).filter((id) => id !== primaryId);
    if (dupIds.length === 0) return;
    if (!confirm(lc(lang, `Merge ${dupIds.length} duplicate(s) into voter #${primaryId}? Their tags, notes, grievances and contact log will be reassigned.`, `${dupIds.length} போலி பதிவை வாக்காளர் #${primaryId}-உடன் இணைக்கவா? அவர்களின் குறிச்சொற்கள், குறிப்புகள், புகார்கள் மற்றும் தொடர்பு பதிவு மாற்றப்படும்.`))) return;
    setMerging(groupKey);
    try {
      await adminApi.mergeVoters(primaryId, dupIds);
      await refetch();
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("voter") });
    } catch (e) { alert((e as Error).message); }
    finally { setMerging(null); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-open-duplicates">
          <GitMerge className="w-3 h-3 mr-1" /> {lc(lang, "Duplicates", "போலி பதிவுகள்")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lc(lang, "Duplicate voters", "போலி வாக்காளர்கள்")}</DialogTitle>
          <DialogDescription>
            {lc(lang, "Voters sharing name + age + booth. Pick a primary and merge — duplicates are deleted and their tags / notes / grievances are reassigned.", "பெயர் + வயது + வாக்குச்சாவடி ஒன்றாக உள்ள வாக்காளர்கள். ஒரு முதன்மை பதிவைத் தேர்ந்தெடுத்து இணைக்கவும் — போலி பதிவுகள் நீக்கப்பட்டு அவற்றின் குறிச்சொற்கள் / குறிப்புகள் / புகார்கள் மாற்றப்படும்.")}
          </DialogDescription>
        </DialogHeader>
        {isFetching && <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> {lc(lang, "Loading…", "ஏற்றுகிறது…")}</div>}
        {data?.groups.length === 0 && <div className="text-sm text-muted-foreground italic">{lc(lang, "No duplicates detected. 🎉", "போலி பதிவுகள் எதுவும் கண்டறியப்படவில்லை. 🎉")}</div>}
        <div className="space-y-3">
          {data?.groups.map((g) => (
            <Card key={g.key}>
              <CardContent className="p-3">
                <div className="text-xs font-medium mb-2">{g.nameKey} · {lc(lang, "age", "வயது")} {g.age ?? "?"} · {lc(lang, "booth", "வாக்குச்சாவடி")} {g.pollingStationId ?? "—"} · {lc(lang, `${g.count} rows`, `${g.count} வரிசைகள்`)}</div>
                <div className="space-y-1">
                  {g.members.map((m) => {
                    const id = Number(m.id);
                    const isPrimary = (primaryByGroup[g.key] ?? Number(g.members[0].id)) === id;
                    return (
                      <div key={id} className="flex items-center gap-2 text-xs border rounded p-1.5">
                        <input type="radio" checked={isPrimary} onChange={() => setPrimaryByGroup((prev) => ({ ...prev, [g.key]: id }))} aria-label={lc(lang, "Primary", "முதன்மை")} />
                        <button type="button" className="text-primary hover:underline" onClick={() => onJumpToVoter(id)}>
                          {String(m.fullName)}
                        </button>
                        <span className="text-muted-foreground">{String(m.epicNumber)}</span>
                        {m.phone ? <Phone className="w-3 h-3 text-muted-foreground" /> : null}
                        <span className="text-muted-foreground ml-auto">id={id}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" className="h-7 text-xs" disabled={merging === g.key} onClick={() => merge(g.key, g.members)} data-testid={`button-merge-group-${g.key.slice(0, 16)}`}>
                    {merging === g.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <GitMerge className="w-3 h-3 mr-1" />}
                    {lc(lang, "Merge into selected primary", "தேர்ந்தெடுத்த முதன்மையுடன் இணை")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalyticsDialog() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["voter-analytics"],
    queryFn: () => adminApi.getVoterAnalytics(),
    enabled: open,
    staleTime: 60_000,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-open-analytics">
          <BarChart3 className="w-3 h-3 mr-1" /> {lc(lang, "Analytics", "பகுப்பாய்வு")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lc(lang, "Voter analytics", "வாக்காளர் பகுப்பாய்வு")}</DialogTitle>
          <DialogDescription>{lc(lang, "Aggregate stats across the voter roll.", "வாக்காளர் பட்டியல் முழுவதும் ஒட்டுமொத்த புள்ளிவிவரங்கள்.")}</DialogDescription>
        </DialogHeader>
        {isLoading && <div><Loader2 className="w-4 h-4 inline animate-spin" /> {lc(lang, "Loading…", "ஏற்றுகிறது…")}</div>}
        {data && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{lc(lang, "Total voters", "மொத்த வாக்காளர்கள்")}</div><div className="text-2xl font-bold" data-testid="analytics-total">{data.totalVoters.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{lc(lang, "Phone coverage", "தொலைபேசி பரவல்")}</div><div className="text-2xl font-bold">{data.phoneCoverage.percent}%</div><div className="text-xs text-muted-foreground">{data.phoneCoverage.withPhone.toLocaleString()} / {data.phoneCoverage.total.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{lc(lang, "WhatsApp opt-in", "வாட்ஸ்அப் இணக்கம்")}</div><div className="text-2xl font-bold">{data.whatsappOptIn.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{lc(lang, "Unique tags", "தனித்துவ குறிச்சொற்கள்")}</div><div className="text-2xl font-bold">{data.byTag.length}</div></CardContent></Card>
            <Card className="col-span-2"><CardContent className="p-3">
              <div className="text-xs font-medium mb-2">{lc(lang, "By gender", "பாலினம் வாரியாக")}</div>
              <div className="flex gap-2 flex-wrap">{data.byGender.map((g) => <Badge key={g.gender} variant="outline">{g.gender}: {g.n.toLocaleString()}</Badge>)}</div>
            </CardContent></Card>
            <Card className="col-span-2"><CardContent className="p-3">
              <div className="text-xs font-medium mb-2">{lc(lang, "By age band", "வயது வரம்பு வாரியாக")}</div>
              <div className="flex gap-2 flex-wrap">{data.byAgeBand.map((a) => <Badge key={a.band} variant="outline">{a.band}: {a.n.toLocaleString()}</Badge>)}</div>
            </CardContent></Card>
            <Card className="col-span-2"><CardContent className="p-3">
              <div className="text-xs font-medium mb-2">{lc(lang, "Top booths", "முதன்மை வாக்குச்சாவடிகள்")}</div>
              <table className="w-full text-xs"><tbody>
                {data.byBooth.slice(0, 10).map((b, i) => (
                  <tr key={i} className="border-b last:border-0"><td className="py-1">#{b.booth_no ?? "—"} {b.name ?? ""}</td><td className="py-1 text-right font-mono">{b.n.toLocaleString()}</td></tr>
                ))}
              </tbody></table>
            </CardContent></Card>
            <Card className="col-span-2"><CardContent className="p-3">
              <div className="text-xs font-medium mb-2">{lc(lang, "Tag distribution", "குறிச்சொல் பரவல்")}</div>
              <div className="flex gap-1 flex-wrap">
                {data.byTag.map((t) => <Badge key={t.id} style={{ backgroundColor: t.color, color: "#fff" }}>{t.name}: {t.n.toLocaleString()}</Badge>)}
                {data.byTag.length === 0 && <span className="text-xs text-muted-foreground italic">{lc(lang, "No tag assignments yet.", "இதுவரை குறிச்சொல் ஒதுக்கீடுகள் இல்லை.")}</span>}
              </div>
            </CardContent></Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SegmentsDialog({ currentFilter }: { currentFilter: Record<string, unknown> }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["voter-segments"],
    queryFn: () => adminApi.getVoterSegments(),
    enabled: open,
    staleTime: 30_000,
  });
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);

  async function save() {
    if (!name.trim()) return;
    try {
      await adminApi.createVoterSegment({
        name: name.trim(),
        filterJson: currentFilter,
        sharedWithRole: shared ? "*" : null,
      });
      setName(""); setShared(false);
      await refetch();
    } catch (e) { alert((e as Error).message); }
  }
  async function del(id: number) {
    if (!confirm(lc(lang, "Delete this segment?", "இந்தப் பிரிவை நீக்கவா?"))) return;
    try { await adminApi.deleteVoterSegment(id); await refetch(); } catch (e) { alert((e as Error).message); }
  }
  async function refreshCount(id: number) {
    try { await adminApi.refreshVoterSegmentCount(id); await refetch(); } catch (e) { alert((e as Error).message); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-open-segments">
          <Bookmark className="w-3 h-3 mr-1" /> {lc(lang, "Segments", "பிரிவுகள்")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lc(lang, "Saved voter segments", "சேமிக்கப்பட்ட வாக்காளர் பிரிவுகள்")}</DialogTitle>
          <DialogDescription>{lc(lang, "Save the current filter as a reusable segment, or browse existing ones.", "தற்போதைய வடிகட்டியை மீண்டும் பயன்படுத்தக்கூடிய பிரிவாக சேமிக்கவும், அல்லது இருப்பவற்றை உலாவவும்.")}</DialogDescription>
        </DialogHeader>
        <div className="border rounded p-2 mb-3 space-y-2">
          <div className="text-xs font-medium">{lc(lang, "Save current filter", "தற்போதைய வடிகட்டியைச் சேமி")}</div>
          <div className="text-[10px] text-muted-foreground font-mono">{JSON.stringify(currentFilter).slice(0, 200) || lc(lang, "(empty)", "(காலி)")}</div>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={lc(lang, "Segment name…", "பிரிவின் பெயர்…")} className="h-8 text-xs" data-testid="input-segment-name" />
            <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> {lc(lang, "Share with all staff", "அனைத்து பணியாளர்களுடன் பகிர்")}</label>
            <Button size="sm" className="h-8 text-xs" disabled={!name.trim()} onClick={save} data-testid="button-save-segment">
              <Save className="w-3 h-3 mr-1" /> {lc(lang, "Save", "சேமி")}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          {data?.items.map((s) => (
            <div key={String(s.id)} className="text-xs border rounded p-2 flex items-center gap-2">
              <Bookmark className="w-3 h-3 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{String(s.name)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {lc(lang, "by", "உருவாக்கியவர்")} {String(s.ownerName)} · {s.lastCount != null ? lc(lang, `≈ ${Number(s.lastCount).toLocaleString()} voters`, `≈ ${Number(s.lastCount).toLocaleString()} வாக்காளர்கள்`) : lc(lang, "count unknown", "எண்ணிக்கை தெரியவில்லை")} · {s.sharedWithRole === "*" ? lc(lang, "shared with all staff", "அனைத்து பணியாளர்களுடன் பகிரப்பட்டது") : lc(lang, "private", "தனிப்பட்டது")}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => refreshCount(Number(s.id))}>{lc(lang, "Refresh count", "எண்ணிக்கையைப் புதுப்பி")}</Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => del(Number(s.id))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          {data?.items.length === 0 && <div className="text-xs text-muted-foreground italic">{lc(lang, "No segments yet.", "இதுவரை பிரிவுகள் இல்லை.")}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CallsheetDialog({ currentFilter }: { currentFilter: Record<string, unknown> }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ groups: Array<{ key: string; label: string; members: Array<Record<string, unknown>> }>; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const r = await adminApi.getVoterCallsheet({ filter: currentFilter, groupBy: "booth" });
      setData(r);
    } catch (e) { alert((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) generate(); else setData(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-open-callsheet">
          <Printer className="w-3 h-3 mr-1" /> {lc(lang, "Callsheet", "அழைப்புப் பட்டியல்")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto print:max-w-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>{lc(lang, "Callsheet — printable", "அழைப்புப் பட்டியல் — அச்சிடக்கூடியது")}</DialogTitle>
          <DialogDescription>
            {lc(lang, "Up to 5,000 voters matching the current filter, grouped by booth. Click Print to save as PDF.", "தற்போதைய வடிகட்டிக்கு பொருந்தும் அதிகபட்சம் 5,000 வாக்காளர்கள், வாக்குச்சாவடி வாரியாக தொகுக்கப்பட்டுள்ளனர். PDF ஆக சேமிக்க அச்சிடு என்பதை அழுத்தவும்.")}
          </DialogDescription>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={() => window.print()} data-testid="button-print-callsheet">
              <Printer className="w-3 h-3 mr-1" /> {lc(lang, "Print", "அச்சிடு")}
            </Button>
            <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : lc(lang, "Refresh", "புதுப்பி")}
            </Button>
          </div>
        </DialogHeader>
        <div id="callsheet-content" className="space-y-4">
          {loading && <div><Loader2 className="w-4 h-4 inline animate-spin" /> {lc(lang, "Loading…", "ஏற்றுகிறது…")}</div>}
          {data && (
            <>
              <div className="text-sm">
                {lang === "ta"
                  ? <><strong>{data.groups.length}</strong> வாக்குச்சாவடிகளில் <strong>{data.total.toLocaleString()}</strong> வாக்காளர்கள்.</>
                  : <><strong>{data.total.toLocaleString()}</strong> voters across <strong>{data.groups.length}</strong> booth(s).</>}
              </div>
              {data.groups.map((g) => (
                <div key={g.key} className="break-inside-avoid">
                  <div className="font-bold text-sm border-b pb-1 mb-1">{g.label} ({g.members.length})</div>
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b"><th className="text-left p-1">{lc(lang, "Sl.", "வ.எண்")}</th><th className="text-left p-1">{lc(lang, "EPIC", "EPIC")}</th><th className="text-left p-1">{lc(lang, "Name", "பெயர்")}</th><th className="text-left p-1">{lc(lang, "Age/G", "வயது/பா")}</th><th className="text-left p-1">{lc(lang, "Address", "முகவரி")}</th><th className="text-left p-1">{lc(lang, "Phone", "தொலைபேசி")}</th><th className="text-left p-1">{lc(lang, "Notes", "குறிப்புகள்")}</th></tr>
                    </thead>
                    <tbody>
                      {g.members.map((m, i) => (
                        <tr key={String(m.id)} className="border-b">
                          <td className="p-1">{String(m.serialInPart ?? i + 1)}</td>
                          <td className="p-1 font-mono">{String(m.epicNumber)}</td>
                          <td className="p-1">{String(m.fullName)}{m.fullNameTa ? <div className="text-muted-foreground">{String(m.fullNameTa)}</div> : null}</td>
                          <td className="p-1">{m.age ?? "—"}/{m.gender ?? "—"}</td>
                          <td className="p-1">{m.houseNumber ? `${m.houseNumber} · ` : ""}{String(m.addressLine ?? "")}</td>
                          <td className="p-1">{String(m.phone ?? "")}</td>
                          <td className="p-1 w-32">&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
