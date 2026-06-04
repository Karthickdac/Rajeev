---
name: VPS / CloudPanel deployment is single-port
description: How the app is hosted outside Replit — one Node process serves both the SPA and the API.
---

# VPS deployment runs as ONE process on a single port

On a self-hosted VPS (CloudPanel), the app is deployed as a **single Node process**, not
the two-process (Vite + API) split used in Replit dev. The Express API server
(`artifacts/api-server`) also serves the built frontend from
`artifacts/logesh-connect/dist/public` (static + SPA fallback for non-`/api`/`/uploads`/`/media`
GETs). The reverse proxy (CloudPanel or Nginx) forwards the whole domain to one app port.

**Why:** CloudPanel reverse-proxy sites point a domain at a single localhost port. Serving
the SPA from the API keeps it to one PM2 process and avoids a separate static host / second
port. The frontend uses relative `/api` paths (VITE_API_URL defaults to `/api`), so no base
URL config is needed behind the proxy.

**How to apply:**
- Deploy tooling lives at repo root: `deploy.sh`, `ecosystem.config.cjs`, `.env.example`,
  `nginx.conf.example`. `deploy.sh` builds api-server (esbuild) + frontend (vite), runs
  `@workspace/db run push`, then PM2 (re)starts.
- Secrets are NOT committed: `ecosystem.config.cjs` reads them from `process.env`; `deploy.sh`
  loads a gitignored `.env`. `.env` and `logs/` are in `.gitignore`.
- PM2 `cwd` is set to `artifacts/api-server` so runtime `./uploads` and `../../attached_assets`
  resolve exactly as they do in dev. The frontend dist path is resolved from
  `import.meta.dirname` in `app.ts`, so it is cwd-independent.
- The static-serving branch only activates when `dist/public/index.html` exists; otherwise the
  server logs "API-only mode" and still serves `/api`.

**Known caveat:** production schema sync uses drizzle `push` (no versioned migration files
exist). It is schema-sync, not migration — review drift before running on a populated DB, or
`SKIP_DB_PUSH=1 bash deploy.sh`.
