# TUTORIA — OPERATIONAL IMPLEMENTATION PLAN
**Companion to `docs/TUTORIA_MASTER_SPEC_v5.0.md` + `docs/spec-v5/*`**
**Date:** 28 Aug 2026 · **Branch:** `consolidation/2026-08-20-pre-manus` (head `ca0c5e2`)

This is the execution schedule: *which agent does which verified `IMP-*` item, in what order, with what gate*. It is grounded — every named RPC/file was verified against the current repo this session (corrections applied to the spec). Items are gated so no agent builds on unbuilt or unapproved prerequisites.

---

## 0. Grounding corrections applied to v5.0 (read first)

| # | Earlier v5.0 claim | Verified reality (this session) |
|---|---|---|
| C1 | create_booking signature `(offering, session, participant_count)` | Real: `create_booking(session_id uuid, participant_count int DEFAULT 1, p_idempotency_key text DEFAULT null)`. **Offering is derived from `sessions.offering_id`, not passed.** |
| C2 | Sweep RPC named `sweep_expired_workshop_bookings` | Real RPC: `expire_stale_workshop_bookings(text)`; service method `sweepExpiredWorkshopBookings` (`payment-service.ts:206`) calls it. Neither dispatched by `runFinancialWorkerIteration`. |
| C3 | `events-live` = `offeringType` vs RPC `kind` mismatch | Real: `offeringType` is a real field; bug is `page.tsx:30` compares `!== "event"` while the surface serves `workshop` offerings. |
| C4 | Replay defect = certain `offerings_pricing_model_check` 42710 | Migration adds that constraint; **no in-repo partner** found → must be **reproduced at apply** (likely remote-only `20260817160000/01`). |
| C5 | `20260820130000` "not applied" | It is **committed** (`ca0c5e2`); it is in-repo but not on prod. Prod-side state UNVERIFIED. |
| C6 | Booking detail API missing | Frontend `getLearnerBooking(bookingId)` **already exists** (`booking-api.ts:193`); the **route** `/bookings/[id]` is missing. |

Also verified present/real: frontend `createWorkshopBooking(sessionId, participantCount)`, `listLearnerBookings`, `cancelLearnerBooking(bookingId, expectedVersion, reason)`, `listHostBookings`, `startWorkshopPayment(bookingId)`.

---

## 1. Phase teams & roles

| Agent | Role in this plan |
|---|---|
| You (owner) | Approve the PH-0 migration gate (prod DDL) + the PH-3 real-money gate. Resolve `DEC-*`. |
| `database_engineer` | All PH-0/PH-2 SQL: migrations, RPC reconciliation, capacity/CAS/idempotency, RLS. |
| `backend_engineer`/`integration_engineer` | PH-2/PH-3 service wiring, worker dispatch, payment adapter, webhook. |
| `frontend_engineer` | PH-1/PH-3/PH-4 routes & UI (workshop detail fix, `/bookings/[id]`, creator rewrite). |
| `qa_engineer` | Integration/concurrency (`ITST-*`) against clean DB. |
| `qa_browser` | Preflight + post E2E acceptance on dev. |
| `security_reviewer` | RLS/authz/payment review — invoke at PH-2 and PH-5. |
| `independent_verifier` | Read-only final acceptance at each gate that touches persistence/money. |

---

## 2. Execution phases (executable, gated)

### PH-0 — Migration & DB reconciliation `[OWNER-GATED]`
**Goal:** clean, replayable, parity migrations; canonical `create_booking`.
**No `IMP-*` below may start until this gate clears.**

| Step | Agent | Task (verified) | Verify |
|---|---|---|---|
| 0.1 | database_engineer | Reset a scratch local DB; replay migrations to reproduce the `20260820100000` failure; confirm whether `20260817160000/01` (remote-only, absent) is the partner. **Do not alter committed migrations to "fix" without owner** (C4). | repro log |
| 0.2 | database_engineer | Bring repo≈prod parity or document `UNK-003` divergence explicitly. | `MIG-011` |
| 0.3 | database_engineer | Confirm `20260820130000` (committed `ca0c5e2`) gives canonical `create_booking(session_id,int,idempotency_key)` and `expire_stale_workshop_bookings` grants (`service_role`). | `TST-rpc-create`,`AC-RPC-001` |
| 0.4 | **owner** | Approve applying corrective migrations to prod (if/when changes above are needed beyond what's already committed). | sign-off |
| **GATE** | independent_verifier | Clean-seed replay 27/27 + `create_booking` canonical verified. | `AC-RPC-001` |

### PH-1 — Workshop vertical slice (dev/demo loops)
**Deps:** PH-0. **Goal:** workshop discoverable + detail correct + real creator persistence.

| Step | Agent | Task (IMP-*) | Verify |
|---|---|---|---|
| 1.1 | frontend_engineer | Fix `events-live/[slug]/page.tsx:30` to compare against the surface's real kind (`workshop`) or use the workshop detail query (C3). | `TST-work-bug`, `AC-WORK-005` |
| 1.2 | frontend_engineer | Wire workshop detail/list to verified RPCs (`get_offering`, `list_sessions_by_offering_id`, `list_bookable_sessions`); server capacity/price. | `AC-WORK-002/003` |
| 1.3 | backend_engineer | Replace localStorage creator (`published-event-store.ts`) with `create_offering` + session persistence, host-owned + RLS. | `TST-work-create`, `AC-WORK-004/006` |
| 1.4 | frontend_engineer | Enforce demo/live separation on dev (demo = read-only labels; live tx only against real backend). | `TST-demo-gate`, `AC-SEC-005` |
| **GATE** | qa_browser | JRN-001/002 pass on dev (desktop + mobile). | `AC-WORK*`, `AC-DISC*` |

### PH-2 — Booking engine + capacity + worker expiry `[security review here]`
**Deps:** PH-1. **Goal:** authoritative booking, atomic capacity, CAS, expiry dispatched.

| Step | Agent | Task (IMP-*) | Verify |
|---|---|---|---|
| 2.1 | database_engineer | Verify/assert atomic capacity + CAS inside `create_booking` (`select ... for update` session-first; recount+rollback). | `ITST-capacity`, `ITST-cas`, `AC-BOOK-002/003` |
| 2.2 | integration_engineer | Dispatch `sweepExpiredWorkshopBookings` (`expire_stale_workshop_bookings`) in `runFinancialWorkerIteration` — **the `BLK-002` fix**. | `ITST-sweep`, `AC-WORKER-001`, `AC-BOOK-004` |
| 2.3 | backend_engineer | Map verified RPC error codes (`SESSION_NOT_OPEN`, `BOOKING_CONFLICT`, `book create attempt limit`, `BOOKING_PRICE_NOT_SNAPSHOTTED`) to clean API responses. | `TST-api-err` |
| 2.4 | security_reviewer | Review `create_booking` authn/authz (`assert_verified_booking_caller`), idempotency fast-path, `consume_booking_create_attempt` limiter. | `TST-rpc-acl`, `AC-SEC-002/003` |
| **GATE** | qa_engineer | Concurrency suite against clean DB: capacity/CAS/sweep/regression (integration suite unblocked — replaces `REAL-011` UNVERIFIED). | `AC-BOOK*` |

### PH-3 — Payment + booking detail (money-correct path) `[owner money-gate]`
**Deps:** PH-2. **Goal:** learner pays, lands on `/bookings/[id]`, can view/cancel/receipt; worker reconciles.

| Step | Agent | Task (IMP-*) | Verify |
|---|---|---|---|
| 3.1 | frontend_engineer | Create `discover/src/app/bookings/[id]/page.tsx` using existing `getLearnerBooking` + `get_booking_cancellation_preview`; owner/host guard; states `PAYMENT EXPIRED`/`REFUND PENDING`. | `TST-learn-detail`, `AC-LEARN-001/002/003` |
| 3.2 | integration_engineer | Complete payment adapter + webhook: signature-verified, idempotent (`provider_event_key`), order-safe; confirm booking only on verified success. | `ITST-webhook`, `TST-webhook-sig`, `AC-PAY-001/002` |
| 3.3 | payments/backend | Idempotent refund + payout (`operation_key`); no payment state in `BookingStatus`. | `ITST-refund`, `ITST-payout`, `AC-PAY-003`, `AC-PAYD` |
| 3.4 | integration_engineer | Payment return page reads server truth (not URL alone). | `E2E-pay`, `AC-PAY-001` |
| **GATE (owner)** | — | Real-money readiness: provider keys in safe env, worker deployed, webhook secured, reconciliation runbook, paid smoke test against authorized provider. Until then status = `UNVERIFIED-REAL-MONEY` (`PAY-060`). | `AC-PAY-004/005` |

### PH-4 — Host native + tutor loop (second Alpha loop)
**Deps:** PH-2/PH-3. 

| Step | Agent | Task | Verify |
|---|---|---|---|
| 4.1 | frontend_engineer | Native Host Center tabs (workshops/bookings/attendees/earnings) server-backed. | `AC-HOST-*` |
| 4.2 | backend+db | Tutor 1:1 booking via shared engine (`hourly_v1`), slot CAS double-book guard. | `ITST-slot`, `AC-TUT-002/003` |
| 4.3 | infra+security | Provision storage buckets + policies (avatar/thumbnail upload). | `AC-STG-*` |
| 4.4 | qa_browser | JRN-004 tutor loop passes. | `AC-TUT*` |

### PH-5 — Alpha release hardening
- security_reviewer + independent_verifier PASS on the Alpha loop; observability + runbook; `RTM2-*` released evidence.

### PH-6+ — Post-Alpha (deferred by default)
- Events/classes/courses on shared engine, social/communities/discussions/articles, messaging+realtime, full LMS, reviews — each promoted only via explicit `DEC-*`.

---

## 3. Gate checklist per phase

- [ ] Every `IMP-*` completes its verified `AC-*` + test.
- [ ] `qa_browser` preflight contract defined before each user-facing phase; verified after (never silently weakened).
- [ ] Money/lifecycle/persistence phases get `independent_verifier` acceptance and `security_reviewer` where applicable.
- [ ] Owner approval captured for PH-0 (prod DDL) and PH-3 (real money).
- [ ] Status labels truthful: PASS / PARTIAL / UNVERIFIED / BLOCKED (never imply success without evidence).

## 4. Immediate first action (not gated on decisions)

**PH-0.1** — reproduce the migration replay failure in a scratch DB to confirm the defect source (C4) before touching anything. This is read/scratch only and safe to run now.

---
*End of operational plan. Corrections C1–C6 are already reflected in `docs/spec-v5/` and `docs/TUTORIA_MASTER_SPEC_v5.0.md`.*
