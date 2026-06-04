import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  adminListAssignments,
  adminCreateAssignment,
  adminUpdateAssignment,
  adminDeleteAssignment,
  adminBulkReassignAssignments,
  adminListVolunteerAssignments,
  adminCreateVolunteerAssignment,
  adminUpdateVolunteerAssignment,
  adminDeleteVolunteerAssignment,
  adminListRoutingLog,
  listGrievanceOfficers,
} from "@workspace/api-client-react";
import { useWards } from "@/lib/useWards";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";
import { Loader2, Plus, Trash2, Power, History, Search, Users, UserCog, ArrowRightLeft } from "lucide-react";

interface AssignmentsAdminProps { token: string }

interface AreaOption { id: number; name: string }
interface BoothOption { id: number; boothNo: string; name: string }
interface VolunteerLite { id: number; name: string; phone: string }

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
async function fetchAreas(wardId: number): Promise<AreaOption[]> {
  const r = await fetch(`${BASE}/api/wards/${wardId}/areas`);
  return r.ok ? (r.json() as Promise<AreaOption[]>) : [];
}
async function fetchBooths(wardId: number): Promise<BoothOption[]> {
  const r = await fetch(`${BASE}/api/wards/${wardId}/polling-stations`);
  return r.ok ? (r.json() as Promise<BoothOption[]>) : [];
}
async function fetchApprovedVolunteers(token: string): Promise<VolunteerLite[]> {
  const r = await fetch(`${BASE}/api/admin/volunteers?status=approved&limit=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const j = await r.json() as { items?: VolunteerLite[] };
  return j.items ?? [];
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

const REASON_BADGE: Record<string, string> = {
  auto: "bg-blue-100 text-blue-700",
  manual: "bg-purple-100 text-purple-700",
  reassign: "bg-orange-100 text-orange-700",
  unassigned: "bg-gray-200 text-gray-700",
};

type TabKey = "officers" | "volunteers";

export default function AssignmentsAdmin({ token }: AssignmentsAdminProps) {
  const { lang } = useLanguage();
  const [tab, setTab] = useState<TabKey>("officers");
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{lc(lang, "Assignments", "ஒதுக்கீடுகள்")}</h2>
          <p className="text-sm text-muted-foreground">
            {lc(lang,
              "Map officers and volunteers to wards, areas or polling booths. New grievances are auto-routed to officers (booth → area → ward), picking the active officer with the smallest open caseload.",
              "அலுவலர்கள் மற்றும் தன்னார்வலர்களை வட்டாரங்கள், பகுதிகள் அல்லது வாக்குச்சாவடிகளுக்கு ஒதுக்குங்கள். புதிய புகார்கள் அலுவலர்களுக்கு தானாக வழிமாற்றப்படும் (வாக்குச்சாவடி → பகுதி → வட்டாரம்), குறைந்த நிலுவை பணிச்சுமை கொண்ட செயலில் உள்ள அலுவலர் தேர்ந்தெடுக்கப்படுவார்.")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLogOpen(true)} className="gap-1.5">
          <History className="w-4 h-4" /> {lc(lang, "Routing log", "வழிமாற்று பதிவு")}
        </Button>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("officers")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 ${
            tab === "officers" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
          data-testid="tab-officers"
        >
          <UserCog className="w-4 h-4" /> {lc(lang, "Officers", "அலுவலர்கள்")}
        </button>
        <button
          onClick={() => setTab("volunteers")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 ${
            tab === "volunteers" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
          data-testid="tab-volunteers"
        >
          <Users className="w-4 h-4" /> {lc(lang, "Volunteers", "தன்னார்வலர்கள்")}
        </button>
      </div>

      {tab === "officers" ? <OfficersTab token={token} /> : <VolunteersTab token={token} />}

      {/* Routing-log peek */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lc(lang, "Recent Routing Decisions", "சமீபத்திய வழிமாற்று முடிவுகள்")}</DialogTitle></DialogHeader>
          <RoutingLogTable token={token} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────── Officers tab ──────────────────────────
function OfficersTab({ token }: { token: string }) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { data: wardList = [] } = useWards();

  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterWardId, setFilterWardId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUserId, setNewUserId] = useState<string>("");
  const [newWardId, setNewWardId] = useState<string>("none");
  const [newAreaId, setNewAreaId] = useState<string>("none");
  const [newBoothId, setNewBoothId] = useState<string>("none");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [createError, setCreateError] = useState<string>("");

  // Bulk reassign state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignToUserId, setReassignToUserId] = useState<string>("");
  const [reassignError, setReassignError] = useState<string>("");

  const { data: officersData } = useQuery({
    queryKey: ["grievance-officers"],
    queryFn: () => listGrievanceOfficers({ headers: authHeaders(token) }),
    staleTime: 60_000,
  });

  const listParams = useMemo(() => ({
    ...(filterUserId !== "all" && { userId: parseInt(filterUserId, 10) }),
    ...(filterWardId !== "all" && { wardId: parseInt(filterWardId, 10) }),
  }), [filterUserId, filterWardId]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["officer-assignments", listParams],
    queryFn: () => adminListAssignments(listParams, { headers: authHeaders(token) }),
    staleTime: 30_000,
  });

  const newWardIdNum = newWardId !== "none" ? parseInt(newWardId, 10) : null;
  const { data: areaOpts = [] } = useQuery({
    queryKey: ["adm-ward-areas", newWardIdNum],
    queryFn: () => (newWardIdNum ? fetchAreas(newWardIdNum) : Promise.resolve([])),
    enabled: !!newWardIdNum,
    staleTime: 5 * 60_000,
  });
  const { data: boothOpts = [] } = useQuery({
    queryKey: ["adm-ward-booths", newWardIdNum],
    queryFn: () => (newWardIdNum ? fetchBooths(newWardIdNum) : Promise.resolve([])),
    enabled: !!newWardIdNum,
    staleTime: 5 * 60_000,
  });

  useEffect(() => { setNewAreaId("none"); setNewBoothId("none"); }, [newWardId]);

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateAssignment(
        {
          userId: parseInt(newUserId, 10),
          wardId: newWardId !== "none" ? parseInt(newWardId, 10) : null,
          areaId: newAreaId !== "none" ? parseInt(newAreaId, 10) : null,
          pollingStationId: newBoothId !== "none" ? parseInt(newBoothId, 10) : null,
          roleLabel: newRoleLabel.trim() || null,
          isActive: true,
        },
        { headers: authHeaders(token) },
      ),
    onSuccess: () => {
      setDialogOpen(false);
      setNewUserId(""); setNewWardId("none"); setNewAreaId("none");
      setNewBoothId("none"); setNewRoleLabel(""); setCreateError("");
      qc.invalidateQueries({ queryKey: ["officer-assignments"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg.includes("409") ? lc(lang, "This officer already has an assignment with the same scope", "இந்த அலுவலருக்கு ஏற்கனவே அதே வரம்பில் ஒதுக்கீடு உள்ளது") :
                     msg.includes("400") ? lc(lang, "Invalid assignment — check ward/area/booth match", "தவறான ஒதுக்கீடு — வட்டாரம்/பகுதி/வாக்குச்சாவடி பொருத்தத்தை சரிபார்க்கவும்") : msg);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adminUpdateAssignment(id, { isActive }, { headers: authHeaders(token) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["officer-assignments"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminDeleteAssignment(id, { headers: authHeaders(token) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["officer-assignments"] }),
  });

  const bulkReassignMutation = useMutation({
    mutationFn: () => adminBulkReassignAssignments(
      { assignmentIds: Array.from(selected), toUserId: parseInt(reassignToUserId, 10) },
      { headers: authHeaders(token) },
    ),
    onSuccess: () => {
      setReassignOpen(false);
      setSelected(new Set());
      setReassignToUserId("");
      setReassignError("");
      qc.invalidateQueries({ queryKey: ["officer-assignments"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setReassignError(
        msg.includes("409") ? lc(lang, "Some reassignments collide with existing scopes for the target officer", "சில மறு ஒதுக்கீடுகள் இலக்கு அலுவலரின் தற்போதைய வரம்புகளுடன் முரண்படுகின்றன") :
        msg.includes("400") ? lc(lang, "Invalid request", "தவறான கோரிக்கை") : msg,
      );
    },
  });

  const items = data?.items ?? [];
  const filtered = search
    ? items.filter(i =>
        (i.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.wardName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.areaName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.roleLabel ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  function toggleRow(id: number) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  }
  function toggleAllVisible() {
    if (filtered.every(r => selected.has(r.id))) {
      const n = new Set(selected);
      filtered.forEach(r => n.delete(r.id));
      setSelected(n);
    } else {
      const n = new Set(selected);
      filtered.forEach(r => n.add(r.id));
      setSelected(n);
    }
  }

  function submitCreate() {
    setCreateError("");
    if (!newUserId) { setCreateError(lc(lang, "Pick an officer", "ஒரு அலுவலரைத் தேர்ந்தெடுக்கவும்")); return; }
    if (newWardId === "none" && newAreaId === "none" && newBoothId === "none") {
      setCreateError(lc(lang, "Pick at least a ward, area or booth scope", "குறைந்தது ஒரு வட்டாரம், பகுதி அல்லது வாக்குச்சாவடி வரம்பைத் தேர்ந்தெடுக்கவும்")); return;
    }
    createMutation.mutate();
  }

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-56 h-9 text-sm"><SelectValue placeholder={lc(lang, "Officer", "அலுவலர்")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lc(lang, "All officers", "எல்லா அலுவலர்களும்")}</SelectItem>
                {(officersData?.officers ?? []).map(o => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterWardId} onValueChange={setFilterWardId}>
              <SelectTrigger className="w-56 h-9 text-sm"><SelectValue placeholder={lc(lang, "Ward", "வட்டாரம்")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lc(lang, "All wards", "எல்லா வட்டாரங்களும்")}</SelectItem>
                {wardList.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm w-64"
                placeholder={lc(lang, "Search by officer / ward / role…", "அலுவலர் / வட்டாரம் / பணி மூலம் தேடு…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 ml-auto">
              {selected.size > 0 && (
                <Button
                  size="sm" variant="outline" className="h-9 gap-1.5"
                  onClick={() => { setReassignError(""); setReassignOpen(true); }}
                  data-testid="button-bulk-reassign"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {lc(lang, "Reassign", "மறு ஒதுக்கீடு")} {selected.size} {lc(lang, "selected", "தேர்வு")}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-9">
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : lc(lang, "Refresh", "புதுப்பி")}
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-primary text-white hover:bg-primary/90 gap-1.5 h-9">
                <Plus className="w-4 h-4" /> {lc(lang, "New Assignment", "புதிய ஒதுக்கீடு")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
                      onChange={toggleAllVisible}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  {[lc(lang, "Officer", "அலுவலர்"), lc(lang, "Role label", "பணி பெயர்"), lc(lang, "Ward", "வட்டாரம்"), lc(lang, "Area", "பகுதி"), lc(lang, "Booth", "வாக்குச்சாவடி"), lc(lang, "Active", "செயலில்"), lc(lang, "Created", "உருவாக்கப்பட்டது"), ""].map((h, idx) => (
                    <th key={idx} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleRow(a.id)}
                        data-testid={`checkbox-row-${a.id}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.userName ?? `User #${a.userId}`}</div>
                      <div className="text-xs text-muted-foreground">{a.userEmail ?? ""} {a.userRole ? `· ${a.userRole}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.roleLabel ?? "—"}</td>
                    <td className="px-4 py-3">{a.wardName ?? "—"}</td>
                    <td className="px-4 py-3">{a.areaName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {a.pollingStationId
                        ? <span className="text-xs">#{a.boothNo} {a.boothName}</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={a.isActive ? "border-green-500 text-green-700" : "border-gray-400 text-gray-500"}>
                        {a.isActive ? lc(lang, "Active", "செயலில்") : lc(lang, "Paused", "இடைநிறுத்தம்")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                          onClick={() => toggleMutation.mutate({ id: a.id, isActive: !a.isActive })}
                          disabled={toggleMutation.isPending}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {a.isActive ? lc(lang, "Pause", "இடைநிறுத்து") : lc(lang, "Activate", "செயல்படுத்து")}
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(lc(lang, "Delete this assignment?", "இந்த ஒதுக்கீட்டை நீக்கவா?"))) deleteMutation.mutate(a.id); }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-muted-foreground py-12">
                    {isFetching ? lc(lang, "Loading…", "ஏற்றுகிறது…") : lc(lang, "No assignments yet — click \"New Assignment\" to create one.", "இன்னும் ஒதுக்கீடுகள் இல்லை — உருவாக்க \"புதிய ஒதுக்கீடு\" என்பதைக் கிளிக் செய்யவும்.")}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{lc(lang, "New Officer Assignment", "புதிய அலுவலர் ஒதுக்கீடு")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">{lc(lang, "Officer *", "அலுவலர் *")}</label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger><SelectValue placeholder={lc(lang, "Pick officer…", "அலுவலரைத் தேர்ந்தெடு…")} /></SelectTrigger>
                <SelectContent>
                  {(officersData?.officers ?? []).map(o => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.name} · {o.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{lc(lang, "Ward", "வட்டாரம்")}</label>
              <Select value={newWardId} onValueChange={setNewWardId}>
                <SelectTrigger><SelectValue placeholder={lc(lang, "Pick ward…", "வட்டாரத்தைத் தேர்ந்தெடு…")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{lc(lang, "— None —", "— எதுவுமில்லை —")}</SelectItem>
                  {wardList.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newWardIdNum && areaOpts.length > 0 && (
              <div>
                <label className="text-xs font-medium block mb-1">{lc(lang, "Area (optional, narrower scope)", "பகுதி (விருப்பத்தேர்வு, குறுகிய வரம்பு)")}</label>
                <Select value={newAreaId} onValueChange={setNewAreaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lc(lang, "— None —", "— எதுவுமில்லை —")}</SelectItem>
                    {areaOpts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newWardIdNum && boothOpts.length > 0 && (
              <div>
                <label className="text-xs font-medium block mb-1">{lc(lang, "Booth (optional, narrowest scope)", "வாக்குச்சாவடி (விருப்பத்தேர்வு, மிகக் குறுகிய வரம்பு)")}</label>
                <Select value={newBoothId} onValueChange={setNewBoothId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lc(lang, "— None —", "— எதுவுமில்லை —")}</SelectItem>
                    {boothOpts.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>#{b.boothNo} — {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium block mb-1">{lc(lang, "Role label (optional)", "பணி பெயர் (விருப்பத்தேர்வு)")}</label>
              <Input
                placeholder={lc(lang, "e.g. Booth Captain, Area Coordinator…", "எ.கா. வாக்குச்சாவடி தலைவர், பகுதி ஒருங்கிணைப்பாளர்…")}
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
              />
            </div>
            {createError && (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{createError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{lc(lang, "Cancel", "ரத்து")}</Button>
            <Button
              onClick={submitCreate}
              disabled={createMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : lc(lang, "Create", "உருவாக்கு")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk reassign dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lc(lang, "Reassign", "மறு ஒதுக்கீடு")} {selected.size} {lc(lang, selected.size === 1 ? "assignment" : "assignments", "ஒதுக்கீடு")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lc(lang,
                "Move the selected scopes to another officer. Existing open grievances are not changed — only future auto-routing uses the new owner.",
                "தேர்ந்தெடுக்கப்பட்ட வரம்புகளை மற்றொரு அலுவலருக்கு மாற்றவும். தற்போதைய திறந்த புகார்கள் மாற்றப்படாது — எதிர்கால தானியங்கி வழிமாற்றம் மட்டுமே புதிய உரிமையாளரைப் பயன்படுத்தும்.")}
            </p>
            <div>
              <label className="text-xs font-medium block mb-1">{lc(lang, "Target officer *", "இலக்கு அலுவலர் *")}</label>
              <Select value={reassignToUserId} onValueChange={setReassignToUserId}>
                <SelectTrigger><SelectValue placeholder={lc(lang, "Pick officer…", "அலுவலரைத் தேர்ந்தெடு…")} /></SelectTrigger>
                <SelectContent>
                  {(officersData?.officers ?? []).map(o => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.name} · {o.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reassignError && (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{reassignError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReassignOpen(false)}>{lc(lang, "Cancel", "ரத்து")}</Button>
            <Button
              onClick={() => { if (!reassignToUserId) { setReassignError(lc(lang, "Pick a target officer", "ஒரு இலக்கு அலுவலரைத் தேர்ந்தெடுக்கவும்")); return; } bulkReassignMutation.mutate(); }}
              disabled={bulkReassignMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90"
              data-testid="button-confirm-reassign"
            >
              {bulkReassignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : lc(lang, "Reassign", "மறு ஒதுக்கீடு")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────── Volunteers tab ──────────────────────────
function VolunteersTab({ token }: { token: string }) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { data: wardList = [] } = useWards();

  const [filterWardId, setFilterWardId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newVolId, setNewVolId] = useState<string>("");
  const [newWardId, setNewWardId] = useState<string>("none");
  const [newAreaId, setNewAreaId] = useState<string>("none");
  const [newBoothId, setNewBoothId] = useState<string>("none");
  const [createError, setCreateError] = useState<string>("");

  const { data: volunteers = [] } = useQuery({
    queryKey: ["approved-volunteers"],
    queryFn: () => fetchApprovedVolunteers(token),
    staleTime: 60_000,
  });

  const listParams = useMemo(() => ({
    ...(filterWardId !== "all" && { wardId: parseInt(filterWardId, 10) }),
  }), [filterWardId]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["volunteer-assignments", listParams],
    queryFn: () => adminListVolunteerAssignments(listParams, { headers: authHeaders(token) }),
    staleTime: 30_000,
  });

  const newWardIdNum = newWardId !== "none" ? parseInt(newWardId, 10) : null;
  const { data: areaOpts = [] } = useQuery({
    queryKey: ["adm-vol-ward-areas", newWardIdNum],
    queryFn: () => (newWardIdNum ? fetchAreas(newWardIdNum) : Promise.resolve([])),
    enabled: !!newWardIdNum,
    staleTime: 5 * 60_000,
  });
  const { data: boothOpts = [] } = useQuery({
    queryKey: ["adm-vol-ward-booths", newWardIdNum],
    queryFn: () => (newWardIdNum ? fetchBooths(newWardIdNum) : Promise.resolve([])),
    enabled: !!newWardIdNum,
    staleTime: 5 * 60_000,
  });

  useEffect(() => { setNewAreaId("none"); setNewBoothId("none"); }, [newWardId]);

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateVolunteerAssignment(
        {
          volunteerId: parseInt(newVolId, 10),
          wardId: newWardId !== "none" ? parseInt(newWardId, 10) : null,
          areaId: newAreaId !== "none" ? parseInt(newAreaId, 10) : null,
          pollingStationId: newBoothId !== "none" ? parseInt(newBoothId, 10) : null,
          isActive: true,
        },
        { headers: authHeaders(token) },
      ),
    onSuccess: () => {
      setDialogOpen(false);
      setNewVolId(""); setNewWardId("none"); setNewAreaId("none"); setNewBoothId("none");
      setCreateError("");
      qc.invalidateQueries({ queryKey: ["volunteer-assignments"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg.includes("409") ? lc(lang, "This volunteer already has an assignment with the same scope", "இந்த தன்னார்வலருக்கு ஏற்கனவே அதே வரம்பில் ஒதுக்கீடு உள்ளது") :
                     msg.includes("400") ? lc(lang, "Invalid assignment — check ward/area/booth match", "தவறான ஒதுக்கீடு — வட்டாரம்/பகுதி/வாக்குச்சாவடி பொருத்தத்தை சரிபார்க்கவும்") : msg);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adminUpdateVolunteerAssignment(id, { isActive }, { headers: authHeaders(token) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["volunteer-assignments"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminDeleteVolunteerAssignment(id, { headers: authHeaders(token) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["volunteer-assignments"] }),
  });

  const items = data?.items ?? [];
  const filtered = search
    ? items.filter(i =>
        (i.volunteerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.wardName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.areaName ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  function submitCreate() {
    setCreateError("");
    if (!newVolId) { setCreateError(lc(lang, "Pick a volunteer", "ஒரு தன்னார்வலரைத் தேர்ந்தெடுக்கவும்")); return; }
    if (newWardId === "none" && newAreaId === "none" && newBoothId === "none") {
      setCreateError(lc(lang, "Pick at least a ward, area or booth scope", "குறைந்தது ஒரு வட்டாரம், பகுதி அல்லது வாக்குச்சாவடி வரம்பைத் தேர்ந்தெடுக்கவும்")); return;
    }
    createMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filterWardId} onValueChange={setFilterWardId}>
              <SelectTrigger className="w-56 h-9 text-sm"><SelectValue placeholder={lc(lang, "Ward", "வட்டாரம்")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lc(lang, "All wards", "எல்லா வட்டாரங்களும்")}</SelectItem>
                {wardList.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm w-64"
                placeholder={lc(lang, "Search by volunteer / ward…", "தன்னார்வலர் / வட்டாரம் மூலம் தேடு…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-9">
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : lc(lang, "Refresh", "புதுப்பி")}
              </Button>
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="bg-primary text-white hover:bg-primary/90 gap-1.5 h-9"
                data-testid="button-new-volunteer-assignment"
              >
                <Plus className="w-4 h-4" /> {lc(lang, "Assign volunteer", "தன்னார்வலரை ஒதுக்கு")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {[lc(lang, "Volunteer", "தன்னார்வலர்"), lc(lang, "Phone", "தொலைபேசி"), lc(lang, "Ward", "வட்டாரம்"), lc(lang, "Area", "பகுதி"), lc(lang, "Booth", "வாக்குச்சாவடி"), lc(lang, "Active", "செயலில்"), lc(lang, "Created", "உருவாக்கப்பட்டது"), ""].map((h, idx) => (
                    <th key={idx} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{a.volunteerName ?? `Volunteer #${a.volunteerId}`}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{a.volunteerPhone ?? "—"}</td>
                    <td className="px-4 py-3">{a.wardName ?? "—"}</td>
                    <td className="px-4 py-3">{a.areaName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {a.pollingStationId
                        ? <span className="text-xs">#{a.boothNo} {a.boothName}</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={a.isActive ? "border-green-500 text-green-700" : "border-gray-400 text-gray-500"}>
                        {a.isActive ? lc(lang, "Active", "செயலில்") : lc(lang, "Paused", "இடைநிறுத்தம்")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                          onClick={() => toggleMutation.mutate({ id: a.id, isActive: !a.isActive })}
                          disabled={toggleMutation.isPending}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {a.isActive ? lc(lang, "Pause", "இடைநிறுத்து") : lc(lang, "Activate", "செயல்படுத்து")}
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(lc(lang, "Delete this assignment?", "இந்த ஒதுக்கீட்டை நீக்கவா?"))) deleteMutation.mutate(a.id); }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-12">
                    {isFetching ? lc(lang, "Loading…", "ஏற்றுகிறது…") : lc(lang, "No volunteer assignments yet.", "இன்னும் தன்னார்வலர் ஒதுக்கீடுகள் இல்லை.")}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{lc(lang, "Assign Volunteer", "தன்னார்வலரை ஒதுக்கு")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">{lc(lang, "Volunteer *", "தன்னார்வலர் *")}</label>
              <Select value={newVolId} onValueChange={setNewVolId}>
                <SelectTrigger data-testid="select-volunteer"><SelectValue placeholder={lc(lang, "Pick volunteer…", "தன்னார்வலரைத் தேர்ந்தெடு…")} /></SelectTrigger>
                <SelectContent>
                  {volunteers.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.name} · {v.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {volunteers.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">{lc(lang, "No approved volunteers found.", "அங்கீகரிக்கப்பட்ட தன்னார்வலர்கள் இல்லை.")}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{lc(lang, "Ward", "வட்டாரம்")}</label>
              <Select value={newWardId} onValueChange={setNewWardId}>
                <SelectTrigger><SelectValue placeholder={lc(lang, "Pick ward…", "வட்டாரத்தைத் தேர்ந்தெடு…")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{lc(lang, "— None —", "— எதுவுமில்லை —")}</SelectItem>
                  {wardList.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newWardIdNum && areaOpts.length > 0 && (
              <div>
                <label className="text-xs font-medium block mb-1">{lc(lang, "Area (optional)", "பகுதி (விருப்பத்தேர்வு)")}</label>
                <Select value={newAreaId} onValueChange={setNewAreaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lc(lang, "— None —", "— எதுவுமில்லை —")}</SelectItem>
                    {areaOpts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newWardIdNum && boothOpts.length > 0 && (
              <div>
                <label className="text-xs font-medium block mb-1">{lc(lang, "Booth (optional)", "வாக்குச்சாவடி (விருப்பத்தேர்வு)")}</label>
                <Select value={newBoothId} onValueChange={setNewBoothId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lc(lang, "— None —", "— எதுவுமில்லை —")}</SelectItem>
                    {boothOpts.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>#{b.boothNo} — {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {createError && (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{createError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{lc(lang, "Cancel", "ரத்து")}</Button>
            <Button
              onClick={submitCreate}
              disabled={createMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90"
              data-testid="button-confirm-volunteer-assignment"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : lc(lang, "Assign", "ஒதுக்கு")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoutingLogTable({ token }: { token: string }) {
  const { lang } = useLanguage();
  const { data, isFetching } = useQuery({
    queryKey: ["routing-log"],
    queryFn: () => adminListRoutingLog({ limit: 100 }, { headers: authHeaders(token) }),
    staleTime: 30_000,
  });
  const items = data?.items ?? [];
  if (isFetching && items.length === 0) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }
  if (items.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">{lc(lang, "No routing log entries yet.", "இன்னும் வழிமாற்று பதிவு உள்ளீடுகள் இல்லை.")}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="border-b">
        <tr className="text-xs uppercase text-muted-foreground">
          <th className="text-left py-2 px-2">{lc(lang, "When", "எப்போது")}</th>
          <th className="text-left py-2 px-2">{lc(lang, "Grievance", "புகார்")}</th>
          <th className="text-left py-2 px-2">{lc(lang, "Reason", "காரணம்")}</th>
          <th className="text-left py-2 px-2">{lc(lang, "Scope", "வரம்பு")}</th>
          <th className="text-left py-2 px-2">{lc(lang, "From → To", "இருந்து → வரை")}</th>
          <th className="text-left py-2 px-2">{lc(lang, "By", "செய்தவர்")}</th>
          <th className="text-left py-2 px-2">{lc(lang, "Note", "குறிப்பு")}</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.map(r => (
          <tr key={r.id}>
            <td className="py-2 px-2 text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
            <td className="py-2 px-2 font-mono text-xs">#{r.grievanceId}</td>
            <td className="py-2 px-2">
              <Badge className={REASON_BADGE[r.reason] ?? "bg-muted"}>{r.reason}</Badge>
            </td>
            <td className="py-2 px-2 text-xs">{r.matchedScope}{r.matchedScopeId ? `:${r.matchedScopeId}` : ""}</td>
            <td className="py-2 px-2 text-xs">{r.fromOfficerId ?? "—"} → {r.toOfficerId ?? "—"}</td>
            <td className="py-2 px-2 text-xs">{r.changedByName}</td>
            <td className="py-2 px-2 text-xs text-muted-foreground">{r.note ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
