# Context Readiness Report — EXAMPLE — Cal.com-inspired booking lifecycle

> **HYPOTHETICAL EXAMPLE** — illustrative output only, produced by `context_scout` at the **start** of the hypothetical task: "Reference Cal.com to improve Tutoria rescheduling." No implementation was performed or intended. Every evidence item below was checked against the actual repository at writing time and is labeled accordingly; anything not inspected would be HYPOTHETICAL_EXAMPLE or INFERENCE and would be marked as such. Real reports are returned by `context_scout` before product planning / QA preflight and recorded in `.codex/team-runs/<run-id>.json` with `--context-readiness` and `--note`/`--artifact` evidence.

```text
HYPOTHETICAL EXAMPLE

CONTEXT READINESS
Status:
INPUT_RECOMMENDED

Task:
Booking reschedule/cancellation lifecycle (Cal.com-inspired)

VERIFIED TUTORIA EVIDENCE (inspected, exact paths):
- `backend/src/domain/booking-lifecycle.ts` — pure domain state machine
  (requested/confirmed/cancelled/rejected/completed; attendee/host roles)
- `backend/test/booking-lifecycle.test.ts` — transition-guard tests
- `discover/public/pizza-workshop.html` — workshop booking UI prototype
- `docs/agent-team/TUTORIA_PRODUCT_BRAIN.md` — Booking section notes that
  availability, concurrency protection, and cancellation/reschedule states
  "need" establishing (line ~101)

NOT FOUND IN TUTORIA (explicitly searched, absent):
- Supabase booking tables/RLS: `backend/supabase/migrations/` contains only
  0001_profiles, 0002_tutor_cvs, 0003_marketplace_listings
- booking API routes/services under `backend/src/routes` / `backend/src/services`
- any `tutoria-notifications-paper-inbox-style.html` or similar notification
  scenario prototype

GAPS:

1. Cancel/refund policy — MISSING_DECISION
   No Tutoria evidence anywhere defines cancellation/refund behavior.
   Impact: HIGH
   Why: determines whether cancellation states may trigger payment/refund effects.
   Best input: explicit founder/product decision (no artifact can resolve it).
   Required? No for domain modeling. Yes before production payment integration.
   Can proceed now: YES (domain-only, policy marked unresolved)

2. Pending-booking capacity reservation — MISSING_DECISION
   No evidence establishes whether requested bookings reserve seats.
   Impact: HIGH
   Why: determines whether `requested` occupies capacity.
   Best input: founder decision or an approved capacity specification if one exists.
   Can proceed now: YES (model as unresolved marker, do not guess)

3. Notification scenario artifact — MISSING_CONTEXT
   Earlier analysis referenced a Tutoria notification-scenario prototype, but no
   such file was found in this repository; if it exists outside the repo it could
   materially improve notification-state evidence.
   Impact: MEDIUM
   Why: Tutoria-specific intended notification scenarios beat external behavior.
   Best input: the actual HTML prototype (founder effort LOW, improvement HIGH —
   contains interaction states not visible from screenshots).

EXTERNAL EVIDENCE (Cal.com — never Tutoria evidence):
- Cal uses linked replacement bookings (EXTERNAL OBSERVATION).
- Abstracted principle: rescheduling benefits from preserved history (no source
  code or schema details used).
- TUTORIA POLICY STATUS: linked replacement remains REVERSIBLE_DESIGN_CHOICE —
  EXTERNAL_SOURCE_ASSUMPTION until a Tutoria decision adopts it.
- PRODUCT DECISION REQUIRED: whether host-initiated reschedules auto-confirm.

SAFE SCOPE:
- domain invariants (no silent state loss, no unauthorized mutation)
- explicit unresolved policy markers in the model
- tests for invariant behavior only

DO NOT DECIDE YET:
- cancellation fee window, refund behavior, pending-seat reservation policy,
  replacement vs in-place rescheduling
```

## Decision-surface example (MISSING_DECISION format)

```text
Tutoria has no established rule for what happens when a learner requests a new
time and the tutor rejects it.

Recommended default:
keep the original booking confirmed.

Alternatives:
A. Keep original booking — safest for the learner (zero-loss default).
B. Requesting a change relinquishes the original slot — risks stranding the learner.
C. Different behavior inside a cancellation window — needs a window policy.

This decision affects:
reschedule state transitions and capacity handling.
```

## Notes for the orchestrator

- Status `INPUT_RECOMMENDED`: bounded domain work may start now; surface gaps 1–3 to the founder early.
- Nothing here concluded "Cal does this → Tutoria should do this." Cal behavior appears only under EXTERNAL EVIDENCE with an explicit policy status.
- Evidence absent from the repository (booking tables/RLS, routes, the notification file) is reported as NOT FOUND, not silently treated as an assumption.
- If the founder resolves the decisions before QA preflight, `product_planner` converts them into product decisions and `qa_browser` writes the acceptance contract from them.