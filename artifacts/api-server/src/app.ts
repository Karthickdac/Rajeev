import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  fetchAdminImage,
  isObjectStorageConfigured,
  ObjectNotFoundError,
} from "./lib/objectStorage";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Uploaded-file serving ────────────────────────────────────────────
// Admin CMS images now live in Replit Object Storage; legacy files (and
// grievance attachments) still live on local disk under ./uploads.
//
// Resolution order for /uploads/admin/:filename:
//   1. Local disk (legacy uploads from before the object-storage migration).
//   2. Object Storage (everything uploaded after the migration).
//
// The /uploads and /api/uploads mounts both work so the path-based proxy
// (which only routes /api → this service) can still reach files via the
// browser.
const uploadsRoot = path.resolve(process.cwd(), "uploads");
const attachedAssetsRoot = path.resolve(process.cwd(), "..", "..", "attached_assets");
const ADMIN_FILENAME_RE = /^[A-Za-z0-9._-]+$/;

async function serveAdminFromBucket(filename: string, res: Response): Promise<boolean> {
  if (!isObjectStorageConfigured()) return false;
  try {
    const obj = await fetchAdminImage(filename);
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (obj.size != null) res.setHeader("Content-Length", String(obj.size));
    obj.stream.on("error", (err) => {
      logger.error({ err, filename }, "object-storage stream error");
      if (!res.headersSent) res.status(500).end();
      else res.destroy(err);
    });
    obj.stream.pipe(res);
    return true;
  } catch (err) {
    if (err instanceof ObjectNotFoundError) return false;
    logger.error({ err, filename }, "object-storage fetch error");
    if (!res.headersSent) res.status(502).json({ error: "Storage unavailable" });
    return true;
  }
}

const adminBucketHandler = async (req: Request, res: Response): Promise<void> => {
  const raw = req.params["filename"];
  const filename = Array.isArray(raw) ? raw[0] : raw;
  if (!filename || !ADMIN_FILENAME_RE.test(filename)) {
    res.status(404).end();
    return;
  }
  const served = await serveAdminFromBucket(filename, res);
  if (!served) res.status(404).end();
};

const uploadsStatic = express.static(uploadsRoot, { dotfiles: "deny", fallthrough: true });

// 1) Try disk first (handles legacy admin files + grievance attachments).
// 2) For /uploads/admin/* misses, fall back to Object Storage.
app.use("/uploads", uploadsStatic);
app.get("/uploads/admin/:filename", adminBucketHandler);
app.use("/api/uploads", uploadsStatic);
app.get("/api/uploads/admin/:filename", adminBucketHandler);

// Serve project attached_assets at /media and /api/media
const mediaStatic = express.static(attachedAssetsRoot, { dotfiles: "deny" });
app.use("/media", mediaStatic);
app.use("/api/media", mediaStatic);

app.use("/api", router);

// ── Serve the built frontend (single-port production deployment) ──────
// The Vite build is emitted to artifacts/logesh-connect/dist/public. Serving
// it here lets ONE Node process (behind a reverse proxy such as CloudPanel /
// Nginx) serve both the SPA and the /api routes on a single port. Resolved
// relative to this bundle (import.meta.dirname = artifacts/api-server/dist) so
// it works regardless of the process working directory.
const clientDist = path.resolve(import.meta.dirname, "..", "..", "logesh-connect", "dist", "public");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html so client-side routing works.
  app.use((req: Request, res: Response, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/media")
    ) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
  logger.info({ clientDist }, "Serving frontend static build");
} else {
  logger.warn({ clientDist }, "Frontend build not found — running in API-only mode");
}

export default app;
