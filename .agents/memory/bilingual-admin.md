---
name: Bilingual admin convention
description: How admin-portal UI text is internationalized (Tamil-default/English) and what must never be translated.
---

# Bilingual admin portal

All admin UI strings must be bilingual via `lc(lang, "EN", "TA")` (from `LeaderConfigContext`), with `lang` from a shared persisted context (`useLanguage()` in `src/lib/LanguageContext.tsx`, default `"ta"`, localStorage key `nc.lang`). Components that already receive a `lang: Language` prop use it; otherwise add `const { lang } = useLanguage();`. Nav items carry a `labelTa` rendered via `lc`.

**Why:** The public site was bilingual but admin was English-only; the office operates in Tamil. A single shared context keeps the public + admin toggle in sync and persistent.

**How to apply:** When adding/editing any admin page, wrap every user-facing string. NEVER translate: `data-testid`, API field names, enum values sent to the server, CSS classes, `console.log`, code identifiers, or values used as map keys / switch comparisons. If a string is both a server value and displayed (e.g. a status), keep the raw value for logic and translate only the displayed copy (small display map or `lc` at render). Some files route text through typed i18n helpers like `tHi`/`tTask`/`tAnalytics` instead of `lc` — extend those helpers rather than bypassing them.
