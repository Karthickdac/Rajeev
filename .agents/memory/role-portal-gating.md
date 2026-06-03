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

**Still open (defense in depth):** Backend grievance mutation endpoints are guarded only by
`requireStaff`, so UI gating is not a true authorization boundary — a read-only role could
still call the write endpoints directly. Enforce role server-side if real least-privilege is
required.

**How to apply:** When adding a new restricted role, gate (1) nav visibility, (2) mutating UI
inside every shared admin component that role can reach, and ideally (3) the server route.
