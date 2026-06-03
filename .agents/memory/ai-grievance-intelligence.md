---
name: AI grievance intelligence decisions
description: Design decisions for grievance auto-triage + similar-cases that resolve spec ambiguity; keep future work consistent.
---

# AI grievance intelligence — settled decisions

- **Auto-triage runs ASYNC (fire-and-forget after the 201 response).**
  **Why:** the task spec contradicts itself — "Done looks like" says triage runs *before* returning the ticket, but Step 2 explicitly says "fire an async AI triage call (non-blocking — don't delay the citizen's response)". Step 2 (the implementation directive) wins.
  **How to apply:** never block the public grievance submit on an LLM call. Triage is invoked via `setImmediate` importing `triageGrievance` from ai.ts.

- **triageGrievance sets BOTH `priority` and `aiPriority`.**
  **Why:** spec requires auto-triage to set the operational `priority`, not just the AI shadow column. Submit defaults `priority: "Medium"`, triage overwrites with the AI assessment.
  **How to apply:** if you add more AI-derived fields, decide explicitly whether they feed the working column or stay shadow-only.

- **The `/admin/grievances/:id/similar` displayed list is RESOLVED/CLOSED only.**
  **Why:** spec says the panel shows the "top 3 previously resolved grievances" so the officer gets a usable resolution template. Returning in-progress items defeats the purpose.
  **How to apply:** both the embedding path (filter `allScored` before slice) and the no-embedding fallback (`inArray(status, ["Resolved","Closed"])`) must enforce this. `resolvedTemplate` carries the latest remark of the top resolved match.
