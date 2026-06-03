---
name: requireRole self-authentication
description: How requireRole/requireStaff middleware authenticate in api-server, and the 403 trap.
---

`requireRole(...roles)` in `artifacts/api-server/src/lib/auth.ts` now chains through
`requireAuth` internally (sets `req.user`), then checks the role. Same pattern as
`requireStaff`.

**Why:** Previously `requireRole` only read `req.user?.role` without authenticating.
It worked in `admin.ts` because that router applies `router.use(requireStaff)` first
(which sets `req.user`). But `social.ts` has NO router-level auth guard and uses
`requireRole` directly — so `req.user` was undefined and every social admin route
returned 403 even for super_admin.

**How to apply:** A router can use `requireRole` standalone with no separate auth
middleware. If a router ALSO applies `requireStaff` at the router level, `requireAuth`
runs twice — harmless (re-verifies same JWT) but redundant. When adding new protected
routers, either rely on `requireRole`/`requireStaff` self-auth per-route, or apply one
router-level guard — don't assume `req.user` is set without one of them.
