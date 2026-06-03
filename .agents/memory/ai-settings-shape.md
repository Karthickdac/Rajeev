---
name: AI settings canonical shape
description: The site_config.ai_settings shape must stay in sync across three layers, and every LLM call must thread temperature too.
---

AI behavior is driven by `site_config.ai_settings` (key `ai_settings`). The canonical shape is `{ modelName, temperature, maxTokens, featureToggles{...}, promptTemplates{...} }`.

**Rule:** This shape is defined in THREE places that must change in lockstep:
1. Backend write validation — `AiSettingsBody` Zod schema in `admin.ts`.
2. Backend read/merge/clamp — `DEFAULT_AI_SETTINGS` + `loadAiSettings()` in `lib/ai-settings.ts` (30s cache; `invalidateAiSettings()` must be called after the settings PUT).
3. Frontend editor — `AiSettings`/`DEFAULT_SETTINGS` in `AiToolsAdmin.tsx` SettingsTab.

**Why:** A drift between these (e.g. an older shape used `{ model, features{...} }`) silently drops fields — the UI saves a key the backend never reads, so the setting appears to "not work." A code review caught exactly this.

**How to apply:** When adding/renaming an AI model param, prompt template, or feature toggle, update all three. Also: when wiring a route to settings, thread ALL of `{ model, temperature, maxTokens }` into `chat()`/`chatJson()` — passing only model+maxTokens leaves temperature at the lib default, so "fully settings-driven" silently isn't. Feature toggles that are off should return HTTP 403 (not 404), so the route must check the toggle explicitly rather than relying on a helper returning null.
