import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SectionHeader } from "@/components/SectionHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarCheck, Search, Copy, CheckCheck, CheckCircle, Clock,
  CalendarClock, MapPin, XCircle, RotateCcw, Loader2, MessageSquare,
} from "lucide-react";
import type { Language } from "@/lib/i18n";

interface AppointmentProps { lang: Language; }

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const CATEGORY_OPTIONS: { value: string; en: string; ta: string }[] = [
  { value: "Constituency Meeting", en: "Constituency Meeting", ta: "தொகுதி சந்திப்பு" },
  { value: "Grievance Hearing", en: "Grievance Hearing", ta: "புகார் விசாரணை" },
  { value: "Official Visit", en: "Official Visit", ta: "அலுவல் வருகை" },
  { value: "Media", en: "Media", ta: "ஊடகம்" },
  { value: "General", en: "General", ta: "பொது" },
];

const STATUS_META: Record<string, { en: string; ta: string; cls: string; icon: typeof Clock }> = {
  Pending: { en: "Pending", ta: "நிலுவையில்", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  Approved: { en: "Approved", ta: "அங்கீகரிக்கப்பட்டது", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle },
  Rescheduled: { en: "Rescheduled", ta: "மறுதிட்டமிடப்பட்டது", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: CalendarClock },
  Completed: { en: "Completed", ta: "முடிக்கப்பட்டது", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCheck },
  Rejected: { en: "Rejected", ta: "நிராகரிக்கப்பட்டது", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  Cancelled: { en: "Cancelled", ta: "ரத்து செய்யப்பட்டது", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: RotateCcw },
};

const schema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(7, "Valid phone required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  category: z.string().min(1, "Category required"),
  subject: z.string().min(3, "Subject required"),
  description: z.string().optional(),
  ward: z.string().optional(),
  address: z.string().optional(),
  partySize: z.coerce.number().int().min(1).max(50).optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface TrackResult {
  ticketNo: string;
  category: string;
  subject: string;
  status: string;
  preferredDate: string | null;
  preferredTime: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  location: string | null;
  decisionNote: string | null;
  rejectionReason: string | null;
  notificationMessage: string | null;
  createdAt: string;
}

export default function Appointment({ lang }: AppointmentProps) {
  const [submitted, setSubmitted] = useState(false);
  const [ticketNo, setTicketNo] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [trackInput, setTrackInput] = useState("");
  const [trackData, setTrackData] = useState<TrackResult | null>(null);
  const [trackError, setTrackError] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", category: "", subject: "", description: "", ward: "", address: "", partySize: 1, preferredDate: "", preferredTime: "" },
  });

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const payload = {
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        category: values.category,
        subject: values.subject,
        description: values.description || null,
        ward: values.ward || null,
        address: values.address || null,
        partySize: values.partySize ?? 1,
        preferredDate: values.preferredDate || null,
        preferredTime: values.preferredTime || null,
      };
      const res = await fetch(`${BASE}/api/appointments/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Submit failed");
      }
      const result = (await res.json()) as { ticketNo: string };
      setTicketNo(result.ticketNo);
      setSubmitted(true);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err ?? "");
      setSubmitError(lang === "ta" ? `சேவை தடைபட்டது. மீண்டும் முயற்சிக்கவும். (${detail})` : `Service error. Please try again. (${detail})`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTrack() {
    const ticket = trackInput.trim();
    if (!ticket) return;
    setIsTracking(true);
    setTrackError("");
    setTrackData(null);
    try {
      const res = await fetch(`${BASE}/api/appointments/track/${encodeURIComponent(ticket)}`);
      if (!res.ok) throw new Error("not found");
      setTrackData((await res.json()) as TrackResult);
    } catch {
      setTrackError(lang === "ta" ? "சந்திப்பு எண் கிடைக்கவில்லை." : "Appointment not found. Check the number and try again.");
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

  const lc = (en: string, ta: string) => (lang === "ta" ? ta : en);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
      <SectionHeader
        title={lc("Request an Appointment", "சந்திப்பு கோரிக்கை")}
        subtitle={lc(
          "Request a meeting with the Minister's office and track your request status",
          "அமைச்சர் அலுவலகத்துடன் சந்திப்பை கோருங்கள், உங்கள் கோரிக்கையின் நிலையை கண்காணியுங்கள்",
        )}
      />

      <Tabs defaultValue="request" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="request" data-testid="tab-appointment-request">
            <CalendarCheck className="w-4 h-4 mr-2" />
            {lc("Request", "கோரிக்கை")}
          </TabsTrigger>
          <TabsTrigger value="track" data-testid="tab-appointment-track">
            <Search className="w-4 h-4 mr-2" />
            {lc("Track", "நிலை அறிய")}
          </TabsTrigger>
        </TabsList>

        {/* ── Request Tab ── */}
        <TabsContent value="request">
          {submitted ? (
            <div className="text-center py-16 space-y-5 max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold">{lc("Appointment Requested!", "சந்திப்பு கோரப்பட்டது!")}</h3>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2">
                <p className="text-xs text-muted-foreground">{lc("Your Reference Number", "உங்கள் குறிப்பு எண்")}</p>
                <p className="text-2xl font-bold text-primary font-mono tracking-wider">{ticketNo}</p>
                <Button variant="ghost" size="sm" onClick={copyTicket} className="gap-1.5">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? lc("Copied", "நகலெடுக்கப்பட்டது") : lc("Copy", "நகலெடு")}
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                {lc(
                  "The office will review your request. Use this number in the Track tab to follow its status.",
                  "அலுவலகம் உங்கள் கோரிக்கையை பரிசீலிக்கும். இந்த எண்ணை வைத்து Track தாவலில் நிலையை கண்காணியுங்கள்.",
                )}
              </p>
              <Button onClick={() => { setSubmitted(false); form.reset(); }} variant="outline">
                {lc("Request Another", "மற்றொரு கோரிக்கை")}
              </Button>
            </div>
          ) : (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>{lc("Appointment Form", "சந்திப்பு படிவம்")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Full Name", "முழு பெயர்")} *</FormLabel>
                          <FormControl><Input {...field} data-testid="input-appt-name" placeholder={lc("Your name", "உங்கள் பெயர்")} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Phone", "தொலைபேசி")} *</FormLabel>
                          <FormControl><Input {...field} data-testid="input-appt-phone" placeholder="98xxxxxxxx" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Email (optional)", "மின்னஞ்சல் (விருப்பம்)")}</FormLabel>
                          <FormControl><Input {...field} type="email" data-testid="input-appt-email" placeholder="you@example.com" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Purpose", "நோக்கம்")} *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-appt-category"><SelectValue placeholder={lc("Select purpose", "நோக்கத்தை தேர்ந்தெடுக்கவும்")} /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{lc(c.en, c.ta)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{lc("Subject", "தலைப்பு")} *</FormLabel>
                        <FormControl><Input {...field} data-testid="input-appt-subject" placeholder={lc("Brief subject of the meeting", "சந்திப்பின் சுருக்கமான தலைப்பு")} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{lc("Details (optional)", "விவரங்கள் (விருப்பம்)")}</FormLabel>
                        <FormControl><Textarea {...field} rows={4} data-testid="input-appt-description" placeholder={lc("Describe the reason for the meeting", "சந்திப்பின் காரணத்தை விவரிக்கவும்")} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField control={form.control} name="preferredDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Preferred Date", "விரும்பும் தேதி")}</FormLabel>
                          <FormControl><Input {...field} type="date" data-testid="input-appt-date" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="preferredTime" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Preferred Time", "விரும்பும் நேரம்")}</FormLabel>
                          <FormControl><Input {...field} type="time" data-testid="input-appt-time" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="partySize" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("People Attending", "வருபவர் எண்")}</FormLabel>
                          <FormControl><Input {...field} type="number" min={1} max={50} data-testid="input-appt-party" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="ward" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Ward / Area (optional)", "வார்டு / பகுதி (விருப்பம்)")}</FormLabel>
                          <FormControl><Input {...field} data-testid="input-appt-ward" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{lc("Address (optional)", "முகவரி (விருப்பம்)")}</FormLabel>
                          <FormControl><Input {...field} data-testid="input-appt-address" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {submitError && (
                      <p className="text-sm text-red-600" data-testid="appt-submit-error">{submitError}</p>
                    )}

                    <Button type="submit" disabled={isSubmitting} className="w-full" data-testid="button-appt-submit">
                      {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarCheck className="w-4 h-4 mr-2" />}
                      {lc("Request Appointment", "சந்திப்பை கோருங்கள்")}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Track Tab ── */}
        <TabsContent value="track">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>{lc("Track Appointment", "சந்திப்பை கண்காணி")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-2">
                <Input
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleTrack(); }}
                  placeholder={lc("Enter reference no. (APT-...)", "குறிப்பு எண் (APT-...)")}
                  data-testid="input-appt-track"
                  className="font-mono"
                />
                <Button onClick={handleTrack} disabled={isTracking} data-testid="button-appt-track">
                  {isTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {trackError && <p className="text-sm text-red-600">{trackError}</p>}

              {trackData && (() => {
                const meta = STATUS_META[trackData.status] ?? STATUS_META.Pending;
                const StatusIcon = meta.icon;
                const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN") : null);
                return (
                  <div className="p-4 border rounded-xl space-y-3" data-testid="appt-track-result">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-mono font-bold text-primary">{trackData.ticketNo}</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
                        <StatusIcon className="w-3.5 h-3.5" />{lc(meta.en, meta.ta)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><span className="font-medium text-foreground">{lc("Subject:", "தலைப்பு:")}</span> {trackData.subject}</p>
                      <p><span className="font-medium text-foreground">{lc("Purpose:", "நோக்கம்:")}</span> {trackData.category}</p>
                      {fmtDate(trackData.preferredDate) && (
                        <p><span className="font-medium text-foreground">{lc("Preferred:", "விரும்பியது:")}</span> {fmtDate(trackData.preferredDate)} {trackData.preferredTime ?? ""}</p>
                      )}
                    </div>

                    {(trackData.status === "Approved" || trackData.status === "Rescheduled") && (trackData.scheduledDate || trackData.location) && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-1.5 text-sm">
                        <p className="font-semibold text-green-700 dark:text-green-300">{lc("Confirmed Schedule", "உறுதி செய்யப்பட்ட நேரம்")}</p>
                        {trackData.scheduledDate && (
                          <p className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-green-600" />{fmtDate(trackData.scheduledDate)} {trackData.scheduledTime ?? ""}</p>
                        )}
                        {trackData.location && (
                          <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600" />{trackData.location}</p>
                        )}
                      </div>
                    )}

                    {trackData.status === "Rejected" && trackData.rejectionReason && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-red-700 dark:text-red-300 mb-1">{lc("Reason", "காரணம்")}</p>
                        <p className="text-muted-foreground">{trackData.rejectionReason}</p>
                      </div>
                    )}

                    {trackData.decisionNote && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm flex gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p>{trackData.decisionNote}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
