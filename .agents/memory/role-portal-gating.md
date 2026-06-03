---
name: role portal gating (admin panel)
description: How per-role admin portals are gated and the read-only trap to avoid
---

The admin panel (`artifacts/logesh-connect/src/pages/Admin.tsx`) tailors the experience per
role using three mechanisms: a per-item `roles` array, a role allowlist (e.g. `MINISTER_ALLOW`)
that curates a slim sidebar, and a group-label override map (e.g. `PA_ITEM_GROUP`) that
regroups the SAME nav items into a different workflow layout without touching `NAV_ITEMS`.

**Why it matters / the trap:** Restricting the *sidebar* does NOT make a role read-only.
Tabs like `grievances` render a SHARED component (`GrievanceOfficer`) whose mutating controls
(status/priority/assign/bulk) are independent of nav gating. A "read-only" role (e.g. minister:
spec says "view + add remarks — no delete/assign") must ALSO have those controls hidden inside
the shared component (gate by `userRole`, e.g. `canManage = userRole !== "minister"`).

**Defense in depth (now enforced):** Backend grievance mutation endpoints (status/priority/
assign) use `requireStaffExcept("minister")` (helper in `lib/auth.ts`), so a read-only role is
rejected (403) server-side, not just in the UI. Bulk routes already exclude minister via their
`requireRole(...)` lists. GET + remarks stay open to minister. When adding a new mutating
grievance route, use the same guard — do not fall back to bare `requireStaff`.

**How to apply:** When adding a new restricted role, gate (1) nav visibility, (2) mutating UI
inside every shared admin component that role can reach, and ideally (3) the server route.
