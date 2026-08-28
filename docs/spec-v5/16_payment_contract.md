# 16 — PAYMENT DETAIL / FINANCIAL STATE CONTRACT (PAY-detail)

**Surface:** the provider-agnostic payment/refund/payout state model and provider-adapter boundary. Complements `04_payment.md` (user-flow) — this is the state/domain detail.

---

## 16.1 Payment state machine

```text
payment: created(pending)
   ├─ provider success (verified webhook) ─> succeeded ──(booking confirm effect)
   ├─ provider failure ─> failed
   ├─ expired (worker TTL) ─> expired ─(release capacity, no charge)
   └─ refund request ─> refund obligation pending ─> succeeded | failed | ambiguous
```

`PAY-D-001` — `payments.status` ∈ {pending, succeeded, failed, refunded, expired}. Money terminality never written into `bookings.status` (`DOM-010`, `ARCH`).
`PAY-D-002` — A `succeeded` payment is terminal for collection; `refunded` handled via `refunds`, not by mutating status back.

## 16.2 Provider adapter boundary

- `PAY-D-010` — Adapter interface: `createCheckout`, `verifyCallback`, `generateIdempotentOperation`, `executeRefund`, `queryOperation`. Provider keying (`provider_event_key`, `operation_key`) is idempotent at DB (`DB-004`).
- `PAY-D-011` — Webhook ingestion order-safe: reordered/duplicate provider events converge to the correct terminal state using per-key idempotency + domain transitions (`PAY-020`).
- `PAY-D-012` — Amount/currency always from server snapshot; adapter never accepts client amount.

## 16.3 Refund state machine

```text
obligation(derived from cancel policy)
   ─> refund(pending, operation_key)
   ─> succeeded | failed | ambiguous
```

- `PAY-D-020` — Refund created only for collected funds; idempotent (`operation_key`).
- `PAY-D-021` — `ambiguous` refunds (e.g. provider timeout) surfaced to ops; not silently dropped.

## 16.4 Payout domain

- `PAY-D-030` — Host payouts computed from completed sessions + collected payments (separate from `payments`/learner side). `operation_key`-idempotent operations.
- `PAY-D-031` — Payout state machine mirrors refund (obligation→pending→succeeded|failed|ambiguous).

## 16.5 ACCEPTANCE CRITERIA

- `AC-PAYD-001` — A provider event replay converges to a single terminal payment state.
- `AC-PAYD-002` — Refund/payout are idempotency-keyed and cannot run twice.
- `AC-PAYD-003` — Payment state never written into BookingStatus.

---

## 16 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| PAY-D-001/003 | status separation | migrations | `TST-state` | `AC-PAYD-003` | DOM-010 |
| PAY-D-010 | adapter boundary | pay adapter | `ITST-adapter` | `AC-PAY-D` | — |
| PAY-D-011 | order-safe webhook | webhook | `ITST-webhook` | `AC-PAYD-001` | PAY-020 |
| PAY-D-020/030 | idempotent refund/payout | services | `ITST-refund/payout` | `AC-PAYD-002` | — |
