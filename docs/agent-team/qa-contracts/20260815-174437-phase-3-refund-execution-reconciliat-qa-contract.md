# QA Contract — Phase 3: Refund Execution + Reconciliation + Durable Recovery

Run: `20260815-174437-phase-3-refund-execution-reconciliat`

## Authority (in order)

1. Explicit Phase 3 instruction (orchestrator objective): refund execution semantics (accepted→pending→provider request; provider success→succeeded only with authoritative settlement proof; provider failure→failed; transport unknown→ambiguous); `operation_key = refund:<refundId>`, one logical Refund → one logical provider operation, retries/inspection reuse it; reconciliation candidates pending+ambiguous; late-payment compensation uses the SAME executor as `system_cancellation` (different `kind` for audit); refund failed → Booking remains cancelled; do NOT implement cancel/refund UI, payout, Tutor Center; COMMIT 1 provider/reconciliation, COMMIT 2 worker.
2. Accepted Phase 1/2 policy (frozen): P1 ≥24h FULL; P2 <24h NONE; P5 host FULL; P6 session cancel FULL per paid booking; P4 in-flight → late success creates `system_compensation` FULL; refund amount = authoritative persisted obligation; capacity stays released. `backend/src/domain/cancellation-refund-policy.ts` is the executable policy record.
3. External VNPay evidence (verified via official VNPay sandbox API docs, 2026-08-15): for `vnp_Command=refund` and `querydr`, `vnp_ResponseCode=00` means the API REQUEST was processed; the transaction result is `vnp_TransactionStatus` (00=success, 01=not complete, 02=error, 04=reversed, 05/06=refund in progress, 09=refund rejected). `vnp_ResponseCode` error table for refund: 91=not found, 94=duplicate already processing, 95=rejected/not successful, 93/02=invalid amount, 97=bad checksum. This makes `TransactionStatus=00` the authoritative settlement proof; a bare `ResponseCode=00` is NOT settlement.
4. Verified repository evidence: `backend/supabase/migrations/0008` (payments/refunds/payment_events/payment_provider_events/record_vnpay_observation/finalize_paid_booking/record_vnpay_refund_result), `0009` (payment_provider_operations), `0010` (obligation creation, cancellation paths, finalize guard), `0006` (event_outbox + claim/complete/fail primitives), `backend/src/services/payment-service.ts`, `vnpay-adapter.ts`, `routes/payments.ts`, `backend/test/payment-provider.test.ts`, `backend/test-integration/payment-provider-v1.test.ts`.
5. Approved decisions made in this run (orchestrator, from requirement + VNPay semantics): settlement-proof classification; obligation→pending via DB-level claim (`FOR UPDATE SKIP LOCKED`); reconciliation via querydr with query op evidence; worker = thin loop over service one-pass sweeps; source-of-truth tables (`refunds`, `payment_provider_operations`) drive recovery; outbox emits minimal REFUND_PENDING/SUCCEEDED/FAILED/AMBIGUOUS + PAYMENT_SUCCEEDED finalize retry via existing claim primitives.

## Scope

- Additive migrations only: `0011_refund_execution_reconciliation.sql` (COMMIT 1) and `0012_refund_recovery_worker.sql` (COMMIT 2). Do NOT edit 0001–0010 or the 2026* migrations; never amend `0b13c22`/`ab43b36`.
- Service/adapter/route changes in `backend/src/services/payment-service.ts`, `backend/src/services/vnpay-adapter.ts`, `backend/src/routes/payments.ts`; new pure classification helper; new worker runtime `backend/src/workers/financial-recovery-worker.ts`.
- New tests: `backend/test/refund-execution.test.ts` (pure classification/adapter) and `backend/test-integration/refund-execution-reconciliation.test.ts` (DB semantics + mocked provider); extend `payment-provider.test.ts` where consistent.
- NOT in scope: refund/cancel UI, payouts, Tutor Center, commission/fee accounting, notifications, real VNPay credentials, non-local Supabase.
- Do not use `git add .`/`git add -A`. Commit split per §34 of the objective.

## Acceptance criteria (20-point provider matrix A–T)

### A. Provider execution semantics
- A. Provider refund response `vnp_ResponseCode=00` AND `vnp_TransactionStatus=00` → op `succeeded`, refund `succeeded`, `payments.refunded_amount_vnd += amount`, `payment_events.refund_succeeded`, outbox `REFUND_SUCCEEDED`. NO other path may reach refund `succeeded`.
- B. Provider refund response `00` with `vnp_TransactionStatus=01|05|06` (or missing) → op `pending`, refund `pending` (awaiting settlement), NO credit, outbox `REFUND_PENDING`.
- C. Provider refund response `00` with `vnp_TransactionStatus=02|04|09` → op `failed`, refund `failed`, NO credit, outbox `REFUND_FAILED`.
- D. Provider refund response `vnp_ResponseCode != 00` (91/93/94/95/97/etc.) → op `failed`, refund `failed`, NO credit, outbox `REFUND_FAILED`.
- E. Transport unknown (HTTP error / network failure / timeout) → op `ambiguous`, refund `ambiguous`, outbox `REFUND_AMBIGUOUS`; never silently `failed` and never `succeeded`.
- F. `record_vnpay_refund_result` succeeded must not exceed `amount_vnd - refunded_amount_vnd` (REFUND_EXCEEDS_REMAINING); partial refund stays payment `succeeded`.
- G. Cumulative refunds == `payments.amount_vnd` → payment status `refunded`; partial → stays `succeeded`.
- H. Refund failure NEVER reverses the booking cancellation: booking remains `cancelled` and capacity stays released (no booking status change anywhere in the refund path).
- I. `operation_key = refund:<refundId>` is unique; retries/inspection reuse it; no new `refunds` row for a retry (idempotency_key reuse already enforced); provider request id uniqueness is scoped per retry, op_key is the stable logical identity.

### B. Reconciliation
- J. Duplicate `record_vnpay_refund_result` (already succeeded) returns `duplicate:true` and does NOT double-credit `refunded_amount_vnd`.
- K. `record_vnpay_refund_result` requires a real provider operation: unknown refund → UNKNOWN_REFUND; `p_provider_request_id` not matching an op row for that refund → rejected (no fabricated settlement).
- L. `record_vnpay_refund_result` `succeeded` requires settlement payload with `vnp_TransactionStatus=00` (and `vnp_ResponseCode=00`); otherwise INVALID_REFUND_RESULT. This is the DB-enforced authoritative settlement proof.
- M. Reconciliation sweep resolves `pending`/`ambiguous` refunds via querydr: provider query confirms settlement (ResponseCode 00 + TransactionStatus 00) → refund `succeeded`, op evidence recorded as a `query` operation with `refund_id` set.
- N. Reconciliation query still-processing (01/05/06) → refund stays `pending`/`ambiguous`; no false settlement, no credit.
- O. Reconciliation query rejected/errored (09/02/04/91) → refund `failed`.
- P. Reconciliation transport unknown → refund stays `ambiguous`, query op `ambiguous`.
- Q. Existing payment-attempt reconciliation (`reconcile(merchantReference)`, query op key `query:<merchantReference>`) continues to work unchanged.

### C. Durable worker / claiming
- R. Claim is DB-level: `claim_pending_refund_executions` moves `obligation`→`pending` atomically, sets `claimed_by/claimed_at/lease_until/attempt_count`, and two concurrent workers never claim the same refund row in the same lease window (`FOR UPDATE SKIP LOCKED`, real concurrency test).
- S. Lease recovery: a claimed-but-never-finished refund becomes claimable again after lease expiry (crash recovery); attempt_count is bounded (no infinite retries; a bounded max, then the refund remains observably `failed`/`ambiguous` in durable state, not deleted).
- T. Succeeded-payment finalize retry: `PAYMENT_SUCCEEDED` outbox event is claimed, `finalize_paid_booking` runs, event completes; transient finalize failure → `fail_event` with backoff → retry recovers and completes; late-success compensation obligation executes through the SAME refund executor as `standard` refunds (`kind` distinguishes audit).

### D. Observability / security / events
- Refunds in `failed`/`ambiguous` are durably queryable (status + last_error + op rows with response_payload).
- Outbox event types `REFUND_PENDING/SUCCEEDED/FAILED/AMBIGUOUS` added to the vocabulary check; emitted only by SECURITY DEFINER RPCs.
- `payment_provider_operations` gains no authenticated/anon access; the internal routes stay gated by `x-tutoria-reconciliation-token`; no browser-callable financial executor.
- Refund op `response_payload` (full provider response) persisted; request_payload persisted; amount/currency consistent.

### E. Migration / harness integrity
- From a clean local DB: `supabase db reset` applies 0001→0012 cleanly.
- Full integration suite (all existing files + new ones) passes in freshly-reset serial mode (`pnpm test:integration --no-file-parallelism` after `supabase db reset --local --yes`).
- `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check` PASS.
- Harness refuses non-local targets (hostname guard).
- The pre-existing 110 tests (12 integration files) remain PASS; new tests add to the count.

## Evidence required for PASS

- New unit + integration tests naming criteria A–T.
- Authoritative-row cross-checks: refunds/payment_provider_operations/payments/outbox rows after each scenario.
- Security manual review of the new surface recorded (privileges, SECURITY DEFINER, search_path, RLS, token-gated routes); scanners SKIPPED (not installed) reported as skipped.
- Reliability/failure matrix (≥12 scenarios incl. crash-after-provider-call, two-worker race, late-success during sweep) documented.
- `independent_verifier` verdict against the original requirement + real final diff.
- Final classification exactly `PASS — TUTOR REFUND EXECUTION + RECONCILIATION BASELINED` (never REJECTED).

## Contract changes

Recorded via `scripts/team-observability.py contract-change`, approved by orchestrator only. Criteria may not be silently weakened by implementation.
