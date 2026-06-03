---
name: Leader/tenant config is CMS-driven
description: How leader identity, constituency, map center, and branding flow through the app — never hardcode them.
---

# Leader config is CMS-driven, not hardcoded

All leader/constituency/branding values (name, title, constituency En/Ta, district, party,
photoUrl, siteTitle, logoInitial, map center/zoom, acNumber, phones, email) come from
`leader_config` stored in the `site_config` table (JSON). Frontend reads via
`useLeaderConfig()` (context) / `DEFAULT_LEADER_CONFIG` in
`artifacts/logesh-connect/src/lib/LeaderConfigContext.tsx`. Seeded by
`lib/db/src/seed.ts` `TENANT_CONFIGS`.

**Rule:** Never hardcode a leader name, constituency, district, or brand string in UI or
default-content builders (`createDefaultHomeHero`, `createDefaultAboutConfig`). Derive from
the `lc`/leader object. Bilingual: use `constituencyTa`/`nameTa` etc. for Tamil strings too.

**Why:** Platform is multi-tenant; hardcoded values (old "Logesh"/"Rasipuram", current
"Sarath"/"Tambaram") break other tenants and caused a visible bug where a stale seeded
`photoUrl` showed the wrong leader photo despite the default being correct.

**How to apply:** After changing leader identity, re-seed (`npx tsx lib/db/src/seed.ts`)
so the DB `site_config.leader_config` row updates — the running DB value overrides the
code default. Legitimate TN reference datasets (`tn-constituencies.ts`, `sroData.ts`)
contain place names like Tambaram/Rasipuram/Namakkal and are intentionally kept.

**AI prompts:** Backend AI behaviour (model, temperature, maxTokens, prompt templates,
feature toggles) is now driven by `site_config.ai_settings` via `loadAiSettings()` /
`resolvePrompt()`; admin SettingsTab edits it and the PUT invalidates the cache. Prompt
text still references the current leader by name — override per-tenant through the
`promptTemplates` settings rather than re-hardcoding in route code.
