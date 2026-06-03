---
name: frontend tsc noise (logesh-connect)
description: Why `tsc --noEmit` on the web app reports errors that don't matter for dev
---

Running `npx tsc --noEmit -p tsconfig.json` inside `artifacts/logesh-connect` reports two
families of errors that are PRE-EXISTING build-artifact noise, not real regressions:

- **TS6305** "Output file '.../lib/api-client-react/dist/index.d.ts' has not been built from
  source" — the workspace `lib/*` packages' `dist` is stale/unbuilt relative to their `src`.
- **TS7006** "Parameter 'x' implicitly has an 'any' type" — cascades from TS6305: when the
  generated client types resolve to `any`, downstream `.map`/`.filter` callbacks lose their
  inferred element type and trip `noImplicitAny`. Appears in many files (GrievanceOfficer,
  AssignmentsAdmin, VotersAdmin, etc.).

**Why:** The Vite dev server does not run `tsc` — it transpiles per-file — so the app builds
and runs fine despite these. Chasing them by annotating callbacks is wasted effort.

**How to apply:** When typechecking your own changes here, filter out TS6305 and the TS7006
that ride on it. Only treat errors in files you actually edited, that are NOT implicit-any
callbacks, as real. To genuinely clear them you'd rebuild the workspace `lib/*` dist first.
