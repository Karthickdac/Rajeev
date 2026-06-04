import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";
import { Clock, User, Download, Hash } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { lc } from "@/lib/LeaderConfigContext";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

interface ExportRow {
  id: number;
  actorId: number | null;
  actorName: string;
  format: "csv" | "xlsx";
  filterJson: string;
  filterSummary: string;
  rowCount: number;
  thresholdAtExport: number;
  passwordGatePassed: boolean;
  masked: boolean;
  fileHash: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  downloadAvailable: boolean;
}

function bytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function VoterExportsAdmin() {
  const { lang } = useLanguage();
  const [items, setItems] = useState<ExportRow[]>([]);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Re-download flow: ask the server for a short-lived signed URL, then
  // fetch it with the user's bearer token (the download endpoint also
  // requires a valid logged-in super-admin, not just the signature) and
  // hand the resulting blob to the browser as a file save. We can't use
  // a plain `<a download>` here because the link must carry the
  // Authorization header.
  async function handleDownload(row: ExportRow) {
    const tok = getToken();
    setDownloadingId(row.id);
    try {
      const headers: Record<string, string> = tok ? { Authorization: `Bearer ${tok}` } : {};
      const urlRes = await fetch(
        `${BASE}/api/admin/voter-exports/${row.id}/download-url`,
        { method: "POST", headers },
      );
      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `HTTP ${urlRes.status}`);
      }
      const { url } = (await urlRes.json()) as { url: string };

      const fileRes = await fetch(`${BASE}${url}`, { headers });
      if (!fileRes.ok) {
        const body = await fileRes.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `HTTP ${fileRes.status}`);
      }
      const blob = await fileRes.blob();
      const disposition = fileRes.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `voter-export-${row.id}.${row.format}`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : lc(lang, "Failed to start download", "பதிவிறக்கத்தைத் தொடங்க முடியவில்லை"));
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    const tok = getToken();
    setLoading(true);
    fetch(`${BASE}/api/admin/voter-exports?limit=${limit}`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : undefined,
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ items: ExportRow[] }>;
      })
      .then((j) => { setItems(j.items); setError(null); })
      .catch((e) => setError(e.message ?? lc(lang, "Failed to load", "ஏற்ற முடியவில்லை")))
      .finally(() => setLoading(false));
  }, [limit]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">{lc(lang, "Voter Exports", "வாக்காளர் ஏற்றுமதிகள்")}</h2>
          <p className="text-sm text-muted-foreground">
            {lc(lang, "Read-only audit of every CSV / Excel pull from the Voters page. Each row records the actor, the filter that was applied, the row count shipped, and a SHA-256 of the file bytes so leaked sheets can be traced back here.", "வாக்காளர்கள் பக்கத்திலிருந்து ஒவ்வொரு CSV / Excel பதிவிறக்கத்தின் படிக்க-மட்டும் தணிக்கை. ஒவ்வொரு வரியும் செயலாற்றியவர், பயன்படுத்தப்பட்ட வடிகட்டி, அனுப்பப்பட்ட வரிசை எண்ணிக்கை மற்றும் கோப்பு பைட்டுகளின் SHA-256 ஆகியவற்றைப் பதிவு செய்கிறது, இதனால் கசிந்த தாள்களை இங்கே கண்டறியலாம்.")}
          </p>
        </div>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
        >
          {[50, 100, 200, 500].map((v) => (
            <option key={v} value={v}>{lc(lang, `Last ${v} exports`, `கடைசி ${v} ஏற்றுமதிகள்`)}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "Loading exports…", "ஏற்றுமதிகள் ஏற்றுகிறது…")}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{lc(lang, "No exports yet.", "இன்னும் ஏற்றுமதிகள் இல்லை.")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <Card key={e.id} className="hover:shadow-sm transition-shadow" data-testid={`voter-export-${e.id}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <User className="w-3 h-3" /> {e.actorName}
                      </span>
                      <Badge variant="outline" className="text-xs uppercase font-mono">{e.format}</Badge>
                      <Badge className="bg-gray-100 text-gray-700 border-gray-200 text-xs">
                        {e.rowCount.toLocaleString()} {lc(lang, "rows", "வரிசைகள்")}
                      </Badge>
                      {e.passwordGatePassed && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                          {lc(lang, `password-gated (over ${e.thresholdAtExport.toLocaleString()})`, `கடவுச்சொல் பாதுகாப்பு (${e.thresholdAtExport.toLocaleString()} மேல்)`)}
                        </Badge>
                      )}
                      {e.masked && (
                        <Badge
                          className="bg-purple-100 text-purple-700 border-purple-200 text-xs"
                          title={lc(lang, "EPIC last-4 only; address replaced with Booth/Part summary", "EPIC கடைசி 4 இலக்கங்கள் மட்டும்; முகவரி வாக்குச்சாவடி/பகுதி சுருக்கத்தால் மாற்றப்பட்டது")}
                        >
                          {lc(lang, "PII masked (officer scope)", "தனிநபர் தகவல் மறைக்கப்பட்டது (அலுவலர் வரம்பு)")}
                        </Badge>
                      )}
                      {!e.fileHash && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                          {lc(lang, "incomplete / aborted", "முழுமையற்றது / நிறுத்தப்பட்டது")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lc(lang, "Filter", "வடிகட்டி")}: <span className="font-mono">{e.filterSummary || lc(lang, "(none)", "(இல்லை)")}</span>
                    </p>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(e.createdAt).toLocaleString("en-IN")}
                      </span>
                      <span>{bytes(e.fileSizeBytes)}</span>
                      {e.fileHash && (
                        <span className="flex items-center gap-1 font-mono" title={e.fileHash}>
                          <Hash className="w-3 h-3" />
                          {e.fileHash.slice(0, 16)}…
                        </span>
                      )}
                      {e.expiresAt && (
                        <span title={lc(lang, `Saved file expires ${new Date(e.expiresAt).toLocaleString("en-IN")}`, `சேமிக்கப்பட்ட கோப்பு காலாவதியாகும்: ${new Date(e.expiresAt).toLocaleString("en-IN")}`)}>
                          {lc(lang, `file kept until ${new Date(e.expiresAt).toLocaleDateString("en-IN")}`, `கோப்பு வைக்கப்படும்: ${new Date(e.expiresAt).toLocaleDateString("en-IN")}`)}
                        </span>
                      )}
                    </div>
                  </div>
                  {e.downloadAvailable && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={downloadingId === e.id}
                      onClick={() => handleDownload(e)}
                      data-testid={`download-export-${e.id}`}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      {downloadingId === e.id ? lc(lang, "Preparing…", "தயாராகிறது…") : lc(lang, "Download", "பதிவிறக்கு")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {items.length >= limit && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 100)}>
            {lc(lang, "Load More", "மேலும் ஏற்று")}
          </Button>
        </div>
      )}
    </div>
  );
}
