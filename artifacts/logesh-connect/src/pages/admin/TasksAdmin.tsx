import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { adminApi } from "./api";
import { type Language } from "@/lib/i18n";
import { tTask } from "@/lib/i18n";

const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
const CATEGORIES = ["follow_up", "visit_prep", "grievance_action", "content", "official", "personal"] as const;
const LINK_TYPES = ["grievance", "appointment", "event"] as const;

export interface AdminTask {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  category: string;
  assignedTo: number | null;
  assigneeName: string | null;
  createdBy: number | null;
  linkedEntityType: string | null;
  linkedEntityId: number | null;
  reminderAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Assignee { id: number; name: string; role: string }

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_STYLE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500 line-through",
};

function emptyTask(): Partial<AdminTask> {
  return { title: "", priority: "medium", status: "todo", category: "follow_up" };
}

function toDateInput(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** A task is overdue if its due date is before today's date and it isn't finished. */
function isOverdue(t: AdminTask): boolean {
  if (!t.dueDate || t.status === "done" || t.status === "cancelled") return false;
  const due = new Date(t.dueDate);
  const today = new Date();
  due.setHours(23, 59, 59, 999);
  return due.getTime() < today.getTime();
}

function isDueToday(t: AdminTask): boolean {
  if (!t.dueDate) return false;
  const due = new Date(t.dueDate);
  const today = new Date();
  return due.getFullYear() === today.getFullYear()
    && due.getMonth() === today.getMonth()
    && due.getDate() === today.getDate();
}

// ───────────────────────────────────────────────────────────
// Main page
// ───────────────────────────────────────────────────────────
export default function TasksAdmin({ lang = "ta" }: { lang?: Language }) {
  const [tab, setTab] = useState<"mine" | "all">("all");
  const [rows, setRows] = useState<AdminTask[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<AdminTask> | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const tt = useCallback((k: Parameters<typeof tTask>[1]) => tTask(lang, k), [lang]);

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const params: { mine?: boolean; status?: string; assignedTo?: number } = {};
      if (tab === "mine") params.mine = true;
      if (statusFilter !== "all") params.status = statusFilter;
      if (tab === "all" && assigneeFilter !== "all") params.assignedTo = Number(assigneeFilter);
      const r = await adminApi.getTasks(params);
      setRows(r.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load tasks");
    } finally { setLoading(false); }
  }, [tab, statusFilter, assigneeFilter]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    adminApi.getTaskAssignees().then((r) => setAssignees(r.items ?? [])).catch(() => null);
  }, []);

  async function save() {
    if (!editing?.title) return;
    setErr(null);
    try {
      const payload = {
        title: editing.title,
        description: editing.description ?? null,
        dueDate: editing.dueDate ? new Date(editing.dueDate).toISOString() : null,
        dueTime: editing.dueTime || null,
        priority: editing.priority ?? "medium",
        status: editing.status ?? "todo",
        category: editing.category ?? "follow_up",
        assignedTo: editing.assignedTo ?? null,
        linkedEntityType: editing.linkedEntityType ?? null,
        linkedEntityId: editing.linkedEntityId ?? null,
      };
      if (editing.id) await adminApi.updateTask(editing.id, payload);
      else await adminApi.createTask(payload);
      setEditing(null);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
  }

  async function toggleDone(t: AdminTask) {
    const next = t.status === "done" ? "todo" : "done";
    try {
      await adminApi.updateTask(t.id, { status: next });
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Update failed"); }
  }

  async function setStatus(t: AdminTask, status: string) {
    try { await adminApi.updateTask(t.id, { status }); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Update failed"); }
  }

  async function remove(id: number) {
    if (!window.confirm(tt("deleteConfirm"))) return;
    await adminApi.deleteTask(id);
    reload();
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">{tt("tasksTitle")}</h2>
          <p className="text-sm text-muted-foreground">{tt("tasksSubtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {tt("refresh")}
          </Button>
          <Button size="sm" onClick={() => setEditing(emptyTask())}>
            <Plus className="w-4 h-4 mr-1" /> {tt("addTask")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["all", "mine"] as const).map((tk) => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === tk ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tasks-tab-${tk}`}
          >
            {tk === "all" ? tt("teamTasks") : tt("myTasks")}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("allStatuses")}</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{tt(`status_${s}` as never)}</SelectItem>)}
          </SelectContent>
        </Select>
        {tab === "all" && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tt("allAssignees")}</SelectItem>
              {assignees.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded p-6 text-center">{tt("noTasks")}</div>
      ) : (
        <div className="grid gap-2">
          {sorted.map((t) => {
            const overdue = isOverdue(t);
            const done = t.status === "done";
            return (
              <div
                key={t.id}
                data-testid={`task-row-${t.id}`}
                className={`border rounded-md p-3 bg-white flex items-start gap-3 ${overdue ? "border-red-300 bg-red-50/40" : ""}`}
              >
                <button
                  onClick={() => toggleDone(t)}
                  title={tt("toggleDone")}
                  data-testid={`task-done-${t.id}`}
                  className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    done ? "bg-green-600 border-green-600 text-white" : "border-gray-300 hover:border-green-500"
                  }`}
                >
                  {done && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`font-medium text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLE[t.priority] ?? ""}`}>{tt(`priority_${t.priority}` as never)}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{tt(`category_${t.category}` as never)}</Badge>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
                        <AlertTriangle className="w-3 h-3" /> {tt("overdue")}
                      </span>
                    )}
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                    {t.dueDate && (
                      <span className={overdue ? "text-red-600 font-medium" : ""}>
                        {tt("due")}: {new Date(t.dueDate).toLocaleDateString()}{t.dueTime ? ` ${t.dueTime}` : ""}
                      </span>
                    )}
                    {t.assigneeName && <span>{tt("assignee")}: {t.assigneeName}</span>}
                  </div>
                </div>
                <Select value={t.status} onValueChange={(v) => setStatus(t, v)}>
                  <SelectTrigger className={`w-32 h-7 text-xs ${STATUS_STYLE[t.status] ?? ""}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{tt(`status_${s}` as never)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => setEditing(t)} data-testid={`task-edit-${t.id}`}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remove(t.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="task-editor">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing.id ? tt("editTask") : tt("newTask")}</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{tt("fieldTitle")}</Label>
              <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} data-testid="task-input-title" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tt("fieldDescription")}</Label>
              <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{tt("fieldDueDate")}</Label>
                <Input type="date" value={toDateInput(editing.dueDate)} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tt("fieldDueTime")}</Label>
                <Input type="time" value={editing.dueTime ?? ""} onChange={(e) => setEditing({ ...editing, dueTime: e.target.value || null })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{tt("fieldPriority")}</Label>
                <Select value={editing.priority ?? "medium"} onValueChange={(v) => setEditing({ ...editing, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{tt(`priority_${p}` as never)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tt("fieldStatus")}</Label>
                <Select value={editing.status ?? "todo"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{tt(`status_${s}` as never)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tt("fieldCategory")}</Label>
              <Select value={editing.category ?? "follow_up"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{tt(`category_${c}` as never)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tt("fieldAssignee")}</Label>
              <Select value={editing.assignedTo ? String(editing.assignedTo) : "none"} onValueChange={(v) => setEditing({ ...editing, assignedTo: v === "none" ? null : Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt("unassigned")}</SelectItem>
                  {assignees.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{tt("fieldLinkType")}</Label>
                <Select value={editing.linkedEntityType ?? "none"} onValueChange={(v) => setEditing({ ...editing, linkedEntityType: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tt("noLink")}</SelectItem>
                    {LINK_TYPES.map((l) => <SelectItem key={l} value={l}>{tt(`link_${l}` as never)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tt("fieldLinkId")}</Label>
                <Input type="number" value={editing.linkedEntityId ?? ""} onChange={(e) => setEditing({ ...editing, linkedEntityId: e.target.value ? Number(e.target.value) : null })} disabled={!editing.linkedEntityType} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>{tt("cancel")}</Button>
              <Button size="sm" onClick={save} disabled={!editing.title} data-testid="task-save">{tt("save")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// PA Home widget: "My Tasks Today" (due today + overdue)
// ───────────────────────────────────────────────────────────
export function MyTasksWidget({ lang = "ta" }: { lang?: Language }) {
  const [rows, setRows] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(true);
  const tt = useCallback((k: Parameters<typeof tTask>[1]) => tTask(lang, k), [lang]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getTasks({ mine: true });
      setRows(r.items ?? []);
    } catch { /* non-fatal */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const relevant = useMemo(
    () => rows.filter((t) => t.status !== "done" && t.status !== "cancelled" && (isOverdue(t) || isDueToday(t))),
    [rows],
  );

  async function markDone(t: AdminTask) {
    try { await adminApi.updateTask(t.id, { status: "done" }); reload(); } catch { /* ignore */ }
  }

  async function defer(t: AdminTask) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    try { await adminApi.updateTask(t.id, { dueDate: tomorrow.toISOString() }); reload(); } catch { /* ignore */ }
  }

  return (
    <div className="border rounded-lg bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{tt("myTasksToday")}</h3>
        <span className="text-xs text-muted-foreground">{relevant.length}</span>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : relevant.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tt("noTasksToday")}</p>
      ) : (
        <div className="space-y-2">
          {relevant.map((t) => {
            const overdue = isOverdue(t);
            return (
              <div key={t.id} className={`flex items-center gap-2 text-sm p-2 rounded border ${overdue ? "border-red-200 bg-red-50/50" : "border-gray-100"}`}>
                <div className="flex-1 min-w-0">
                  <span className="truncate block">{t.title}</span>
                  <span className={`text-[10px] ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {overdue ? tt("overdue") : tt("dueTodayLabel")}
                  </span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-green-700" onClick={() => markDone(t)}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => defer(t)}>
                  {tt("defer")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
