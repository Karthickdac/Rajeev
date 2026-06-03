---
name: Express 5 routing gotchas
description: Param typing, router ordering, and per-route role gating patterns for the api-server Express 5 app.
---

- Reading numeric route params: `parseInt(req.params["id"] as string, 10)` — Express 5 types `req.params` loosely, so bracket access + cast avoids TS errors. Always follow with a `Number.isFinite` guard returning 400.
- Public vs admin routers are both mounted under `/api` (`routes/index.ts`); the public `siteRouter` is registered BEFORE `adminRouter`, so public routes win path collisions. Keep public routes (e.g. `/appointments/submit`, `/appointments/track/:ticketNo`) in `site.ts`, admin routes (`/admin/appointments...`) in `admin.ts`.
- `admin.ts` applies `router.use(requireStaff)` globally, which lets ANY staff role through. That is not enough for sensitive data — add explicit `requireRole(...)` per route.

**Why:** appointment read routes (list/stats/export/:id) initially only had `requireStaff`, which exposed citizen PII to unrelated staff roles (grievance_officer, media_team, etc.). Mutations had per-route guards but reads did not.

**How to apply:** for any resource with role-scoped access, define `<RESOURCE>_READ_ROLES` and `<RESOURCE>_MANAGE_ROLES` consts and attach `requireRole(...)` to every route (reads included), not just mutations. Minister is typically read-only.
