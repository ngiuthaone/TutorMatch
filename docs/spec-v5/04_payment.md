# 07/04 — PAYMENT CONTRACT (PAY)

**Surface:** checkout/payment intents, VNPay integration, webhooks, refunds, payouts, reconciliation, financial worker wiring (see also `17_worker_async.md`, `16_payment_contract.md`).
**Alpha status:** ALPHA CORE — money must move correctly and be fully auditable. **This is financial side-effect territory; do not route real money through demo/simulated paths.**
**Primary evidence:** `backend/src/services/booking-service.ts`, payment adapter, `payments`/`payment_attempts`/`payment_events`/`refunds`/`payment_provider_operations` tables, `discover/src/lib/payment-api.ts`.

> **Preserved domain separation:** Payment/Refund/Payout are their own domain, never merged into `BookingStatus`. The booking transitions to `confirmed` on the *effect* of a successful payment, but payment state does not live inside the booking.

---

## 04.1 Money truth model

### Entities (see `13_database.md` + `16_payment_contract.md`)
- `payments` — logical payment; fields: provider, status ∈ {pending, succeeded, failed, refunded}, amount (minor units), currency (VND), bookings linkage.
- `payment_attempts` — one per provider attempt; **idempotency_key** dedupes retries.
- `payment_events` — provider events.
- `payment_provider_events` — keyed by `provider_event_key` (idempotent ingestion).
- `payment_provider_operations` — keyed by `operation_key` (refunds/payouts idempotent).
- `refunds` — refund records.

`PAY-001` — All amounts are server-authoritative, derived from the accepted booking price snapshot (pricing resolved server-side). Client never sets amount.
`PAY-002` — Currency VND; minor units convention; no float. Amounts persisted as integers.
`PAY-003` — Idempotency: every payment-side mutation (checkout intent, capture, webhook, refund, payout) is keyed and safely applicable exactly-once even under duplicate/delayed/reordered delivery.

## 04.2 Checkout flow (PaymentIntent-style)

```
learner: POST /api/payments (offering, session, booking)   [needs auth]
   backend: create Booking held (BOOK-020) + Payment(pending) + PaymentIntent w/ idempotency_key
   backend: returns client secret / VNPay form params + payment_id
learner: redirect/prebuilt VNPay gateway
VNPay: POST return/callback + webhook event
   backend: verify signature (secure VNPay verify), update Payment via idempotent provider_event_key
payment succeeded → booking confirmed (effect, not merged state)
```

- `PAY-010` — Checkout is authorized and idempotent; the same booking cannot produce a second successful independent payment.
- `PAY-011` — VNPay return/callback signature **verified server-side**; caller-supplied amount/status is never trusted without provider verification.
- `PAY-012` — Provider webhook events are ingested once (`provider_event_key`), storing raw+canonical.

## 04.3 Webhook reliability

- `PAY-020` — Webhook handler is idempotent, replay-safe, order-safe (a "payment failed" after "succeeded" must not un-confirm an already-confirmed booking without an explicit domain transition and refund path).
- `PAY-021` — Failure paths never lose events: unhandled events are parked/retried (reliability in `17_worker_async.md`).
- `PAY-022` — Events that can’t be acted on are recorded as `ambiguous` and surfaced for ops, not silently dropped.

## 04.4 Refunds

- `PAY-030` — refund obligation is derived from domain policy (cancellation rules `DEC-*`), then executed via `operation_key` idempotent refund; state machine `obligation → pending → succeeded | failed | ambiguous`.
- `PAY-031` — Refund only returned for funds actually collected; partial refunds supported by explicit amount.
- `PAY-032` — Refunded payment records do not mutate `BookingStatus` beyond what domain policy requires; the held→released/cancel story stays in booking.

## 04.5 Payouts / reconciliation (financial worker)

- `PAY-040` — Host payouts computed from completed sessions; kept separate from learner payments.
- `PAY-041` — Reconciliation: worker matches payment_provider_operations vs payments to detect missing/leaked money. Notifications for `ambiguous`.
- `PAY-042` — The financial worker must not place payment states into `BookingStatus`; its output is to payment/refund/payout domain. (`FINW-*` in `17_worker_async.md`.)

## 04.6 Frontend payment surface

- `PAY-050` — `/payments/return` (exists) handles VNPay return; states: `SUCCESS`, `PENDING`, `FAILED`, `EXPIRED`, `UNKNOWN/AMBIGUOUS`.
- `PAY-051` — Payment return page always queries server truth for final status; never trusts URL query alone.
- `PAY-052` — Checkout button disabled while a `PaymentIntent` is `pending` to avoid double charge (idempotent anyway).
- `PAY-053` — Demo mode `PAYMENT EXPIRED`/`REFUND PENDING` states shown only as UI labels; real money never moves in demo.

## 04.7 PRODUCTION / REAL-MONEY DOOR (release gate)

- `PAY-060` — Real VNPay production keys, live payment, and prod refunds are **out of Alpha spec** until: secrets in safe env, worker deployed, webhook endpoint secured, reconciliation runbook exists, and a paid smoke test clears against an authorized provider. Until then, the loop is implemented but marked `UNVERIFIED-REAL-MONEY`.

## 04.8 ACCEPTANCE CRITERIA

- `AC-PAY-001` — A learner can complete a workshop payment and see the booking confirmed only after verified provider success returns.
- `AC-PAY-002` — Duplicate/replayed provider webhook does not double-charge or double-confirm.
- `AC-PAY-003` — A refund for a collected booking is idempotent and lands in `refunds` with `operation_key`.
- `AC-PAY-004` — Client-supplied amount could not change payment amount (server-authoritative price).
- `AC-PAY-005` — Expired pending payment path releases capacity (via worker) and does not charge.

---

## 07/04 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| PAY-001 | Server-authoritative amount | pay adapter | payments.amount | `TST-pay-amount` | `AC-PAY-004` | ARCH-005 |
| PAY-003 | Idempotency everywhere | pay lib | keys | `ITST-pay-idem` | `AC-PAY-002` | §17 |
| PAY-010 | Checkout idempotent | pay service | payment_attempts | `ITST-checkout` | `AC-PAY-002` | — |
| PAY-011 | Signature verify | webhook | provider events | `TST-webhook-sig` | `AC-PAY-001` | SEC-pay |
| PAY-012/020 | Webhook idempotent+order-safe | webhook | provider_event_key | `ITST-webhook` | `AC-PAY-002` | §17 |
| PAY-030 | Refund idempotent | refund svc | refunds,operation_key | `ITST-refund` | `AC-PAY-003` | §16 |
| PAY-040/041 | Payout+reconciliation | worker | provider ops | `ITST-reconcile` | `AC-PAY-005` | §17 |
| PAY-050/051 | Return page server-truth | return page | pay status api | `E2E-pay` | `AC-PAY-001` | — |
| PAY-060 | Real-money gate | — | — | gate | blocked/UNVERIFIED | REAL-012 |
