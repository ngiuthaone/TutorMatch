# 08 — Payment & Payout Reconstruction

Provider: **VNPay**. Derived from `backend/src/services/vnpay-adapter.ts`,
`payment-service.ts`, `routes/payments.ts`, `domain/payment-lifecycle.ts`,
`payout-statement.ts`, `refund-calculation.ts`, and migrations
`0008`–`0012`, `0009`, `0011`.

## Payment architecture

- **Tables**: `payments` (booking_id unique; status pending/succeeded/failed/
  refunded), `payment_attempts` (idempotency_key, merchant_reference unique),
  `payment_events`, `payment_provider_events` (provider_event_key unique),
  `payment_provider_operations` (operation_key unique; query/refund),
  `refunds` (obligation/pending/succeeded/failed/ambiguous).
- **Initiation**: `POST /api/v1/payments/start` (auth) → `start_payment_attempt`
  → returns VNPay redirect URL. `GET /payments/:bookingId` returns state.
- **Webhook**: `GET /api/v1/payments/vnpay/ipn` (open, unauthenticated,
  signature-verified via timingSafeEqual) → `record_vnpay_observation`
  (idempotent via provider_event_key).
- **Idempotency**: provider operations + attempts keyed upsert; transport-unknown
  → `ambiguous`.
- **Refunds**: `cancel_*`/TTL paths emit `REFUND_OBLIGATION_CREATED`; worker
  `sweepRefundExecutions`/`sweepRefundReconciliations` claim and push/poll VNPay.
- **Payout/commission**: `payout-statement.ts` domain models host payout +
  platform fee; `GET /api/v1/payouts`, `GET /api/v1/host-compliance`,
  `/payout-eligible`. **No provider disbursement integration found.**

## Payment ↔ booking relationship

Payment keyed 1:1 to booking. `approve_booking_for_payment` (host) OR `instant`
mode gates `start_payment_attempt`. `finalize_paid_booking` (service_role,
worker `payment_finalization` sweep) marks booking confirmed on payment success
and emits `BOOKING_CONFIRMED` / `BOOKING_FINALIZATION_FAILED` /
`REFUND_OBLIGATION_CREATED`.

## Decision matrix

| Question | Answer |
|---|---|
| Code exists? | YES — adapter, service, routes, migrations |
| Configuration exists? | YES — env names in `.env.example`, hosted keys present in `.env` (values redacted) |
| Sandbox e2e script? | YES — `backend/e2e-vnpay-sandbox.mjs` (exists; not executed in this audit) |
| Production configured? | UNKNOWN — production VNPay merchant/keys not verified; worker enforces prod=sandbox mismatch guard |
| Production runtime verified? | NO — no evidence of live VNPay transaction |
| Webhook verified? | NO (open route exists; provider allowlist + HTTPS origin per docs UNKNOWN) |
| Refund verified (live)? | NO (code + integration tests written, but local-DB drift blocks re-run; no live provider refund) |
| Payout verified (live)? | NO (model only, no provider) |

## Bottom line

**IMPLEMENTED_UNTESTED-in-production.** The payments/refunds code is real,
idempotent, reconciliation-oriented, and heavily tested at unit/integration
level, but **no live production payment/refund/payout was verified**, production
VNPay credentials are UNKNOWN, and the financial worker has the workshop-TTL
dispatch gap. It would be false to call VNPay "production-ready" on current
evidence.
