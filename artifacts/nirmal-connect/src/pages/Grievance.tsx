import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SectionHeader } from "@/components/SectionHeader";
import WardCombobox from "@/components/WardCombobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  CheckCircle, Search, FileText, Phone, MessageSquare,
  Copy, AlertCircle, TrendingUp, Clock, CheckCheck, Loader2,
  Paperclip, X, Image, Video, Music, FileUp, MapPin, Building2,
} from "lucide-react";
import type { Language } from "@/lib/i18n";
import { submitGrievance, trackGrievance, getGrievanceHeatmap } from "@workspace/api-client-react";
import type { GrievanceTrackResponse } from "@workspace/api-client-react";
import { useWards } from "@/lib/useWards";
import GpsPicker, { type GpsValue } from "@/components/GpsPicker";

interface GrievanceProps { lang: Language; }

/** Submit grievance as multipart/form-data when files are attached. */
async function submitGrievanceWithFiles(
  data: { name: string; phone: string; category: string; description: string; address?: string | null; ward?: string | null; constituency?: string | null; anonymous?: boolean; areaId?: number | null; pollingStationId?: number | null; latitude?: number | null; longitude?: number | null },
  files: File[]
): Promise<{ ticketNo: string }> {
  const fd = new globalThis.FormData();
  fd.append("name", data.name);
  fd.append("phone", data.phone);
  fd.append("category", data.category);
  fd.append("description", data.description);
  if (data.address) fd.append("address", data.address);
  if (data.ward) fd.append("ward", data.ward);
  if (data.constituency) fd.append("constituency", data.constituency);
  if (data.areaId) fd.append("areaId", String(data.areaId));
  if (data.pollingStationId) fd.append("pollingStationId", String(data.pollingStationId));
  if (data.latitude != null && data.longitude != null) {
    fd.append("latitude", String(data.latitude));
    fd.append("longitude", String(data.longitude));
  }
  fd.append("anonymous", String(data.anonymous ?? false));
  files.forEach((f) => fd.append("attachments", f));
  const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const res = await fetch(`${BASE}/api/grievances/submit`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Submit failed");
  }
  return res.json() as Promise<{ ticketNo: string }>;
}

const CATEGORIES = [
  "Roads", "Water Supply", "EB / Electricity Issues", "Sewage",
  "Healthcare", "Education", "Women Safety", "Corruption",
  "Ration", "Transport", "Pension", "Housing",
  "Agriculture", "Employment", "Others",
];
const CATEGORIES_TA = [
  "சாலை", "குடிநீர்", "மின்சாரம்", "கழிவுநீர்",
  "சுகாதாரம்", "கல்வி", "பெண் பாதுகாப்பு", "ஊழல்",
  "ரேஷன்", "போக்குவரத்து", "ஓய்வூதியம்", "வீட்டுவசதி",
  "விவசாயம்", "வேலைவாய்ப்பு", "பிறவை",
];

const STATUS_FLOW = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Closed"];
const STATUS_COLORS: Record<string, string> = {
  "Submitted": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Under Review": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Assigned": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "In Progress": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "Resolved": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "Closed": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const STATUS_TA: Record<string, string> = {
  "Submitted": "பதிவு செய்யப்பட்டது",
  "Under Review": "ஆய்வில் உள்ளது",
  "Assigned": "ஒதுக்கப்பட்டது",
  "In Progress": "நடவடிக்கையில் உள்ளது",
  "Resolved": "தீர்க்கப்பட்டது",
  "Closed": "மூடப்பட்டது",
};

const CHART_COLORS = ["#CC0000", "#e53e3e", "#fc8181", "#feb2b2", "#fed7d7", "#fff5f5",
  "#FFD700", "#f6c200", "#b7791f", "#975a16", "#1a365d", "#2c7a7b", "#276749", "#553c9a", "#702459"];

const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Villupuram", "Virudhunagar",
];

const TN_DISTRICTS_TA: Record<string, string> = {
  "Ariyalur": "அரியலூர்", "Chengalpattu": "செங்கல்பட்டு", "Chennai": "சென்னை",
  "Coimbatore": "கோயம்புத்தூர்", "Cuddalore": "கடலூர்", "Dharmapuri": "தர்மபுரி",
  "Dindigul": "திண்டுக்கல்", "Erode": "ஈரோடு", "Kallakurichi": "கள்ளக்குறிச்சி",
  "Kancheepuram": "காஞ்சிபுரம்", "Kanyakumari": "கன்னியாகுமரி", "Karur": "கரூர்",
  "Krishnagiri": "கிருஷ்ணகிரி", "Madurai": "மதுரை", "Mayiladuthurai": "மயிலாடுதுறை",
  "Nagapattinam": "நாகப்பட்டினம்", "Namakkal": "நாமக்கல்", "Nilgiris": "நீலகிரி",
  "Perambalur": "பெரம்பலூர்", "Pudukkottai": "புதுக்கோட்டை",
  "Ramanathapuram": "இராமநாதபுரம்", "Ranipet": "ராணிப்பேட்டை", "Salem": "சேலம்",
  "Sivaganga": "சிவகங்கை", "Tenkasi": "தென்காசி", "Thanjavur": "தஞ்சாவூர்",
  "Theni": "தேனி", "Thoothukudi": "தூத்துக்குடி", "Tiruchirappalli": "திருச்சிராப்பள்ளி",
  "Tirunelveli": "திருநெல்வேலி", "Tirupathur": "திருப்பத்தூர்", "Tiruppur": "திருப்பூர்",
  "Tiruvallur": "திருவள்ளூர்", "Tiruvannamalai": "திருவண்ணாமலை", "Tiruvarur": "திருவாரூர்",
  "Vellore": "வேலூர்", "Villupuram": "விழுப்புரம்", "Virudhunagar": "விருதுநகர்",
};

const schema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(7, "Valid phone required"),
  category: z.string().min(1, "Category required"),
  description: z.string().min(20, "Provide at least 20 characters"),
  address: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  wardId: z.number().int().positive().optional(),
  areaId: z.number().int().positive().optional(),
  pollingStationId: z.number().int().positive().optional(),
  anonymous: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

interface AreaOption { id: number; name: string; nameTa?: string | null }
interface BoothOption { id: number; boothNo: string; name: string }

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
async function fetchAreasByWard(wardId: number): Promise<AreaOption[]> {
  const res = await fetch(`${BASE}/api/wards/${wardId}/areas`);
  if (!res.ok) return [];
  return res.json() as Promise<AreaOption[]>;
}
async function fetchBoothsByWard(wardId: number): Promise<BoothOption[]> {
  const res = await fetch(`${BASE}/api/wards/${wardId}/polling-stations`);
  if (!res.ok) return [];
  return res.json() as Promise<BoothOption[]>;
}

function StatusTimeline({ status, lang }: { status: string; lang: Language }) {
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {STATUS_FLOW.map((s, i) => (
          <div key={s} className={`h-2 flex-1 rounded-full transition-colors ${i <= idx ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lang === "ta" ? "பதிவு" : "Filed"}</span>
        <span>{lang === "ta" ? "தீர்வு" : "Resolved"}</span>
      </div>
    </div>
  );
}

function TrackResult({ data, lang, ticketNo }: { data: GrievanceTrackResponse; lang: Language; ticketNo: string }) {
  const statusLabel = lang === "ta" ? (STATUS_TA[data.status] ?? data.status) : data.status;
  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-mono font-bold text-primary">{ticketNo}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[data.status] ?? "bg-muted text-muted-foreground"}`}>
            {statusLabel}
          </span>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><span className="font-medium">{lang === "ta" ? "வகை:" : "Category:"}</span> {data.category}</p>
          {data.ward && <p><span className="font-medium">{lang === "ta" ? "வார்டு:" : "Ward:"}</span> {data.ward}</p>}
          <p><span className="font-medium">{lang === "ta" ? "தொகுதி:" : "Constituency:"}</span> {data.constituency}</p>
          <p className="text-xs">{lang === "ta" ? "பதிவு:" : "Filed:"} {new Date(data.createdAt).toLocaleDateString("ta-IN")}</p>
        </div>
        <StatusTimeline status={data.status} lang={lang} />
      </div>

      {data.statusLog.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{lang === "ta" ? "நிலை வரலாறு" : "Status Timeline"}</h4>
          <div className="space-y-2">
            {data.statusLog.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="w-px flex-1 bg-border mt-1" />
                </div>
                <div className="pb-3">
                  <p className="font-medium">
                    {lang === "ta" ? (STATUS_TA[log.toStatus] ?? log.toStatus) : log.toStatus}
                  </p>
                  {log.note && <p className="text-muted-foreground text-xs">{log.note}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.changedByName} · {new Date(log.createdAt).toLocaleString("ta-IN")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.remarks.filter((r) => r.isPublic).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{lang === "ta" ? "அலுவலக குறிப்புகள்" : "Office Remarks"}</h4>
          {data.remarks.filter((r) => r.isPublic).map((r) => (
            <div key={r.id} className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p>{r.remark}</p>
              <p className="text-xs text-muted-foreground">{r.authorName} · {new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Grievance({ lang }: GrievanceProps) {
  const [submitted, setSubmitted] = useState(false);
  const [ticketNo, setTicketNo] = useState("");
  const [trackInput, setTrackInput] = useState("");
  const [trackData, setTrackData] = useState<GrievanceTrackResponse | null>(null);
  const [trackError, setTrackError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [gps, setGps] = useState<GpsValue | null>(null);
  const [complaintScope, setComplaintScope] = useState<"constituency" | "state">("constituency");
  const { data: wardList = [] } = useWards();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", category: "", description: "", address: "", ward: "", anonymous: false },
  });

  // Resolve currently-chosen ward id from its name (the form stores ward as
  // a string for backwards compat) so we can drive the cascading queries.
  const watchedWard = form.watch("ward");
  const selectedWardId = wardList.find((w) => w.name === watchedWard)?.id ?? null;

  const { data: areaOptions = [] } = useQuery({
    queryKey: ["ward-areas", selectedWardId],
    queryFn: () => (selectedWardId ? fetchAreasByWard(selectedWardId) : Promise.resolve([])),
    enabled: !!selectedWardId,
    staleTime: 5 * 60_000,
  });
  const { data: boothOptions = [] } = useQuery({
    queryKey: ["ward-booths", selectedWardId],
    queryFn: () => (selectedWardId ? fetchBoothsByWard(selectedWardId) : Promise.resolve([])),
    enabled: !!selectedWardId,
    staleTime: 5 * 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: (data: FormData) => {
      const isState = complaintScope === "state";
      const payload = {
        name: data.name,
        phone: data.phone,
        category: data.category,
        description: data.description,
        address: isState
          ? [data.city, data.address].filter(Boolean).join(", ") || null
          : data.address || null,
        ward: isState ? (data.district || null) : (data.ward || null),
        constituency: isState ? "Tamil Nadu" : "Karaikudi",
        areaId: isState ? null : (data.areaId ?? null),
        pollingStationId: isState ? null : (data.pollingStationId ?? null),
        latitude: gps?.lat ?? null,
        longitude: gps?.lng ?? null,
        anonymous: data.anonymous ?? false,
      };
      if (attachedFiles.length > 0) {
        return submitGrievanceWithFiles(payload, attachedFiles);
      }
      return submitGrievance(payload);
    },
    onSuccess: (result) => {
      setTicketNo(result.ticketNo);
      setSubmitted(true);
      setAttachedFiles([]);
      setGps(null);
    },
    onError: () => {
      form.setError("root", { message: lang === "ta" ? "சேவை தடைபட்டது. மீண்டும் முயற்சிக்கவும்." : "Service error. Please try again." });
    },
  });

  const { data: heatmapData } = useQuery({
    queryKey: ["grievance-heatmap"],
    queryFn: () => getGrievanceHeatmap(),
    staleTime: 60_000,
  });

  function onSubmit(values: FormData) {
    submitMutation.mutate(values);
  }

  async function handleTrack() {
    const ticket = trackInput.trim();
    if (!ticket) return;
    setIsTracking(true);
    setTrackError("");
    setTrackData(null);
    try {
      const result = await trackGrievance(ticket);
      setTrackData(result);
    } catch {
      setTrackError(lang === "ta" ? "புகார் எண் கிடைக்கவில்லை." : "Ticket not found. Check the number and try again.");
    } finally {
      setIsTracking(false);
    }
  }

  function copyTicket() {
    navigator.clipboard.writeText(ticketNo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const resolvedPct = heatmapData
    ? Math.round((heatmapData.resolved / Math.max(heatmapData.total, 1)) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      <SectionHeader
        title={lang === "ta" ? "மக்கள் புகார் மையம்" : "Public Grievance Portal"}
        subtitle={lang === "ta"
          ? "உங்கள் பகுதியில் உள்ள பிரச்சினைகளை நேரடியாக தெரிவியுங்கள்"
          : "Submit complaints directly to Dr. T.K. Prabhu's office and track resolution progress"}
      />

      <Tabs defaultValue="submit" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto">
          <TabsTrigger value="submit" data-testid="tab-submit">
            <FileText className="w-4 h-4 mr-2" />
            {lang === "ta" ? "புகார் அனுப்பு" : "Submit"}
          </TabsTrigger>
          <TabsTrigger value="track" data-testid="tab-track">
            <Search className="w-4 h-4 mr-2" />
            {lang === "ta" ? "நிலை அறிய" : "Track"}
          </TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">
            <TrendingUp className="w-4 h-4 mr-2" />
            {lang === "ta" ? "புள்ளிவிவரம்" : "Stats"}
          </TabsTrigger>
        </TabsList>

        {/* ── Submit Tab ── */}
        <TabsContent value="submit">
          {submitted ? (
            <div className="text-center py-16 space-y-5 max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold">
                {lang === "ta" ? "புகார் பதிவு செய்யப்பட்டது!" : "Grievance Submitted!"}
              </h3>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2">
                <p className="text-xs text-muted-foreground">{lang === "ta" ? "உங்கள் புகார் எண்" : "Your Ticket Number"}</p>
                <p className="text-2xl font-bold text-primary font-mono tracking-wider">{ticketNo}</p>
                <Button variant="ghost" size="sm" onClick={copyTicket} className="gap-1.5">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? (lang === "ta" ? "நகலெடுக்கப்பட்டது" : "Copied!") : (lang === "ta" ? "நகலெடு" : "Copy")}
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                {lang === "ta"
                  ? "இந்த எண்ணை வைத்து Track தாவலில் நிலையை கண்காணியுங்கள்."
                  : "Use this number in the Track tab to follow your grievance status."}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => { setSubmitted(false); form.reset(); }} variant="outline">
                  {lang === "ta" ? "மற்றொரு புகார்" : "Submit Another"}
                </Button>
                <a
                  href={`https://wa.me/919876543210?text=${encodeURIComponent(`My grievance ticket: ${ticketNo}`)}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  <Button className="bg-[#25D366] hover:bg-[#20b558] text-white gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {lang === "ta" ? "WhatsApp மூலம் பகிர்" : "Share via WhatsApp"}
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>{lang === "ta" ? "புகார் படிவம்" : "Grievance Form"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lang === "ta" ? "பெயர்" : "Your Name"} *</FormLabel>
                          <FormControl><Input data-testid="grievance-name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lang === "ta" ? "தொலைபேசி" : "Phone Number"} *</FormLabel>
                          <FormControl><Input data-testid="grievance-phone" type="tel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{lang === "ta" ? "புகார் வகை" : "Complaint Category"} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="grievance-category">
                              <SelectValue placeholder={lang === "ta" ? "வகையை தேர்ந்தெடுங்கள்" : "Select category"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIES.map((cat, i) => (
                              <SelectItem key={cat} value={cat}>
                                {lang === "ta" ? CATEGORIES_TA[i] : cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* ── Complaint Scope Toggle ── */}
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                      <p className="text-sm font-semibold">
                        {lang === "ta" ? "புகார் எங்கிருந்து?" : "Where is this complaint from?"}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          aria-pressed={complaintScope === "constituency"}
                          onClick={() => { setComplaintScope("constituency"); form.setValue("district", ""); form.setValue("city", ""); }}
                          className={`rounded-lg border-2 p-3 text-left transition-colors flex items-start gap-2.5 ${complaintScope === "constituency" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                        >
                          <MapPin className={`h-5 w-5 mt-0.5 shrink-0 ${complaintScope === "constituency" ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{lang === "ta" ? "தொகுதி புகார்" : "Constituency Complaint"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{lang === "ta" ? "காரைக்குடி" : "Karaikudi"}</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-pressed={complaintScope === "state"}
                          onClick={() => { setComplaintScope("state"); form.setValue("ward", ""); form.setValue("areaId", undefined); form.setValue("pollingStationId", undefined); }}
                          className={`rounded-lg border-2 p-3 text-left transition-colors flex items-start gap-2.5 ${complaintScope === "state" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                        >
                          <Building2 className={`h-5 w-5 mt-0.5 shrink-0 ${complaintScope === "state" ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{lang === "ta" ? "அமைச்சர் அலுவலகம்" : "Minister's Office"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{lang === "ta" ? "தமிழ்நாடு முழுவதும்" : "All of Tamil Nadu"}</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* ── Constituency: Ward + Address ── */}
                    {complaintScope === "constituency" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="ward" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{lang === "ta" ? "வார்டு / பகுதி" : "Ward / Area"}</FormLabel>
                            <WardCombobox
                              value={field.value || ""}
                              onChange={(v) => {
                                field.onChange(v);
                                form.setValue("areaId", undefined);
                                form.setValue("pollingStationId", undefined);
                              }}
                              options={wardList}
                              lang={lang}
                              placeholder={
                                wardList.length === 0
                                  ? (lang === "ta" ? "வார்டுகள் இல்லை" : "No wards configured")
                                  : (lang === "ta" ? "வார்டை தேர்ந்தெடுங்கள்" : "Select a ward…")
                              }
                              disabled={wardList.length === 0}
                              triggerClassName="w-full h-10"
                              className="w-full"
                            />
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{lang === "ta" ? "முகவரி" : "Address"}</FormLabel>
                            <FormControl><Input data-testid="grievance-address" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    )}

                    {/* ── State: District + City + Address ── */}
                    {complaintScope === "state" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField control={form.control} name="district" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{lang === "ta" ? "மாவட்டம்" : "District"} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={lang === "ta" ? "மாவட்டத்தை தேர்ந்தெடுங்கள்" : "Select district"} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {TN_DISTRICTS.map((d) => (
                                    <SelectItem key={d} value={d}>
                                      {lang === "ta" ? (TN_DISTRICTS_TA[d] ?? d) : d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{lang === "ta" ? "நகரம் / ஊர்" : "City / Town"}</FormLabel>
                              <FormControl><Input placeholder={lang === "ta" ? "நகரம் அல்லது ஊரின் பெயர்" : "City or town name"} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="address" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{lang === "ta" ? "முகவரி / இடம்" : "Address / Location"}</FormLabel>
                            <FormControl><Input placeholder={lang === "ta" ? "தெரு, கிராமம் அல்லது குறிப்பிட்ட இடம்" : "Street, village or specific location"} data-testid="grievance-address" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    )}

                    {/* Cascading area + polling-station — only when constituency scope and a ward is chosen */}
                    {complaintScope === "constituency" && selectedWardId && (areaOptions.length > 0 || boothOptions.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {areaOptions.length > 0 && (
                          <FormField control={form.control} name="areaId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{lang === "ta" ? "பகுதி (விரும்பினால்)" : "Area (optional)"}</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                                value={field.value ? String(field.value) : "none"}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="grievance-area">
                                    <SelectValue placeholder={lang === "ta" ? "பகுதி தேர்வு" : "Select area"} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">{lang === "ta" ? "—" : "—"}</SelectItem>
                                  {areaOptions.map((a) => (
                                    <SelectItem key={a.id} value={String(a.id)}>
                                      {lang === "ta" && a.nameTa ? a.nameTa : a.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                        {boothOptions.length > 0 && (
                          <FormField control={form.control} name="pollingStationId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{lang === "ta" ? "வாக்குச்சாவடி (விரும்பினால்)" : "Polling Booth (optional)"}</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                                value={field.value ? String(field.value) : "none"}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="grievance-booth">
                                    <SelectValue placeholder={lang === "ta" ? "சாவடி தேர்வு" : "Select booth"} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">{lang === "ta" ? "—" : "—"}</SelectItem>
                                  {boothOptions.map((b) => (
                                    <SelectItem key={b.id} value={String(b.id)}>
                                      #{b.boothNo} — {b.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </div>
                    )}

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{lang === "ta" ? "புகார் விவரம்" : "Complaint Details"} *</FormLabel>
                        <FormControl>
                          <Textarea
                            data-testid="grievance-description"
                            rows={4}
                            placeholder={lang === "ta" ? "பிரச்சினையை விரிவாக விவரிக்கவும்..." : "Describe the issue in detail..."}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="anonymous" render={({ field }) => (
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            data-testid="grievance-anonymous"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          {lang === "ta" ? "அநாமதேய புகார் (பெயர் மறைக்கப்படும்)" : "Submit anonymously (name hidden from public)"}
                        </FormLabel>
                      </FormItem>
                    )} />

                    {/* ── Attachments: images, videos, audio, documents ── */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        {lang === "ta" ? "இணைப்புகள் (விரும்பினால், அதிகபட்சம் 10)" : "Attachments (optional, up to 10 files)"}
                      </p>
                      {/* File type hints */}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Image className="w-3 h-3 text-blue-500" />{lang === "ta" ? "படங்கள்" : "Images"}</span>
                        <span className="flex items-center gap-1"><Video className="w-3 h-3 text-purple-500" />{lang === "ta" ? "வீடியோ" : "Video"}</span>
                        <span className="flex items-center gap-1"><Music className="w-3 h-3 text-green-500" />{lang === "ta" ? "ஆடியோ" : "Audio"}</span>
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-orange-500" />{lang === "ta" ? "ஆவணம்" : "Documents"}</span>
                      </div>
                      <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed rounded-xl p-5 hover:bg-muted/40 transition-colors text-center">
                        <FileUp className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {lang === "ta" ? "கோப்புகளை தேர்வு செய்யவும் அல்லது இங்கே இழுக்கவும்" : "Choose files or drag & drop here"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lang === "ta" ? "படங்கள், வீடியோ, ஆடியோ, PDF — அதிகபட்சம் 100MB" : "Images, Video, Audio, PDF, DOC — max 100 MB each"}
                        </span>
                        <input
                          data-testid="grievance-attachments"
                          type="file"
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                          multiple
                          className="sr-only"
                          onChange={(e) => {
                            const picked = Array.from(e.target.files ?? []).slice(0, 10);
                            setAttachedFiles((prev) => {
                              const combined = [...prev, ...picked];
                              return combined.slice(0, 10);
                            });
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {attachedFiles.length > 0 && (
                        <div className="space-y-2">
                          {attachedFiles.map((f, i) => {
                            const isImage = f.type.startsWith("image/");
                            const isVideo = f.type.startsWith("video/");
                            const isAudio = f.type.startsWith("audio/");
                            const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
                            const Icon = isImage ? Image : isVideo ? Video : isAudio ? Music : FileText;
                            const iconColor = isImage ? "text-blue-500" : isVideo ? "text-purple-500" : isAudio ? "text-green-500" : "text-orange-500";
                            return (
                              <div key={i} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2">
                                <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{f.name}</p>
                                  <p className="text-xs text-muted-foreground">{sizeMB} MB</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                                  className="shrink-0 hover:text-destructive transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                          <p className="text-xs text-muted-foreground text-right">
                            {attachedFiles.length}/10 {lang === "ta" ? "கோப்புகள்" : "files"}
                          </p>
                        </div>
                      )}
                    </div>

                    <GpsPicker value={gps} onChange={setGps} lang={lang} />

                    {form.formState.errors.root && (
                      <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {form.formState.errors.root.message}
                      </div>
                    )}

                    <Button
                      data-testid="submit-grievance-btn"
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                    >
                      {submitMutation.isPending
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lang === "ta" ? "அனுப்புகிறது..." : "Submitting..."}</>
                        : lang === "ta" ? "புகார் அனுப்பு" : "Submit Grievance"
                      }
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Track Tab ── */}
        <TabsContent value="track">
          <div className="max-w-lg mx-auto space-y-5">
            <Card>
              <CardHeader><CardTitle>{lang === "ta" ? "புகார் நிலை அறிய" : "Track Your Grievance"}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    data-testid="track-ticket-input"
                    placeholder={lang === "ta" ? "புகார் எண் (GRV-...)" : "Ticket number (GRV-...)"}
                    value={trackInput}
                    onChange={(e) => setTrackInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                  />
                  <Button
                    data-testid="track-submit"
                    onClick={handleTrack}
                    disabled={isTracking || !trackInput.trim()}
                    className="bg-primary text-white hover:bg-primary/90 shrink-0"
                  >
                    {isTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>

                {trackError && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {trackError}
                  </div>
                )}

                {trackData && <TrackResult data={trackData} lang={lang} ticketNo={trackInput.trim()} />}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-5 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  {lang === "ta" ? "நேரடி தொடர்பு" : "Direct Contact"}
                </h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" />
                    {lang === "ta" ? "திங்கள் – சனி, காலை 9 – மாலை 6" : "Mon – Sat, 9 AM – 6 PM"}
                  </p>
                  <a
                    href="https://wa.me/919876543210"
                    target="_blank" rel="noopener noreferrer"
                    className="text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp: +91 98765 43210
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Stats / Heatmap Tab ── */}
        <TabsContent value="stats">
          <div className="space-y-6">
            {/* Summary cards */}
            {heatmapData ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {
                      label: lang === "ta" ? "மொத்த புகார்கள்" : "Total Grievances",
                      value: heatmapData.total,
                      icon: <FileText className="w-5 h-5 text-primary" />,
                    },
                    {
                      label: lang === "ta" ? "தீர்க்கப்பட்டவை" : "Resolved",
                      value: heatmapData.resolved,
                      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
                    },
                    {
                      label: lang === "ta" ? "நிலுவையில் உள்ளவை" : "Pending",
                      value: heatmapData.total - heatmapData.resolved,
                      icon: <Clock className="w-5 h-5 text-yellow-600" />,
                    },
                    {
                      label: lang === "ta" ? "தீர்வு விகிதம்" : "Resolution Rate",
                      value: `${resolvedPct}%`,
                      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
                    },
                  ].map(({ label, value, icon }) => (
                    <Card key={label}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">{icon}</div>
                        <div>
                          <p className="text-2xl font-bold">{value}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {heatmapData.byCategory.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {lang === "ta" ? "வகை வாரியான புகார்கள்" : "Grievances by Category"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={heatmapData.byCategory} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="category"
                            tick={{ fontSize: 11 }}
                            angle={-40}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                            formatter={(value) => [value, lang === "ta" ? "புகார்கள்" : "Grievances"]}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {heatmapData.byCategory.map((_entry, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {heatmapData.byWard.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {lang === "ta" ? "வார்டு வாரியான புகார்கள்" : "Grievances by Ward"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {heatmapData.byWard.map(({ ward, count: cnt }, i) => (
                          <div key={ward} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="text-sm font-medium truncate">{ward}</span>
                            </div>
                            <Badge variant="secondary">{cnt}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {heatmapData.total === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>{lang === "ta" ? "இன்னும் புகார்கள் இல்லை." : "No grievances submitted yet."}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
