---
name: Admin vs public endpoint RBAC for read-only aggregation pages
description: When a staff page aggregates content for a broad role set, prefer the public read endpoints over /admin/* variants which are narrowly role-gated.
---

# Admin vs public endpoint RBAC

Several content reads exist in **two** flavors in the api-server:
- Public (no auth): `GET /promises`, `GET /press-coverage` — return the same shapes (`{promises, summary}`, `{items}`) as the admin variants.
- Admin (`/admin/promises`, `/admin/press-coverage`): gated to CMS/content roles
  (super_admin/admin/pa_staff/media_team). These **silently 403** for
  `grievance_officer` (and `minister`, since neither is a CMS role).

**Rule:** For a read-only aggregation/dashboard page that must be visible to a
broad staff role set (incl. grievance_officer), call the PUBLIC endpoints, not the
`/admin/*` ones. Using the admin variant makes cards silently empty for those roles
(especially when combined with `Promise.allSettled`, which swallows the 403).

**Why:** The Leader Dashboard initially used `/admin/promises` and
`/admin/press-coverage`; grievance_officer saw empty Promise/Press cards because
those roles aren't in the content-role allowlist. Switching to public endpoints fixed it.

**How to apply:** Before wiring an admin-panel read into a multi-role page, check the
route's `requireRole(...)` list in `artifacts/api-server/src/routes/*.ts`. If the
target role isn't in it but a public sibling route exists, use the public one.
CDI (`/admin/cdi`) has no public sibling — its read role list was widened to include
grievance_officer instead. Settings GET (`/admin/settings`) only returns an
allowlisted set of `site_config` keys, and PUT enforces the same allowlist — adding a
new configurable key (e.g. `milestone_targets`) means editing BOTH lists.
