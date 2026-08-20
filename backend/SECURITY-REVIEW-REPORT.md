# Security Review Report — Section 12 Additive Merge

**Date:** 2026-08-19
**Branch:** temp-deploy (commit 9a656b8)
**Additive merge commit:** 057e438
**Scope:** 19 files, +2487 lines
**Auditor:** Independent security reviewer (code review)

---

## 1. Authentication Enforcement on All Routes — PASS

| Route | Auth | Verdict |
|-------|------|---------|
| POST /api/v1/payments/start | app.authenticate | PASS |
| GET /api/v1/payments/:bookingId | app.authenticate | PASS |
| GET /api/v1/payments/vnpay/ipn | None (VNPay callback) | PASS |
| POST /api/v1/internal/payments/reconcile | x-tutoria-reconciliation-token | PASS |
| POST /api/v1/internal/payments/refunds/execute | x-tutoria-reconciliation-token | PASS |
| GET /api/v1/policies | None (public listing) | PASS |
| POST /api/v1/policies/accept | app.authenticate | PASS |
| GET /api/v1/policies/check | app.authenticate | PASS |
| GET /api/v1/policies/my-acceptances | app.authenticate | PASS |
| GET /api/v1/host-compliance | app.authenticate | PASS |
| GET /api/v1/host-compliance/payout-eligible | app.authenticate | PASS |
| GET /api/v1/payouts | app.authenticate | PASS |
| POST /api/v1/admin/audit-log | [app.authenticate, requireAdmin] | PASS |
| GET /api/v1/admin/audit-log | [app.authenticate, requireAdmin] | PASS |
| GET /api/v1/admin/search/users | [app.authenticate, requireAdmin] | PASS |
| GET /api/v1/admin/disputes | [app.authenticate, requireAdmin] | PASS |
| GET /api/v1/admin/host-cancellations | [app.authenticate, requireAdmin] | PASS |
| GET /api/v1/dashboard/overview | [app.authenticate, requireAdmin] | PASS |

---

## 2. Authorization (admin, service-role, ownership) — PASS

- `admin-role.ts:16-35` — requireAdmin reads caller's own profile via user's JWT (RLS ensures they can only read their own `profiles` row) and checks `role === 'admin'`. Deny-by-default.
- Payment routes create per-request Supabase client with caller's JWT (`payment-service.ts:30`), so RLS enforces ownership.
- Dashboard uses service-role key (`dashboard.ts:22-29`) but gated behind `[app.authenticate, requireAdmin]`.
- Internal routes use static `PAYMENT_RECONCILIATION_TOKEN`.

---

## 3. Server-Authoritative Pricing — PASS

- `payments.ts:7` — startSchema only accepts `bookingId` and `idempotencyKey`. No `amount` field.
- `payment-service.ts:53` — `start_payment_attempt` RPC computes authoritative price server-side.
- `vnpay-adapter.ts:22` — VNPay amount is always `Math.round(input.amountVnd) * 100` where `input.amountVnd` comes from RPC result.
- `refund-calculation.ts:63-122` — Refund amounts from `priceSnapshotVnd` (server snapshot), no client override.

---

## 4. VNPay HMAC-SHA512 Timing-Safe Signature Validation — PASS

`vnpay-adapter.ts:29-35`:
- HMAC-SHA512 via `node:crypto` (`createHmac("sha512", secret)`)
- `timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))` — prevents timing oracle
- Length check before `timingSafeEqual` — correct pattern
- Filters to `vnp_*` keys, excludes `vnp_SecureHash`/`vnp_SecureHashType`
- Sorted keys for deterministic canonical form
- IPN handler (`payments.ts:32`) returns early with `RspCode: "97"` on invalid signature

---

## 5. Input Validation / Injection Risks — PASS

- All route inputs validated via Zod schemas:
  - `payments.ts:7` — `bookingId: z.string().uuid()`, `idempotencyKey: z.string().trim().min(16).max(128)`
  - `payments.ts:26` — `bookingId` UUID-validated from params
  - `payments.ts:39` — `merchantReference: z.string().trim().min(8).max(128)`
  - `admin.ts:6-13` — `auditLogSchema` with length limits
  - `admin.ts:15-18` — `searchSchema` with `q: z.string().trim().min(1).max(200)`
  - `policies.ts:7-19` — `policyTypeSchema` enum-constrained

- INFO: `admin-service.ts:106` — `ilike("email", `%${query}%`)` with unsanitized `%`. Not SQL injection (parameterized), admin-only.

---

## 6. Secrets Exposure in Logs/Responses — PASS

- `server.ts:36` — Logger redacts `req.headers.authorization`, `*.accessToken`, `*.refreshToken`, `*.password`, `*.secretKey`
- Error handler (`app.ts:81-96`) returns generic messages for unhandled errors
- No `console.log` of secrets
- VNPay `hashSecret` only used in HMAC computation, never logged

---

## 7. SQL Injection / RLS Bypass Risks — PASS

- All database access uses Supabase PostgREST client (`.from()`, `.select()`, `.rpc()`), parameterized
- No raw SQL queries in audited code
- Dashboard service-role client bypasses RLS but gated behind `[authenticate, requireAdmin]`

---

## 8. Financial Reconciliation Correctness — PASS

- `payment-service.ts:58-62` — VNPay observation: `record_vnpay_observation` RPC + `finalize_paid_booking` RPC
- `payment-service.ts:64-83` — Reconcile: operation-key dedup, idempotent upsert, then `observe()`
- `payment-service.ts:85-113` — Refund: fetches authoritative refund record, terminal-state checks, operation-key dedup
- Worker sweeps (`payment-service.ts:146-204`): lease-based claiming, worker ID tagging, backoff

---

## 9. Race Conditions in Payment/Booking State — PASS

- `payment-service.ts:53` — `start_payment_attempt` RPC handles capacity/price snapshot atomically in database
- `payment-service.ts:60-61` — `record_vnpay_observation` + `finalize_paid_booking` are sequential RPCs
- `payment-service.ts:102-103` — Refund operation insert uses unique `operation_key`
- Worker lease mechanism prevents concurrent processing
- `payment-service.ts:73` — Reconciliation upsert uses `onConflict: "operation_key", ignoreDuplicates: true`

---

## 10. Error Message Information Leakage — PASS

- `app.ts:85` — ApiError: `{ code: error.code, message: error.message }` — safe messages
- `app.ts:96` — Unhandled: `"An internal error occurred."` — no stack trace
- `payments.ts:16` — Generic fallback: "Payment service is temporarily unavailable."
- `payments.ts:35` — VNPay IPN: `{ RspCode: "99", Message: "Processing error" }` on internal failure

---

## Overall Security Verdict: PASS

No authentication bypasses, no client-trusted financial amounts, no SQL injection vectors, no secrets leakage, no race-condition exploits. All routes properly authenticated and authorized. Financial operations delegate to server-side RPCs with idempotency and lease mechanisms.
