import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SectionHeader } from "@/components/SectionHeader";
import {
  ChevronLeft, ChevronRight, RefreshCw, Loader2, CheckCircle,
  Clock, AlertTriangle, MessageSquare, Filter, X, Paperclip, Users,
  ListChecks, CalendarRange, FileDown, FileText, Inbox, UserCheck, UserX, Search,
  Image, Video, Music, MapPin, ExternalLink, Download, Globe, Building2,
} from "lucide-react";
import type { Language } from "@/lib/i18n";
import {
  listGrievances,
  updateGrievanceStatus,
  addGrievanceRemark,
  assignGrievance,
  listGrievanceOfficers,
  updateGrievancePriority,
} from "@workspace/api-client-react";
import type { GrievanceListItem } from "@workspace/api-client-react";
import { useWards } from "@/lib/useWards";
import WardCombobox from "@/components/WardCombobox";

interface GrievanceOfficerProps { lang: Language; token: string; userRole?: string }

// Full staff-view detail type — includes internal remarks and attachments
interface StaffGrievanceDetail {
  id: number;
  ticketNo: string;
  name: string;
  phone: string;
  email: string | null;
  category: string;
  description: string;
  address: string | null;
  ward: string | null;
  constituency: string;
  priority: string;
  status: string;
  anonymous: boolean;
  assignedTo: number | null;
  voterId: number | null;
  voter: {
    id: number;
    epicNumber: string;
    fullName: string;
    pollingStationId: number | null;
    boothNo: string | null;
    boothName: string | null;
  } | null;
  latitude: number | null;
  longitude: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  remarks: Array<{
    id: number;
    grievanceId: number;
    remark: string;
    isPublic: boolean;
    authorId: number | null;
    authorName: string;
    createdAt: string;
  }>;
  statusLog: Array<{
    id: number;
    grievanceId: number;
    fromStatus: string | null;
    toStatus: string;
    changedBy: number | null;
    changedByName: string;
    note: string | null;
    createdAt: string;
  }>;
  attachments: Array<{
    id: number;
    grievanceId: number;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number | null;
    createdAt: string;
  }>;
}

const STATUS_OPTS = ["", "Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Closed"];
const PRIORITY_OPTS = ["", "Low", "Medium", "High", "Urgent"];
const CATEGORY_OPTS = ["", "Roads", "Water Supply", "EB / Electricity Issues", "Sewage",
  "Healthcare", "Education", "Women Safety", "Corruption", "Ration", "Transport",
  "Pension", "Housing", "Agriculture", "Employment", "Others"];

const STATUS_COLORS: Record<string, string> = {
  "Submitted": "bg-blue-100 text-blue-700",
  "Under Review": "bg-yellow-100 text-yellow-700",
  "Assigned": "bg-purple-100 text-purple-700",
  "In Progress": "bg-orange-100 text-orange-700",
  "Resolved": "bg-green-100 text-green-700",
  "Closed": "bg-gray-100 text-gray-700",
};
const PRIORITY_COLORS: Record<string, string> = {
  "Low": "bg-gray-100 text-gray-600",
  "Medium": "bg-blue-100 text-blue-600",
  "High": "bg-orange-100 text-orange-700",
  "Urgent": "bg-red-100 text-red-700",
};

function makeAuthHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/** Fetch full staff detail (all remarks, attachments) for a grievance by id. */
async function fetchStaffDetail(id: number, token: string): Promise<StaffGrievanceDetail> {
  const res = await fetch(`/api/grievances/${id}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to load detail: ${res.status}`);
  return res.json() as Promise<StaffGrievanceDetail>;
}

export default function GrievanceOfficer({ lang, token, userRole = "" }: GrievanceOfficerProps) {
  // Officers default to their own inbox; admins/coordinators default to all.
  const isOfficer = userRole === "grievance_officer";
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterWard, setFilterWard] = useState("");
  const [filterConstituency, setFilterConstituency] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  // "Mine" toggle: when on, list is restricted to grievances assigned to the current officer.
  // Default ON for grievance_officer role, OFF for broader admin roles.
  const [mineOnly, setMineOnly] = useState(isOfficer);
  // userRole is loaded async from /me — when it arrives and the user is a
  // grievance officer, snap the toggle ON so they default to "Mine" instead
  // of falling through to the all=1 inbox.
  const [userTouchedToggle, setUserTouchedToggle] = useState(false);
  useEffect(() => {
    if (!userTouchedToggle && isOfficer) setMineOnly(true);
  }, [isOfficer, userTouchedToggle]);
  const { data: wardList = [] } = useWards();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssignId, setBulkAssignId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selected, setSelected] = useState<GrievanceListItem | null>(null);
  const [detail, setDetail] = useState<StaffGrievanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [remarkPublic, setRemarkPublic] = useState(true);
  const [assignOfficerId, setAssignOfficerId] = useState<string>("");
  const [assignNote, setAssignNote] = useState("");
  const [newPriority, setNewPriority] = useState("");

  const { data: officersData } = useQuery({
    queryKey: ["grievance-officers"],
    queryFn: () => listGrievanceOfficers({ headers: makeAuthHeaders(token) }),
    staleTime: 60_000,
  });

  const params = {
    page,
    limit: 20,
    ...(filterStatus && { status: filterStatus }),
    ...(filterCategory && { category: filterCategory }),
    ...(filterPriority && { priority: filterPriority }),
    ...(filterWard && { ward: filterWard }),
    ...(filterConstituency && { constituency: filterConstituency }),
    ...(filterDateFrom && { dateFrom: filterDateFrom }),
    ...(filterDateTo && { dateTo: filterDateTo }),
    ...(mineOnly ? { mine: "1" } : (isOfficer ? { all: "1" } : {})),
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["grievances-list", params],
    queryFn: () => listGrievances(params, { headers: makeAuthHeaders(token) }),
    staleTime: 30_000,
  });

  // Deep-link from VotersAdmin: when a voter's grievance is clicked,
  // it stashes the grievance id in sessionStorage and navigates to
  // #grievances. We pick it up on mount and open the detail dialog.
  useEffect(() => {
    const pending = sessionStorage.getItem("openGrievanceId");
    if (!pending) return;
    sessionStorage.removeItem("openGrievanceId");
    const gid = parseInt(pending, 10);
    if (!Number.isFinite(gid) || gid <= 0) return;
    (async () => {
      try {
        const d = await fetchStaffDetail(gid, token);
        setSelected({
          id: d.id, ticketNo: d.ticketNo, name: d.name, phone: d.phone,
          category: d.category, status: d.status, priority: d.priority,
          ward: d.ward, constituency: d.constituency, anonymous: d.anonymous,
          createdAt: d.createdAt, updatedAt: d.updatedAt,
        });
        setDetail(d);
      } catch (err) {
        console.error("Deep-link grievance open failed:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshDetail(id: number) {
    try {
      const d = await fetchStaffDetail(id, token);
      setDetail(d);
    } catch (err) {
      console.error("Detail refresh failed:", err);
    }
  }

  async function openDetail(item: GrievanceListItem) {
    setSelected(item);
    setDetail(null);
    setDetailLoading(true);
    setNewStatus(item.status);
    setNewPriority(item.priority);
    setStatusNote("");
    setRemarkText("");
    setAssignOfficerId("");
    setAssignNote("");
    try {
      const d = await fetchStaffDetail(item.id, token);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }

  const statusMutation = useMutation({
    mutationFn: () =>
      updateGrievanceStatus(
        selected!.id,
        { status: newStatus as StaffGrievanceDetail["status"], note: statusNote || null },
        { headers: makeAuthHeaders(token) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grievances-list"] });
      const updatedItem = { ...selected!, status: newStatus };
      setSelected(updatedItem as GrievanceListItem);
      setStatusNote("");
      refreshDetail(selected!.id);
    },
  });

  const remarkMutation = useMutation({
    mutationFn: () =>
      addGrievanceRemark(selected!.id, { remark: remarkText, isPublic: remarkPublic },
        { headers: makeAuthHeaders(token) }),
    onSuccess: () => {
      setRemarkText("");
      refreshDetail(selected!.id);
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => {
      const officer = officersData?.officers.find((o) => String(o.id) === assignOfficerId);
      return assignGrievance(
        selected!.id,
        { officerId: officer!.id, officerName: officer!.name, note: assignNote.trim() || null },
        { headers: makeAuthHeaders(token) }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grievances-list"] });
      const updated = { ...selected!, status: "Assigned" };
      setSelected(updated as GrievanceListItem);
      setAssignOfficerId("");
      setAssignNote("");
      refreshDetail(selected!.id);
    },
  });

  const priorityMutation = useMutation({
    mutationFn: () =>
      updateGrievancePriority(
        selected!.id,
        { priority: newPriority as "Low" | "Medium" | "High" | "Urgent" },
        { headers: makeAuthHeaders(token) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grievances-list"] });
      const updated = { ...selected!, priority: newPriority };
      setSelected(updated as GrievanceListItem);
      refreshDetail(selected!.id);
    },
  });

  function clearFilters() {
    setFilterStatus(""); setFilterCategory(""); setFilterPriority("");
    setFilterWard(""); setFilterConstituency(""); setFilterDateFrom(""); setFilterDateTo(""); setPage(1);
  }
  const hasFilters = filterStatus || filterCategory || filterPriority || filterWard || filterConstituency || filterDateFrom || filterDateTo;

  async function exportCSV() {
    const res = await fetch("/api/admin/grievances/export", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grievances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  async function exportPDF(opts?: { ids?: number[]; ticketHint?: string }) {
    if (exportingPdf) return;
    const items = data?.items ?? [];
    // Priority:
    //   1. explicit ids passed in (per-row / detail-panel download)
    //   2. checkbox selections (across pages)
    //   3. current filtered page
    type Target = { id: number; ticketNo?: string; name?: string; category?: string; status?: string; priority?: string; createdAt?: string };
    const sourceIds = opts?.ids
      ? opts.ids
      : selectedIds.size > 0
        ? Array.from(selectedIds)
        : null;
    const targets: Target[] = sourceIds
      ? sourceIds.map(id => items.find(i => i.id === id) ?? { id })
      : items;
    if (targets.length === 0) {
      alert(lang === "ta" ? "ஏற்றுமதி செய்ய புகார்கள் இல்லை" : "No grievances to export");
      return;
    }
    if (targets.length > 50) {
      const ok = confirm(
        lang === "ta"
          ? `${targets.length} புகார்களை ஏற்றுமதி செய்ய சில நிமிடங்கள் ஆகலாம். தொடரவா?`
          : `Exporting ${targets.length} grievances may take a few minutes. Continue?`
      );
      if (!ok) return;
    }

    setExportingPdf(true);
    setExportProgress({ done: 0, total: targets.length });

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const M = 14;
      const contentW = pageW - M * 2;
      const HEADER_H = 22;        // red banner height
      const CONTENT_TOP = 30;     // first usable y below banner
      const FOOTER_Y = pageH - 8;
      const FOOTER_LIMIT = pageH - 14;
      const generatedAt = new Date().toLocaleString("en-IN");
      const origin = (typeof window !== "undefined" && window.location?.origin) ? window.location.origin : "";

      type MapTiles = {
        cols: number;
        rows: number;
        tileSize: number;
        tiles: Array<{ col: number; row: number; dataUrl: string }>;
        markerPx: { x: number; y: number };
        attribution: string;
      };
      type Assets = {
        mapTiles: MapTiles | null;
        latitude: number | null;
        longitude: number | null;
        imageAttachments: Array<{ id: number; fileName: string; fileType: string; kind?: "JPEG" | "PNG" | "WEBP"; dataUrl: string; sizeBytes?: number }>;
        nonImageAttachments?: Array<{ id: number; fileName: string; fileType: string; fileSize: number | null; fileUrl: string }>;
        nonImageCount: number;
        skippedImageCount?: number;
      };

      // Fetch all details + assets up-front
      const records: Array<{ detail: StaffGrievanceDetail; assets: Assets | null }> = [];
      for (let i = 0; i < targets.length; i++) {
        setExportProgress({ done: i, total: targets.length });
        try {
          const [d, a] = await Promise.all([
            fetchStaffDetail(targets[i].id, token),
            fetch(`/api/grievances/${targets[i].id}/pdf-assets`, { headers: makeAuthHeaders(token) })
              .then(r => r.ok ? r.json() as Promise<Assets> : null)
              .catch(() => null),
          ]);
          // Diagnostic — visible in DevTools so a user can confirm the
          // backend really did return images / map tiles for this grievance.
          console.log(`[pdf] ${d.ticketNo}: images=${a?.imageAttachments?.length ?? 0}, nonImages=${a?.nonImageAttachments?.length ?? 0}, mapTiles=${a?.mapTiles?.tiles?.length ?? 0}, skippedImages=${a?.skippedImageCount ?? 0}`);
          records.push({ detail: d, assets: a });
        } catch (err) {
          console.warn(`[pdf] failed to load grievance ${targets[i].id}:`, err);
        }
      }
      setExportProgress({ done: targets.length, total: targets.length });

      if (records.length === 0) {
        alert(lang === "ta" ? "எந்த புகாரும் ஏற்றப்படவில்லை" : "Could not load any grievance details");
        return;
      }

      const formatFromMime = (mime: string): "JPEG" | "PNG" | "WEBP" => {
        if (mime.includes("png")) return "PNG";
        if (mime.includes("webp")) return "WEBP";
        return "JPEG";
      };

      // Color tables for status pills (RGB)
      const STATUS_RGB: Record<string, [number, number, number]> = {
        "Submitted":    [59, 130, 246],
        "Under Review": [202, 138, 4],
        "Assigned":     [147, 51, 234],
        "In Progress":  [234, 88, 12],
        "Resolved":     [22, 163, 74],
        "Closed":       [75, 85, 99],
      };
      const PRIORITY_RGB: Record<string, [number, number, number]> = {
        "Low":    [107, 114, 128],
        "Medium": [59, 130, 246],
        "High":   [234, 88, 12],
        "Urgent": [220, 38, 38],
      };
      const CATEGORY_RGB: [number, number, number] = [55, 65, 81];

      // Draw a coloured pill at (x, y) and return its right edge.
      function drawPill(x: number, y: number, label: string, rgb: [number, number, number]): number {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        const padX = 3;
        const w = doc.getTextWidth(label) + padX * 2;
        const h = 5.5;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.roundedRect(x, y, w, h, 1.4, 1.4, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(label, x + padX, y + h - 1.6);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        return x + w;
      }

      // Track which grievance owns which page range so the post-process
      // pass can stamp the right ticket # on the header/footer.
      const pageRanges: Array<{ ticketNo: string; firstPage: number; lastPage: number }> = [];
      const moveToNewPage = () => {
        doc.addPage();
        if (pageRanges.length) pageRanges[pageRanges.length - 1].lastPage = doc.getNumberOfPages();
        return CONTENT_TOP;
      };
      const ensureSpace = (y: number, needed: number): number => {
        if (y + needed > FOOTER_LIMIT) return moveToNewPage();
        return y;
      };

      // ── Render each grievance ────────────────────────────────────
      for (let i = 0; i < records.length; i++) {
        const { detail, assets } = records[i];

        if (i === 0) {
          // First grievance uses page 1 (already created by jsPDF)
          pageRanges.push({ ticketNo: detail.ticketNo, firstPage: 1, lastPage: 1 });
        } else {
          doc.addPage();
          pageRanges.push({
            ticketNo: detail.ticketNo,
            firstPage: doc.getNumberOfPages(),
            lastPage: doc.getNumberOfPages(),
          });
        }

        let y = CONTENT_TOP;

        // Status pills row
        const statusRgb = STATUS_RGB[detail.status] ?? [107, 114, 128];
        const priorityRgb = PRIORITY_RGB[detail.priority] ?? [107, 114, 128];
        let pillX = M;
        pillX = drawPill(pillX, y, detail.status, statusRgb) + 3;
        pillX = drawPill(pillX, y, `${detail.priority} priority`, priorityRgb) + 3;
        drawPill(pillX, y, detail.category, CATEGORY_RGB);
        y += 9;

        // District derived from constituency (no district column in schema)
        const district = detail.constituency === "Rasipuram" ? "Namakkal" : "—";

        // Petitioner & filing details table
        autoTable(doc, {
          startY: y,
          head: [["Field", "Value"]],
          body: [
            ["Name",          detail.anonymous ? "(Anonymous)" : detail.name],
            ["Phone",         detail.anonymous ? "—" : detail.phone],
            ["Email",         detail.email || "—"],
            ["Filed",         new Date(detail.createdAt).toLocaleString("en-IN")],
            ["Last updated",  new Date(detail.updatedAt).toLocaleString("en-IN")],
            ["Resolved",      detail.resolvedAt ? new Date(detail.resolvedAt).toLocaleString("en-IN") : "—"],
            ["Scope",         detail.constituency === "Tamil Nadu" ? "Tamil Nadu State (Commercial Taxes)" : "Rasipuram Constituency"],
            ["District",      district],
            ["Constituency",  detail.constituency],
            ["Ward",          detail.ward || "—"],
            ["Address",       detail.address || "—"],
            ["Linked voter",  detail.voter ? `${detail.voter.fullName} (EPIC: ${detail.voter.epicNumber})${detail.voter.boothNo ? ` — Booth #${detail.voter.boothNo}${detail.voter.boothName ? " " + detail.voter.boothName : ""}` : ""}` : "Not linked"],
          ],
          styles: { fontSize: 8.5, cellPadding: 1.6, valign: "top" },
          headStyles: { fillColor: [201, 24, 30], fontSize: 9 },
          columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" }, 1: { cellWidth: contentW - 36 } },
          margin: { left: M, right: M, top: CONTENT_TOP, bottom: 14 },
          didDrawPage: () => {
            if (pageRanges.length) pageRanges[pageRanges.length - 1].lastPage = doc.getNumberOfPages();
          },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

        // Description (paginated)
        y = ensureSpace(y, 10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
        doc.text("Grievance description", M, y);
        y += 5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
        const descLines = doc.splitTextToSize(detail.description || "—", contentW - 4);
        const lineH = 4.4;
        let idx = 0;
        while (idx < descLines.length) {
          const remaining = FOOTER_LIMIT - y - 4;
          const fitLines = Math.max(1, Math.floor(remaining / lineH));
          const chunk = descLines.slice(idx, idx + fitLines);
          doc.setFillColor(246, 246, 246);
          doc.rect(M, y - 3.6, contentW, chunk.length * lineH + 4, "F");
          doc.text(chunk, M + 2, y);
          idx += chunk.length;
          y += chunk.length * lineH + 4;
          if (idx < descLines.length) y = moveToNewPage();
        }
        y += 2;

        // GPS Location
        if (detail.latitude != null && detail.longitude != null) {
          y = ensureSpace(y, 100);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
          doc.text("GPS Location", M, y);
          y += 5;
          doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
          doc.text(
            `Latitude: ${detail.latitude.toFixed(6)}     Longitude: ${detail.longitude.toFixed(6)}`,
            M, y,
          );
          y += 5;
          if (assets?.mapTiles && assets.mapTiles.tiles.length > 0) {
            const mt = assets.mapTiles;
            const compositePx = { w: mt.cols * mt.tileSize, h: mt.rows * mt.tileSize };
            // Fit the composite into a 117mm × 78mm box (preserves 3:2 aspect)
            const maxW = 117, maxH = 78;
            const scale = Math.min(maxW / compositePx.w, maxH / compositePx.h);
            const mapW = compositePx.w * scale;
            const mapH = compositePx.h * scale;
            const mmPerPx = scale;
            y = ensureSpace(y, mapH + 10);
            const mapX = M;
            const mapY = y;
            // Border / background so missing tiles don't show white gaps
            doc.setFillColor(235, 235, 235);
            doc.rect(mapX, mapY, mapW, mapH, "F");
            // Place each tile at its (col, row) offset
            const tileMm = mt.tileSize * mmPerPx;
            for (const t of mt.tiles) {
              try {
                doc.addImage(
                  t.dataUrl, "PNG",
                  mapX + t.col * tileMm,
                  mapY + t.row * tileMm,
                  tileMm, tileMm,
                  undefined, "FAST",
                );
              } catch {
                // Tile failed to decode — leave grey background
              }
            }
            // Draw the marker (red dot with white halo) on top
            const mx = mapX + mt.markerPx.x * mmPerPx;
            const my = mapY + mt.markerPx.y * mmPerPx;
            doc.setFillColor(255, 255, 255);
            doc.circle(mx, my, 1.8, "F");
            doc.setFillColor(220, 38, 38);
            doc.circle(mx, my, 1.2, "F");
            // Map border
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.2);
            doc.rect(mapX, mapY, mapW, mapH);
            // Attribution
            doc.setFontSize(6.5); doc.setTextColor(80, 80, 80);
            doc.text(mt.attribution, mapX + mapW, mapY + mapH + 3, { align: "right" });
            doc.setTextColor(0, 0, 0);
            y += mapH + 6;
          } else {
            doc.setTextColor(120, 120, 120);
            doc.text("(Static map preview unavailable — use the link below)", M, y);
            doc.setTextColor(0, 0, 0);
            y += 5;
          }
          const mapsUrl = `https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`;
          doc.setTextColor(30, 58, 138);
          doc.textWithLink("Open in Google Maps →", M, y, { url: mapsUrl });
          doc.setTextColor(0, 0, 0);
          y += 6;
        }

        // Attachments section — ALWAYS rendered so the PDF clearly shows
        // whether photos were absent vs. failed to embed.
        const imgCount = assets?.imageAttachments?.length ?? 0;
        const nonImgCount = assets?.nonImageAttachments?.length ?? 0;
        const skipCount = assets?.skippedImageCount ?? 0;
        if (!assets) {
          y = ensureSpace(y, 10);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
          doc.text("Attachments", M, y); y += 5;
          doc.setFont("helvetica", "italic"); doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text("Could not load attachments from server.", M, y);
          doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
          y += 6;
        } else if (imgCount === 0 && nonImgCount === 0) {
          y = ensureSpace(y, 10);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
          doc.text("Attachments", M, y); y += 5;
          doc.setFont("helvetica", "italic"); doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text("No attachments were uploaded with this grievance.", M, y);
          doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
          y += 6;
        }
        if (assets && imgCount > 0) {
          y = ensureSpace(y, 50);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
          doc.text(`Attached photos (${imgCount}${skipCount ? ` of ${imgCount + skipCount}` : ""})`, M, y);
          y += 5;
          const cols = 2;
          const gap = 4;
          const imgW = (contentW - gap * (cols - 1)) / cols;
          const imgH = imgW * 0.7;
          let embedSuccesses = 0;
          let embedFailures = 0;
          for (let k = 0; k < assets.imageAttachments.length; k++) {
            const att = assets.imageAttachments[k];
            const col = k % cols;
            const x = M + col * (imgW + gap);
            if (col === 0) y = ensureSpace(y, imgH + 8);
            const fmt: "JPEG" | "PNG" | "WEBP" = att.kind ?? formatFromMime(att.fileType);
            try {
              doc.addImage(att.dataUrl, fmt, x, y, imgW, imgH);
              embedSuccesses++;
            } catch (err) {
              embedFailures++;
              console.warn(`[pdf] addImage failed for "${att.fileName}" (${fmt}):`, err);
              // Visible placeholder so the user can SEE that something failed
              doc.setFillColor(254, 226, 226);
              doc.rect(x, y, imgW, imgH, "F");
              doc.setDrawColor(220, 38, 38);
              doc.setLineWidth(0.3);
              doc.rect(x, y, imgW, imgH);
              doc.setTextColor(153, 27, 27);
              doc.setFontSize(9); doc.setFont("helvetica", "bold");
              doc.text("Image could not be embedded", x + imgW / 2, y + imgH / 2 - 2, { align: "center" });
              doc.setFont("helvetica", "normal"); doc.setFontSize(7);
              doc.text(`(${fmt}, ${att.sizeBytes ? Math.round(att.sizeBytes / 1024) + " KB" : "size unknown"})`, x + imgW / 2, y + imgH / 2 + 3, { align: "center" });
              doc.setTextColor(0, 0, 0);
            }
            doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
            const cap = doc.splitTextToSize(att.fileName, imgW);
            doc.text(cap.slice(0, 1), x, y + imgH + 3);
            if (col === cols - 1 || k === assets.imageAttachments.length - 1) {
              y += imgH + 8;
            }
          }
          console.log(`[pdf] ${detail.ticketNo}: embedded ${embedSuccesses}/${assets.imageAttachments.length} photos (${embedFailures} failed)`);
        }

        // Non-image attachments with clickable "open" links
        const nonImg = assets?.nonImageAttachments ?? [];
        if (nonImg.length > 0) {
          y = ensureSpace(y, 12);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10);
          doc.text(`Other attachments (${nonImg.length})`, M, y);
          y += 5;
          doc.setFont("helvetica", "normal"); doc.setFontSize(9);
          for (const att of nonImg) {
            y = ensureSpace(y, 5);
            const sizeKb = att.fileSize ? ` · ${Math.max(1, Math.round(att.fileSize / 1024))} KB` : "";
            const label = `• ${att.fileName} (${att.fileType}${sizeKb})  `;
            doc.text(label, M, y);
            const linkX = M + doc.getTextWidth(label);
            doc.setTextColor(30, 58, 138);
            doc.textWithLink("open", linkX, y, { url: origin + att.fileUrl });
            doc.setTextColor(0, 0, 0);
            y += 4.5;
          }
          y += 2;
        }

        // Status Timeline
        if (detail.statusLog.length > 0) {
          y = ensureSpace(y, 18);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
          doc.text(`Status timeline (${detail.statusLog.length})`, M, y);
          y += 4;
          autoTable(doc, {
            startY: y,
            head: [["When", "By", "Change", "Note"]],
            body: detail.statusLog.map(s => [
              new Date(s.createdAt).toLocaleString("en-IN"),
              s.changedByName,
              `${s.fromStatus ?? "—"} → ${s.toStatus}`,
              s.note ?? "",
            ]),
            styles: { fontSize: 8, cellPadding: 1.4 },
            headStyles: { fillColor: [201, 24, 30] },
            margin: { left: M, right: M, top: CONTENT_TOP, bottom: 14 },
            didDrawPage: () => {
              if (pageRanges.length) pageRanges[pageRanges.length - 1].lastPage = doc.getNumberOfPages();
            },
          });
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
        }

        // Remarks
        if (detail.remarks.length > 0) {
          y = ensureSpace(y, 18);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
          doc.text(`Remarks (${detail.remarks.length})`, M, y);
          y += 4;
          autoTable(doc, {
            startY: y,
            head: [["When", "Author", "Visibility", "Remark"]],
            body: detail.remarks.map(r => [
              new Date(r.createdAt).toLocaleString("en-IN"),
              r.authorName,
              r.isPublic ? "Public" : "Internal",
              r.remark,
            ]),
            styles: { fontSize: 8, cellPadding: 1.4, valign: "top" },
            columnStyles: { 3: { cellWidth: contentW - 80 } },
            headStyles: { fillColor: [201, 24, 30] },
            margin: { left: M, right: M, top: CONTENT_TOP, bottom: 14 },
            didDrawPage: () => {
              if (pageRanges.length) pageRanges[pageRanges.length - 1].lastPage = doc.getNumberOfPages();
            },
          });
        }

        // Make sure the range covers the final page reached
        pageRanges[pageRanges.length - 1].lastPage = doc.getNumberOfPages();
      }

      // ── Post-process: branded header + footer on every page ──────
      const pageCount = doc.getNumberOfPages();
      const findTicket = (page: number) => {
        const r = pageRanges.find(rg => page >= rg.firstPage && page <= rg.lastPage);
        return r?.ticketNo ?? "";
      };
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        const ticket = findTicket(p);

        // Red header band
        doc.setFillColor(201, 24, 30);
        doc.rect(0, 0, pageW, HEADER_H, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(13);
        doc.text("Logesh Connect — Grievance Report", M, 9);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
        doc.text("Office of D. Logesh Tamilselvan, Minister of Commercial Taxes, Registration and Stamp Duty", M, 14);
        doc.setFontSize(7.5);
        doc.text(`Generated: ${generatedAt}  ·  Confidential`, M, 19);
        // Ticket # top-right
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text(ticket, pageW - M, 9, { align: "right" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
        doc.text("Ticket #", pageW - M, 14, { align: "right" });
        doc.setTextColor(0, 0, 0);

        // Footer: ticket# · page X of Y
        doc.setFontSize(8); doc.setTextColor(120, 120, 120);
        const footerText = `${ticket} · page ${p} of ${pageCount}`;
        doc.text(footerText, pageW / 2, FOOTER_Y, { align: "center" });
        doc.setTextColor(0, 0, 0);
      }

      const today = new Date().toISOString().slice(0, 10);
      const filename = records.length === 1
        ? `grievance-${records[0].detail.ticketNo}.pdf`
        : opts?.ticketHint
          ? `grievance-${opts.ticketHint}.pdf`
          : `grievances-comprehensive-${today}.pdf`;
      doc.save(filename);
    } finally {
      setExportingPdf(false);
      setExportProgress(null);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageIds = (data?.items ?? []).map(i => i.id);
    if (pageIds.every(id => selectedIds.has(id))) {
      setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n; });
    }
  }

  async function applyBulkStatus() {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/grievances/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: bulkStatus }),
      });
      if (!res.ok) throw new Error("Bulk update failed");
      setSelectedIds(new Set());
      setBulkStatus("");
      qc.invalidateQueries({ queryKey: ["grievances-list"] });
    } catch (e) {
      console.error(e);
    } finally {
      setBulkLoading(false);
    }
  }

  async function applyBulkAssign() {
    if (!bulkAssignId || selectedIds.size === 0) return;
    const officer = officersData?.officers.find(o => String(o.id) === bulkAssignId);
    if (!officer) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/grievances/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedIds), officerId: officer.id, officerName: officer.name }),
      });
      if (!res.ok) throw new Error("Bulk assign failed");
      setSelectedIds(new Set());
      setBulkAssignId("");
      qc.invalidateQueries({ queryKey: ["grievances-list"] });
    } catch (e) {
      console.error(e);
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionHeader
          title={lang === "ta" ? "புகார் அலுவலர் பலகை" : "Grievance Officer Dashboard"}
          subtitle={lang === "ta" ? "புகார்களை நிர்வகிக்கவும், நிலை புதுப்பிக்கவும்" : "Manage, assign and resolve constituent grievances"}
        />
        <div className="flex gap-2 shrink-0 items-center">
          <Button
            variant={mineOnly ? "default" : "outline"}
            size="sm"
            className={`gap-1.5 h-8 ${mineOnly ? "bg-primary text-white hover:bg-primary/90" : ""}`}
            onClick={() => { setMineOnly(v => !v); setUserTouchedToggle(true); setPage(1); }}
            data-testid="mine-toggle"
          >
            <Inbox className="w-3.5 h-3.5" />
            {mineOnly
              ? (lang === "ta" ? "என் புகார்கள்" : "My Inbox")
              : (lang === "ta" ? "அனைத்து புகார்கள்" : "All Grievances")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={exportCSV}>
            <FileText className="w-3.5 h-3.5" />
            {lang === "ta" ? "CSV ஏற்றுமதி" : "Export CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => exportPDF()}
            disabled={exportingPdf}
            data-testid="export-comprehensive-pdf"
            title={
              selectedIds.size > 0
                ? `Export ${selectedIds.size} selected as comprehensive PDF (with photos & map)`
                : "Export current page as comprehensive PDF (with photos & map)"
            }
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingPdf && exportProgress
              ? (lang === "ta"
                  ? `PDF... ${exportProgress.done}/${exportProgress.total}`
                  : `Building PDF… ${exportProgress.done}/${exportProgress.total}`)
              : (lang === "ta" ? "PDF ஏற்றுமதி" : "Export PDF")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="w-4 h-4" />
              {lang === "ta" ? "வடிகட்டு:" : "Filter:"}
            </div>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder={lang === "ta" ? "நிலை" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => <SelectItem key={s || "all"} value={s || "all"}>{s || (lang === "ta" ? "அனைத்தும்" : "All")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder={lang === "ta" ? "வகை" : "Category"} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTS.map((c) => <SelectItem key={c || "all"} value={c || "all"}>{c || (lang === "ta" ? "அனைத்தும்" : "All")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue placeholder={lang === "ta" ? "முன்னுரிமை" : "Priority"} />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTS.map((p) => <SelectItem key={p || "all"} value={p || "all"}>{p || (lang === "ta" ? "அனைத்தும்" : "All")}</SelectItem>)}
              </SelectContent>
            </Select>
            <WardCombobox
              value={filterWard}
              onChange={(v) => { setFilterWard(v); setPage(1); }}
              options={wardList}
              lang={lang}
              includeAll
              triggerClassName="w-44 h-8 text-sm"
              className="w-[260px]"
            />
            <Select
              value={filterConstituency || "all"}
              onValueChange={(v) => { setFilterConstituency(v === "all" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder={lang === "ta" ? "தொகுதி / மாநிலம்" : "Scope"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ta" ? "அனைத்தும்" : "All scopes"}</SelectItem>
                <SelectItem value="Rasipuram">
                  <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{lang === "ta" ? "ராசிபுரம் தொகுதி" : "Rasipuram Constituency"}</span>
                </SelectItem>
                <SelectItem value="Tamil Nadu">
                  <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />{lang === "ta" ? "தமிழ்நாடு மாநிலம்" : "Tamil Nadu State"}</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-muted-foreground">
                <X className="w-3.5 h-3.5" />
                {lang === "ta" ? "அழி" : "Clear"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 ml-auto gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {/* Date-range filter */}
          <div className="flex flex-wrap gap-3 items-center border-t pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="w-3.5 h-3.5" />
              {lang === "ta" ? "தேதி வரம்பு:" : "Date range:"}
            </div>
            <Input
              type="date"
              className="w-36 h-8 text-sm"
              value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            />
            <span className="text-xs text-muted-foreground">{lang === "ta" ? "முதல்" : "to"}</span>
            <Input
              type="date"
              className="w-36 h-8 text-sm"
              value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ListChecks className="w-4 h-4" />
                {selectedIds.size} {lang === "ta" ? "புகார்கள் தேர்ந்தெடுக்கப்பட்டன" : "selected"}
              </div>
              {/* Bulk Status */}
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue placeholder={lang === "ta" ? "நிலை தேர்வு" : "Set status…"} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.filter(Boolean).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 bg-primary text-white hover:bg-primary/90 gap-1"
                onClick={applyBulkStatus}
                disabled={!bulkStatus || bulkLoading}
              >
                {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {lang === "ta" ? "பயன்படுத்து" : "Apply Status"}
              </Button>
              {/* Bulk Assign */}
              {officersData && officersData.officers.length > 0 && (
                <>
                  <div className="w-px h-6 bg-border mx-1" />
                  <Select value={bulkAssignId} onValueChange={setBulkAssignId}>
                    <SelectTrigger className="w-44 h-8 text-sm">
                      <SelectValue placeholder={lang === "ta" ? "அலுவலர் ஒதுக்கு" : "Assign officer…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {officersData.officers.map(o => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    onClick={applyBulkAssign}
                    disabled={!bulkAssignId || bulkLoading}
                  >
                    {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    {lang === "ta" ? "ஒதுக்கு" : "Assign"}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" className="h-8 ml-auto" onClick={() => setSelectedIds(new Set())}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isFetching && !data ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={(data?.items ?? []).length > 0 && (data?.items ?? []).every(i => selectedIds.has(i.id))}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    {["Ticket", "Category", "Ward", "Priority", "Status", "Filed", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.items ?? []).map((item) => (
                    <tr key={item.id} className={`hover:bg-muted/20 transition-colors ${selectedIds.has(item.id) ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-primary font-semibold text-xs">{item.ticketNo}</div>
                        {item.constituency === "Tamil Nadu" ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 mt-0.5">
                            <Globe className="w-2.5 h-2.5" /> State
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 mt-0.5">
                            <Building2 className="w-2.5 h-2.5" /> Constituency
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{item.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.constituency === "Tamil Nadu"
                          ? <span className="text-blue-600">{item.ward || "–"}</span>
                          : (item.ward || "–")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[item.priority] ?? "bg-muted"}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? "bg-muted"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openDetail(item)}>
                            {lang === "ta" ? "திற" : "Open"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={lang === "ta" ? "PDF பதிவிறக்கு" : "Download PDF"}
                            disabled={exportingPdf}
                            onClick={() => exportPDF({ ids: [item.id], ticketHint: item.ticketNo })}
                            data-testid={`row-pdf-${item.id}`}
                          >
                            {exportingPdf
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <FileDown className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted-foreground py-16">
                        {lang === "ta" ? "புகார்கள் இல்லை" : "No grievances found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{lang === "ta" ? `மொத்தம்: ${data.total}` : `Total: ${data.total} grievances`}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 w-7 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span>{page} / {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="h-7 w-7 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <DialogTitle className="font-mono">{selected?.ticketNo}</DialogTitle>
              {selected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  disabled={exportingPdf}
                  onClick={() => exportPDF({ ids: [selected.id], ticketHint: selected.ticketNo })}
                  data-testid="detail-download-pdf"
                >
                  {exportingPdf
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <FileDown className="w-3.5 h-3.5" />}
                  {lang === "ta" ? "PDF" : "Download PDF"}
                </Button>
              )}
            </div>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {/* Scope banner */}
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${detail.constituency === "Tamil Nadu" ? "bg-blue-50 text-blue-800 border border-blue-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
                {detail.constituency === "Tamil Nadu"
                  ? <><Globe className="w-4 h-4" />{lang === "ta" ? "தமிழ்நாடு மாநில புகார் — வணிக வரிகள் / பதிவு" : "Tamil Nadu State Complaint — Commercial Taxes & Registration"}</>
                  : <><Building2 className="w-4 h-4" />{lang === "ta" ? "ராசிபுரம் தொகுதி புகார்" : "Rasipuram Constituency Complaint"}</>
                }
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Category", value: detail.category },
                  { label: "Status", value: detail.status },
                  { label: "Priority", value: detail.priority },
                  { label: detail.constituency === "Tamil Nadu" ? "District" : "Ward", value: detail.ward ?? "–" },
                  { label: "Constituency", value: detail.constituency },
                  { label: "Filed", value: new Date(detail.createdAt).toLocaleDateString() },
                  { label: "Name", value: detail.anonymous ? "Anonymous" : detail.name },
                  { label: "Phone", value: detail.anonymous ? "***" : detail.phone },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>

              {/* GPS location — always visible so it's obvious when missing */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {lang === "ta" ? "இடம்" : "Location"}
                </h4>
                {detail.latitude != null && detail.longitude != null ? (
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      title="grievance-location-map"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${detail.longitude - 0.005}%2C${detail.latitude - 0.003}%2C${detail.longitude + 0.005}%2C${detail.latitude + 0.003}&layer=mapnik&marker=${detail.latitude}%2C${detail.longitude}`}
                      className="w-full h-56 border-0"
                      loading="lazy"
                    />
                    <div className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground">{detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}</span>
                      <a
                        href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {lang === "ta" ? "Google வரைபடத்தில் திற" : "Open in Google Maps"}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-lg px-3 py-2">
                    {lang === "ta" ? "புகார்தாரர் இடத்தை வழங்கவில்லை" : "No GPS location was provided by the citizen"}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">{lang === "ta" ? "விவரம்" : "Description"}</p>
                <p className="text-sm bg-muted/40 rounded-lg p-3">{detail.description}</p>
              </div>

              {/* Attachments — rich preview */}
              {detail.attachments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    {lang === "ta" ? "இணைப்புகள்" : "Attachments"} ({detail.attachments.length})
                  </h4>
                  <div className="space-y-2">
                    {detail.attachments.map((a) => {
                      const mime = a.fileType ?? "";
                      const isImage = mime.startsWith("image/");
                      const isVideo = mime.startsWith("video/");
                      const isAudio = mime.startsWith("audio/");
                      const sizeMB = a.fileSize ? `${(a.fileSize / (1024 * 1024)).toFixed(1)} MB` : "";
                      const IconComp = isImage ? Image : isVideo ? Video : isAudio ? Music : FileText;
                      const iconColor = isImage ? "text-blue-500" : isVideo ? "text-purple-500" : isAudio ? "text-green-500" : "text-orange-500";
                      return (
                        <div key={a.id} className="border rounded-xl overflow-hidden">
                          {/* Image preview */}
                          {isImage && (
                            <a href={a.fileUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={a.fileUrl}
                                alt={a.fileName}
                                className="w-full max-h-56 object-contain bg-muted/30"
                                loading="lazy"
                              />
                            </a>
                          )}
                          {/* Video player */}
                          {isVideo && (
                            <video
                              src={a.fileUrl}
                              controls
                              className="w-full max-h-56 bg-black"
                              preload="metadata"
                            />
                          )}
                          {/* Audio player */}
                          {isAudio && (
                            <div className="px-3 py-2 bg-muted/20">
                              <audio src={a.fileUrl} controls className="w-full h-10" preload="metadata" />
                            </div>
                          )}
                          {/* Footer row */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted/10">
                            <IconComp className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{a.fileName}</p>
                              {sizeMB && <p className="text-xs text-muted-foreground">{sizeMB}</p>}
                            </div>
                            <a
                              href={a.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={a.fileName}
                              className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {lang === "ta" ? "பதிவிறக்கு" : "Download"}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Match Voter */}
              <VoterMatchPanel
                grievanceId={detail.id}
                token={token}
                voter={detail.voter}
                lang={lang}
                onChanged={() => refreshDetail(detail.id)}
              />

              {/* Update Status */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  {lang === "ta" ? "நிலை புதுப்பி" : "Update Status"}
                </h4>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTS.filter(Boolean).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  rows={2}
                  placeholder={lang === "ta" ? "குறிப்பு (விரும்பினால்)..." : "Note (optional)..."}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => statusMutation.mutate()}
                  disabled={statusMutation.isPending || newStatus === detail.status}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span className="ml-2">{lang === "ta" ? "புதுப்பி" : "Update"}</span>
                </Button>
              </div>

              {/* Add Remark */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  {lang === "ta" ? "குறிப்பு சேர்" : "Add Remark"}
                </h4>
                <Textarea
                  rows={2}
                  placeholder={lang === "ta" ? "குறிப்பை உள்ளிடவும்..." : "Enter remark..."}
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remarkPublic}
                      onChange={(e) => setRemarkPublic(e.target.checked)}
                      className="rounded"
                    />
                    {lang === "ta" ? "பொதுவில் காட்டு" : "Visible to citizen"}
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remarkMutation.mutate()}
                    disabled={remarkMutation.isPending || !remarkText.trim()}
                  >
                    {remarkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ta" ? "சேர்" : "Add"}
                  </Button>
                </div>
              </div>

              {/* Update Priority */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  {lang === "ta" ? "முன்னுரிமை மாற்று" : "Update Priority"}
                </h4>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTS.filter(Boolean).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => priorityMutation.mutate()}
                  disabled={priorityMutation.isPending || newPriority === detail.priority}
                >
                  {priorityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ta" ? "புதுப்பி" : "Set Priority"}
                </Button>
              </div>

              {/* Assign to Officer */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {lang === "ta" ? "அலுவலருக்கு ஒதுக்கு" : "Assign to Officer"}
                </h4>
                <Select value={assignOfficerId} onValueChange={setAssignOfficerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={lang === "ta" ? "அலுவலரை தேர்வு செய்யவும்..." : "Select officer..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {(officersData?.officers ?? []).map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.name} <span className="text-muted-foreground text-xs ml-1">({o.role.replace("_", " ")})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder={lang === "ta" ? "குறிப்பு (விரும்பினால்)..." : "Note (optional)..."}
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => assignMutation.mutate()}
                  disabled={assignMutation.isPending || !assignOfficerId}
                >
                  {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ta" ? "ஒதுக்கு" : "Assign"}
                </Button>
              </div>

              {/* Status History */}
              {detail.statusLog.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {lang === "ta" ? "நிலை வரலாறு" : "History"}
                  </h4>
                  <div className="space-y-1.5">
                    {detail.statusLog.map((log) => (
                      <div key={log.id} className="text-xs flex items-start gap-2 p-2 bg-muted/40 rounded">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{log.fromStatus ? `${log.fromStatus} → ` : ""}{log.toStatus}</span>
                          {log.note && <span className="text-muted-foreground"> · {log.note}</span>}
                          <span className="text-muted-foreground block">{log.changedByName} · {new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Remarks (including internal) */}
              {detail.remarks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    {lang === "ta" ? "குறிப்புகள்" : "Remarks"}
                  </h4>
                  {detail.remarks.map((r) => (
                    <div key={r.id} className={`text-sm p-3 border rounded-lg space-y-1 ${!r.isPublic ? "border-orange-200 bg-orange-50/50" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs">{r.authorName}</span>
                        {r.isPublic
                          ? <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Public</Badge>
                          : <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">Internal</Badge>
                        }
                      </div>
                      <p>{r.remark}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {lang === "ta" ? "மூடு" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface VoterSuggestion {
  id: number;
  epicNumber: string;
  fullName: string;
  boothNo: string | null;
  boothName: string | null;
  similarity: number;
  sameWard: boolean;
}

interface VoterSearchHit {
  id: number;
  epicNumber: string;
  fullName: string;
  boothNo: string | null;
  boothName: string | null;
}

function VoterMatchPanel({
  grievanceId, token, voter, lang, onChanged,
}: {
  grievanceId: number;
  token: string;
  voter: StaffGrievanceDetail["voter"];
  lang: Language;
  onChanged: () => void;
}) {
  const [suggestions, setSuggestions] = useState<VoterSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VoterSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function loadSuggestions() {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/admin/grievances/${grievanceId}/voter-suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { items: VoterSuggestion[] };
      setSuggestions(data.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Auto-suggest the moment the panel mounts for an unlinked grievance,
  // so officers see candidates without an extra click. Re-runs if the
  // grievance changes or if it gets unlinked again.
  useEffect(() => {
    if (!voter && suggestions === null && !loading) {
      loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grievanceId, voter]);

  async function runSearch() {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true); setError(null);
    try {
      const r = await fetch(`/api/admin/voters?q=${encodeURIComponent(q)}&limit=8`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { items: VoterSearchHit[] };
      setSearchResults(data.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function linkVoter(voterId: number) {
    setBusyId(voterId); setError(null);
    try {
      const r = await fetch(`/api/admin/grievances/${grievanceId}/voter`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ voterId }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setSuggestions(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function unlinkVoter() {
    setBusyId(-1); setError(null);
    try {
      const r = await fetch(`/api/admin/grievances/${grievanceId}/voter`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setSuggestions(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3" data-testid="voter-match-panel">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-primary" />
        {lang === "ta" ? "வாக்காளரை இணை" : "Match Voter"}
      </h4>
      {voter ? (
        <div className="flex items-start justify-between gap-2 rounded border bg-muted/30 p-3">
          <button
            type="button"
            className="text-sm text-left flex-1 min-w-0 hover:opacity-80 cursor-pointer"
            title={lang === "ta" ? "வாக்காளர் விவரத்தைத் திற" : "Open voter detail"}
            data-testid="open-linked-voter-btn"
            onClick={() => {
              sessionStorage.setItem("openVoterId", String(voter.id));
              window.location.hash = "#voters-search";
            }}
          >
            <div className="font-medium underline-offset-2 hover:underline">{voter.fullName}</div>
            <div className="text-xs text-muted-foreground font-mono">{voter.epicNumber}</div>
            {voter.boothNo && (
              <div className="text-xs text-muted-foreground">
                {lang === "ta" ? "வாக்குச்சாவடி" : "Booth"} {voter.boothNo}
                {voter.boothName ? ` · ${voter.boothName}` : ""}
              </div>
            )}
          </button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === -1}
            onClick={unlinkVoter}
            data-testid="unlink-voter-btn"
          >
            {busyId === -1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            <span className="ml-1">{lang === "ta" ? "இணைப்பை நீக்கு" : "Unlink"}</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {!suggestions && (
            <Button
              size="sm"
              variant="outline"
              onClick={loadSuggestions}
              disabled={loading}
              data-testid="suggest-voters-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Users className="w-4 h-4 mr-1" />}
              {lang === "ta" ? "வாக்காளர்களைப் பரிந்துரை" : "Suggest matches"}
            </Button>
          )}
          {suggestions && suggestions.length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              {lang === "ta"
                ? "பொருந்தக்கூடிய வாக்காளர் எதுவும் கிடைக்கவில்லை."
                : "No matching voters found."}
            </div>
          )}
          {suggestions && suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-2 rounded border p-2"
                  data-testid={`voter-suggestion-${s.id}`}
                >
                  <div className="text-sm min-w-0 flex-1">
                    <div className="font-medium truncate">{s.fullName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{s.epicNumber}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {Math.round(s.similarity * 100)}% match
                      </Badge>
                      {s.sameWard && (
                        <Badge variant="outline" className="text-[10px]">
                          {lang === "ta" ? "அதே வார்டு" : "Same ward"}
                        </Badge>
                      )}
                      {s.boothNo && (
                        <span className="text-[10px] text-muted-foreground">
                          · {lang === "ta" ? "வா.சா." : "Booth"} {s.boothNo}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busyId === s.id}
                    onClick={() => linkVoter(s.id)}
                    data-testid={`link-voter-${s.id}`}
                  >
                    {busyId === s.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : (lang === "ta" ? "இணை" : "Link")}
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={loadSuggestions}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                {lang === "ta" ? "மீண்டும் பரிந்துரை" : "Refresh suggestions"}
              </Button>
            </div>
          )}
          {/* Manual "Find voter…" search — for cases where the auto
              suggestions miss the right voter (e.g. nickname, typo,
              EPIC lookup). Calls the same admin voter search endpoint. */}
          <div className="border-t pt-3 space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {lang === "ta" ? "வாக்காளரை கைமுறையாக தேடு" : "Find voter manually"}
            </div>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
                placeholder={lang === "ta" ? "பெயர் அல்லது EPIC எண்…" : "Name or EPIC number…"}
                data-testid="voter-search-input"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={runSearch}
                disabled={searching || searchQuery.trim().length < 2}
                data-testid="voter-search-btn"
              >
                {searching ? <Loader2 className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {searchResults && searchResults.length === 0 && (
              <div className="text-xs text-muted-foreground italic">
                {lang === "ta" ? "முடிவுகள் இல்லை." : "No matches."}
              </div>
            )}
            {searchResults && searchResults.length > 0 && (
              <div className="space-y-1.5">
                {searchResults.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start justify-between gap-2 rounded border p-2 text-sm"
                    data-testid={`voter-search-result-${s.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{s.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.epicNumber}</div>
                      {s.boothNo && (
                        <div className="text-[10px] text-muted-foreground">
                          {lang === "ta" ? "வா.சா." : "Booth"} {s.boothNo}
                          {s.boothName ? ` · ${s.boothName}` : ""}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={busyId === s.id}
                      onClick={() => linkVoter(s.id)}
                      data-testid={`link-search-${s.id}`}
                    >
                      {busyId === s.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : (lang === "ta" ? "இணை" : "Link")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
