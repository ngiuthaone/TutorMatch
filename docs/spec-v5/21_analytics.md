# 21 — ANALYTICS CONTRACT (ANL)

**Surface:** product/business analytics (bookings, revenue, host/learner funnel, operational reconciliation).
**Alpha status:** minimal operational analytics + reconciliation dashboards for the Alpha loop; broad product analytics Post-Alpha.
**Primary evidence:** financial worker reconciliation (`PAY-041`), earnings (`HOST-005`).

---

## 21.1 Contract

- `ANL-010` — Analytics source of truth is the DB domain (bookings/payments/sessions); never client event-window aggregates for money.
- `ANL-011` — Reconciliation dashboards (ops/admin): bookings vs payments, `ambiguous` events, refunds, payouts, capacity integrity. `ADM-*`/`ANL-*`.
- `ANL-012` — Host earnings analytics server-computed (`HOST-005`).
- `ANL-020` — Broad product/site analytics (funnels, retention, attribution) **Post-Alpha** (`TDEC-*`). If a product-analytics SDK is added, run `license_guard` first.

## 21.2 ACCEPTANCE CRITERIA

- `AC-ANL-001` — Reconciliation view flags mismatches (`ambiguous` money).
- `AC-ANL-002` — Host earnings reflect completed-session payout-eligible totals server-side.
- `AC-ANL-003` — No money aggregate derived from client-side tracking.

---

## 21 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| ANL-010 | DB-source analytics | — | — | `AC-ANL-003` | — |
| ANL-011 | reconciliation | worker+admin | `ITST-reconcile` | `AC-ANL-001` | PAY-041 |
| ANL-012 | host earnings | earnings | `TST-earn` | `AC-ANL-002` | HOST-005 |
