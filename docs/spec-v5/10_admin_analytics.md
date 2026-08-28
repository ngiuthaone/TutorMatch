# 07/10 — ADMIN & OPERATIONS CONTRACT (ADM / ANL)

**Surface:** admin/support tooling and operational/analytics surfaces for the Alpha loop.
**Alpha status:** minimal ops capability required to run Private Alpha safely (support refund, reconcile money, block misuse); broad admin Post-Alpha.
**Primary evidence:** reconciliation (`PAY-041`/`ANL-011`), admin role (`ROLE-002`).

---

## 10.1 Admin scope (Alpha)

- `ADM-010` — Admin attendee records lookup for support (guarded, no raw private fields unless authorized + tenant-scoped).
- `ADM-011` — Refund operations: initiate/approve refunds idempotently against `refunds` domain (`PAY-030`).
- `ADM-012` — Money reconciliation dashboard: bookings vs payments, `ambiguous` events, refunds, payouts (`ANL-011`).
- `ADM-013` — User/role management (role elevation via service-role, `ROLE-003`).
- `ADM-020` — Full CRUD admin CMS/moderation/content tooling Post-Alpha.

## 10.2 Admin authorization

- `ADM-030` — Admin actions backed by admin role + backend authorization; admin UI is a thin client over authorized APIs (`ROLE-002`, `SEC`). No admin UI bypass of RLS.
- `ADM-031` — Audit trail of admin money actions via existing history/outbox; no swaps of money state outside domain.

## 10.3 ACCEPTANCE CRITERIA

- `AC-ADM-001` — Admin refunds are idempotent and auditable.
- `AC-ADM-002` — Reconciliation view flags `ambiguous` money.
- `AC-ADM-003` — Admin role cannot be self-elevated; elevation service-role only.

---

## 10 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| ADM-011 | idempotent admin refunds | admin svc | `ITST-refund` | `AC-ADM-001` | PAY-030 |
| ADM-012 | reconciliation | admin+worker | `ITST-reconcile` | `AC-ADM-002` | ANL-011 |
| ADM-013 | role elevation svc-role | auth | `TST-role` | `AC-ADM-003` | ROLE-003 |
| ADM-030 | admin authz | RLS/api | `TST-admin-acl` | `AC-ADM-001` | SEC |
