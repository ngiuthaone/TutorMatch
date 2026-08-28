# QA Contract — EXAMPLE — Booking cancellation / rescheduling domain model

> **HYPOTHETICAL EXAMPLE** — Format example only. Produced by `qa_browser` QA preflight for the **hypothetical** task "Add a Tutoria booking cancellation/rescheduling domain model". No implementation was performed or intended. Real contracts follow this shape and live in this directory as `<run-id>-qa-contract.md`, referenced from `.codex/team-runs/<run-id>.json` via `contract_path`. Evidence claims are labeled and only state verified repository facts or explicit absences.

## Authority

Derived in this order (see AGENTS.md orchestration policy):
1. Explicit user instruction: "Add a Tutoria booking cancellation/rescheduling domain model."
2. Tutoria product policy / `docs/agent-team/TUTORIA_PRODUCT_BRAIN.md` (trust before transaction; booking lifecycle; authorization authority in backend).
3. Established production behavior and domain architecture — verified in this repository: `backend/src/domain/booking-lifecycle.ts` (pure domain state machine) and `backend/test/booking-lifecycle.test.ts`. **Explicitly not verified: booking API routes/services and Supabase booking tables/RLS are absent** (`backend/supabase/migrations/` holds only 0001_profiles, 0002_tutor_cvs, 0003_marketplace_listings) — authorization and persistence must be designed, not assumed.
4. Approved architecture decisions made in this run.

Prototypes (e.g., `discover/public/pizza-workshop.html`) and external references were consulted only as supporting evidence and do not themselves create requirements.

## Scope

- Domain model for booking cancellation/rescheduling in the production backend (`backend/`).
- Not in scope: payments/refunds logic, notification copy, UI work, root SPA demo behavior.

## Actors and permissions

- Learner (booking owner) may request cancellation/rescheduling of own active booking.
- Tutor may cancel a booking participant under defined product rules.
- Workshop host cancel affects one participant booking, never the entire session (see invariant below).
- Non-owner, unauthenticated, and unauthorized actors may not mutate bookings (401/403/404 without leaking existence).

## Acceptance criteria

### A. State machine / transitions (domain correctness)
- A1. Valid transitions: booked → cancelled; booked → rescheduled-pending → rescheduled (per the approved product decision on lifecycle).
- A2. Invalid transitions are rejected: cancel/reschedule from `cancelled`, `completed`, or any terminal/unknown state returns an explicit 409-style domain error.
- A3. A failed transition must not emit a successful domain event (no `booking_cancelled` notification/event when the transition failed).
- A4. State changes are atomic: no partial write leaves the booking in an inconsistent state.

### B. Authorization
- B1. Unauthorized participants cannot mutate bookings (assert 403/401 and no state change in persistence).
- B2. One participant's cancellation must not cancel the entire session/workshop booking; other participants' bookings remain `booked` (regression guard).
- B3. Authorization is enforced by backend permissability, not client metadata.

### C. History / persistence
- C1. Booking history (prior states, who changed what, when) is preserved for cancelled/rescheduled bookings where the chosen domain model requires it.
- C2. Cancelled/rescheduled bookings remain readable for history without exposing private contact data.

### D. Edge and negative cases
- D1. Cancel/reschedule of a non-existent booking yields 404-style result without revealing booking existence to unauthorized actors.
- D2. Double-cancel and double-reschedule requests are rejected as invalid transitions (no silent idempotency inventing product behavior).
- D3. Concurrent cancel + reschedule requests serialize to a single winner; the losing operation is rejected, not applied twice.

### E. Forbidden behavior
- E1. No deletion of booking rows as a substitute for cancellation (history loss).
- E2. No demo/localStorage/JSON-file persistence or simulated payment behavior promoted to production paths.

## Regressions that must not occur

- Existing booking creation/confirmation flow continues to pass its current tests.
- Authorized learner self-service cancel from existing UI paths keeps working.

## Evidence required for PASS

- Backend unit/integration tests covering A1–D3 (each criterion named).
- Authorization tests per actor role (B1–B3).
- Persistence audit query proving history retained (C1).
- No new console/network/runtime errors on the affected tutor/learner surfaces if UI is touched.
- Security review PASS for new endpoints/mutations; license evidence only if external material is incorporated.

## Unresolved — PRODUCT_DECISION_REQUIRED

- **Replacement vs in-place rescheduling**: whether a reschedule creates a new booking entity or mutates the existing one is a product/domain decision not yet resolved. QA will convert the orchestrator's decision into criteria for a new booking id vs state change, participant notification timing, and history treatment.
- Whether tutor-initiated cancellation requires learner acknowledgment.

## Verification mode (later)

Verification runs against this original contract; any criterion change is recorded (original, reason, authorizer, revised) via `scripts/team-observability.py contract-change` and approved by the orchestrator.