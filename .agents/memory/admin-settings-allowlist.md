---
name: Admin settings allowlist
description: Adding a new settings key requires editing two allowlists in admin.ts
---
The generic site settings endpoints in `artifacts/api-server/src/routes/admin.ts` gate keys with TWO independent allowlists:
- `GET /admin/settings` — a `key IN (...)` SQL filter (only listed keys are returned)
- `PUT /admin/settings/:key` — an `allowed` array (unlisted keys are rejected with "Invalid settings key")

**Rule:** When a frontend feature reads/writes a new `site_config` JSON key (e.g. `ai_settings`), add it to BOTH allowlists in lockstep.

**Why:** A key added to only PUT will save but never load back (GET filters it out); a key in only GET can never be written. Either way the settings tab silently shows defaults and looks broken with no error. This bit the AI Settings tab — `ai_settings` was in neither list.
