---
name: API server rebuild on route changes
description: Why new/edited API routes return stale behavior until the workflow restarts.
---

The "API Server" workflow serves a compiled build, not live source. After editing `artifacts/api-server/src/**`, a new route can return `Unauthorized`/404 or old behavior because the running process predates the change.

**Why:** a freshly-added public route returned `{"error":"Unauthorized"}` until restart — the running build had no such route and the request fell through to other handlers.

**How to apply:** after any api-server source change, `restart_workflow("API Server")` (timeout ~60s) before testing endpoints with curl against `localhost:8080`.
