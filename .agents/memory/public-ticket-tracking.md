---
name: Public ticket tracking convention
description: Shared enumerable-ticket pattern used by grievances and appointments for unauthenticated citizen tracking.
---

Both grievances (`GRV-YYYY-NNNN`) and appointments (`APT-YYYY-NNNNN`) generate short numeric tickets and expose an unauthenticated `GET /api/<resource>/track/:ticketNo` endpoint so citizens can check status without logging in. There is no rate limiting on `app.ts`.

**Why:** these tickets are low-entropy and brute-forceable; the track endpoint leaks request metadata (subject/status/schedule/notes). This is a known project-wide convention, not specific to one feature — so don't "fix" it on a single resource in isolation.

**How to apply:** if hardening is requested, do it project-wide (high-entropy opaque IDs + per-IP rate limiting on submit + track) so grievances and appointments stay consistent. Otherwise leave the existing pattern in place.
