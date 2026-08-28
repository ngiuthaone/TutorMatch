# 28 — TEST CONTRACT (TEST)

**Purpose:** unit + integration test contract that must prove the Alpha loop (`BOOK`/`PAY`/`RPC`/`WORKER`) is correct. Distinct from E2E (#29) and runtime verification (#30). Follows `tutoria-backend-qa` adversarial intent.
**Current baseline:** backend 337/337 unit PASS; discover 165/165; root auth 100/100. Integration suite `UNVERIFIED` (blocked by local DB drift `REAL-011`).

## TEST ID scheme (umbrella)

Canonical test requirement prefix is `TEST-*`. Concrete sub-scopes (referenced in surface RTM tables):
- `TEST-U<NN>*` = **unit** tests (short form `TST-*`).
- `TEST-I<NN>*` = **integration** tests (short form `ITST-*`).
- `TEST-E<NN>*` = **E2E** tests (owned by §29, short form `E2E-*`).
Both the `TEST-*` umbrella and the `TST-*`/`ITST-*` concrete IDs are valid references; `TEST-*` is the canonical requirement-level ID.

- `TEST-101` — every Alpha-critical RPC/worker/domain path has unit coverage.
- `TEST-102` — every Alpha-critical concurrency/money/state path has integration coverage against a real DB.
- `TEST-103` — existing unit baselines (337/165/100) preserved; new tests additive (no regression).

---

## 28.1 Unit tests (TST-* = TEST-U*)

| TST-0xx | Area | Proves |
|---|---|---|
| TST-book-status | booking status enum | no paid-in-BookingStatus |
| TST-price | pricing resolver | `flat_per_participant_v1`/`hourly_v1`; server-authoritative |
| TST-rpc-create | create_booking sign/parse | canonical 3-arg |
| TST-auth-* | auth/session/403 | non-leaky authz |
| TST-work-* | workshop create/detail/list | real persistence (creator), detail bug fixed |
| TST-learn-detail | booking detail access | owner/host guard |
| TST-state | domain state machines | payment not in BookingStatus |
| TST-leak | privacy | no auth id/private contact in public |
| TST-contact | booking contact capture | phone VN-format validated + persisted + host-of-session-only RLS |
| TST-onboard | onboarding parity | all collected cv fields persist to backend; no silent drop |

## 28.2 Integration tests (ITST-*; run against clean DB)

| ITST-0xx | Area | Proves |
|---|---|---|
| ITST-capacity | capacity atomicity | no over-capacity; rollback (concurrency) |
| ITST-cas | optimistic concurrency | conflict on stale |
| ITST-idem | payment idempotency | no double charge on replay |
| ITST-webhook | webhook order/replay-safe | converges to single terminal state |
| ITST-refund | refund idempotent | `operation_key` once |
| ITST-payout | payout idempotent | once |
| ITST-sweep | expiry sweep | releases capacity (`REAL-007`) |
| ITST-approval | approval-mode confirm/reject | reject releases capacity |
| ITST-slot | tutor slot double-book | no double-book |
| ITST-ratelimit | booking abuse limiter | 429 on burst |
| ITST-outbox | outbox delivery | retries/park |
| ITST-claim | worker claim atomicity | no duplicate side effects |
| ITST-reconcile | reconciliation | flags ambiguous |
| ITST-mig | migration replay | clean 27/27 seed replay |
| ITST-adapter | provider adapter boundary | idempotent adapter ops |

## 28.3 Concurrency requirement

- `TST-010` — Pure unit tests do NOT prove DB concurrency. Capacity/CAS/webhook/refund/payout/claim require `ITST-*` running concurrently against a real Postgres; otherwise `UNVERIFIED`.

## 28.4 Baseline & regression

- `TST-020` — Preserve 337/165/100 unit baselines; new tests additive.
- `TST-021` — Integration suite must reach PASS once migrations reconcile (`GAP-001..004`); current `UNVERIFIED` (`REAL-011`) must be replaced by evidence, not assumed.

## 28.5 ACCEPTANCE

- `AC-TST-001` — All Alpha-critical RPC/worker paths have unit + integration tests.
- `AC-TST-002` — Concurrency tests run against real DB; results recorded.
- `AC-TST-003` — No regression in existing unit baselines.
