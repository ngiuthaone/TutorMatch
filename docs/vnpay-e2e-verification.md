# VNPay end-to-end verification

This document describes the manual end-to-end verification flow for the
VNPay sandbox against a Tutoria instance (development or staging). It is the
runbook used by ops to confirm the payment lifecycle behaves correctly before
promoting a release to production.

> **Do not run this against production VNPay.** All instructions below assume
> `VNPAY_ENVIRONMENT=sandbox` and the VNPay sandbox dashboard / test card.

---

## 1. Sandbox credentials

Obtain sandbox credentials from the VNPay merchant dashboard (sandbox
environment):

| Field | Source |
| --- | --- |
| `TmnCode` (terminal / merchant code) | VNPay sandbox → "Thông tin tích hợp" |
| `HashSecret` (checksum secret) | VNPay sandbox → "Thông tin tích hợp" |

Treat both values as secrets. Never commit them to the repository; supply
them via the deployment supervisor's secret store. The `TUTORIA_ENVIRONMENT`
must be `development` or `staging` for this runbook — production runs use
`VNPAY_ENVIRONMENT=production` and are out of scope here.

The sandbox payment page is reachable at
`https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`. The sandbox merchant API
endpoint is `https://sandbox.vnpayment.vn/merchant_webapi/api/transaction`.

---

## 2. Backend environment

The backend API reads VNPay config via `backend/src/config/env.ts`. The
required variables for a complete configuration are:

```text
# Required
VNPAY_TMN_CODE=<TmnCode from VNPay sandbox dashboard>
VNPAY_HASH_SECRET=<HashSecret from VNPay sandbox dashboard>
VNPAY_RETURN_URL=https://<frontend-host>/payments/return
VNPAY_IPN_URL=https://<api-host>/api/v1/payments/vnpay/ipn

# Sensible defaults (override only if your sandbox/production URLs differ)
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_ENVIRONMENT=sandbox
VNPAY_REQUEST_TIMEOUT_MS=15000

# Required for the reconciliation/refund internal endpoints (optional in
# development but recommended in staging)
PAYMENT_RECONCILIATION_TOKEN=<long random string>

# Service-role key is required for the financial recovery worker + IPN finalize
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

If any of `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` / `VNPAY_RETURN_URL` /
`VNPAY_IPN_URL` is missing, the payment routes and the financial recovery
worker **do not start**. The backend logs a config-validation error and exits
closed. This is intentional: half-configured payment integration is more
dangerous than no integration.

Verify the server is fully configured by hitting the public health endpoint:

```sh
curl -sS https://<api-host>/api/v1/health
```

The response includes a `vnpay` block summarising the active configuration
and `environment: "sandbox"`.

---

## 3. Manual end-to-end flow

The flow below exercises every state in the booking → payment → confirmation
lifecycle:

1. Create a tutor (or use a test fixture)
2. Create a learner
3. Create a session
4. Create a booking with a snapshotted price
5. Start the payment attempt
6. Open the `vnp_Url` in a browser, complete the sandbox flow with the
   VNPay test card
7. Verify the IPN is received and the booking moves to `confirmed`
8. Verify the read endpoint reports `succeeded`

### 3.1 Create a tutor

Use the existing `become-a-tutor` flow or a backend test fixture. The
`backend/test-integration/tutor-cv-full-fields-media.test.ts` file shows the
end-to-end helper used by CI; the same helper is reused below.

### 3.2 Create a learner

Sign up a separate account with the role `student`.

### 3.3 Create a session

The session must be approved for payment (`approve_booking_for_payment`) —
this happens automatically for INSTANT bookings and must be triggered by the
tutor for REQUEST bookings.

### 3.4 Create a booking

Use the booking API (see `backend/src/routes/booking.ts`). The booking row
must have a snapshotted price; otherwise `POST /api/v1/payments/start` will
return `409 BOOKING_PRICE_MISSING`.

### 3.5 Start the payment attempt

```sh
curl -sS -X POST https://<api-host>/api/v1/payments/start \
  -H "Authorization: Bearer <learner-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
        "bookingId": "<booking-uuid>",
        "idempotencyKey": "e2e-test-<uuid>"
      }'
```

A successful response returns:

```json
{
  "ok": true,
  "payment": {
    "paymentId": "<uuid>",
    "attemptId": "<uuid>",
    "merchantReference": "<Tutoria-side reference, format <date>_<seq>>",
    "amountVnd": 300000,
    "status": "pending",
    "redirectUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=...&vnp_SecureHash=..."
  }
}
```

Copy the `redirectUrl` value — this is the `vnp_Url`.

### 3.6 Complete the payment in the browser

Open `redirectUrl` in a browser. The VNPay sandbox page accepts the standard
VNPay test card (`9704 0000 0000 0018` with any future expiry and any name).
Use one of the following amounts to exercise distinct outcomes:

| Amount (VND) | Outcome |
| --- | --- |
| exact amount from step 3.5 | `succeeded` (ResponseCode=00, TransactionStatus=00) |
| add `00` to the amount | amount mismatch → response code `04` (amount invalid) |
| leave the amount unchanged and click "Cancel" | response code `24` (user cancelled) |

For a successful flow, complete the OTP step the sandbox displays and
continue.

### 3.7 Verify the IPN is received

The browser redirect lands on `VNPAY_RETURN_URL`. The sandbox also posts an
IPN to `VNPAY_IPN_URL`. The backend accepts the IPN on
`GET /api/v1/payments/vnpay/ipn`, verifies the signature, normalises the
outcome, and calls the `record_vnpay_observation` RPC.

Verify the IPN was accepted:

- The backend logs `payment_ipn_received` and `payment_observation_recorded`
  with `merchantReference` matching the value from step 3.5
- The IPN endpoint responds with `RspCode: "00"`, `Message: "Confirm Success"`

### 3.8 Verify the booking is confirmed

```sh
curl -sS https://<api-host>/api/v1/payments/<booking-uuid> \
  -H "Authorization: Bearer <learner-jwt>"
```

The response shows `status: "succeeded"`. The financial recovery worker
also enqueues a finalization event that calls `finalize_paid_booking`. Until
that worker runs the booking row may still be in `awaiting_provider`; allow
up to `FINANCIAL_WORKER_INTERVAL_MS` (default 60s) for the transition to
`confirmed`.

To prove the worker is doing its job, run it locally:

```sh
cd backend
pnpm worker:start
```

A successful run prints `financial_worker_started`, then a periodic
`financial_worker_sweep_completed` line that includes
`finalized: { claimed: 1, finalized: 1 }` after the IPN arrives.

---

## 4. Failure-mode checks

Each failure mode below MUST pass before a release is promoted. They are
run as automated checks in `backend/test/payment-provider.test.ts` and
`backend/test/payment-lifecycle.test.ts`; this section documents the manual
equivalent.

### 4.1 Bad signature → 400

Send an IPN with a tampered signature:

```sh
curl -sS "https://<api-host>/api/v1/payments/vnpay/ipn?vnp_TmnCode=$VNPAY_TMN_CODE&vnp_Amount=30000000&vnp_SecureHash=deadbeef"
```

Expected response:

```json
{ "RspCode": "97", "Message": "Invalid signature" }
```

The `verifyVnpayFields` helper uses `crypto.timingSafeEqual` against the
expected HMAC-SHA512 digest. Any single byte difference must produce `97`.

### 4.2 Duplicate IPN → idempotent

Replay the same successful IPN twice in quick succession. Both calls must
return `RspCode: "00"`. The database state must not change on the second
call. The `record_vnpay_observation` RPC is idempotent on
`p_provider_event_key`, so duplicates collapse into a single observation.

To prove idempotency:

1. Note the `payment_attempts.merchant_reference` from step 3.5
2. POST the same `vnp_*` query twice
3. `payment_provider_operations` should contain exactly one row for the IPN
   with `status: "succeeded"`. A second row only appears if the operation
   key differs (which would be a bug).

### 4.3 Timeout → retry up to N times

Drive the timeout path by lowering `VNPAY_REQUEST_TIMEOUT_MS` to 1ms in a
staging instance. The provider call aborts, the IPN is treated as
`ambiguous`, and the financial recovery worker eventually sweeps the row:

- The provider request throws `VNPay transaction timed out after 1ms`
- `payment_provider_operations.status` becomes `ambiguous` and
  `response_payload` is `{ "error": "transport_unknown" }`
- The financial recovery worker calls `claim_pending_payment_finalizations`
  on the next sweep. The `fail_event` RPC applies a backoff (`60s` for the
  first 5 attempts, `86400s` after that). Up to **5 attempts** are made
  before the backoff jumps to 24 hours, at which point operator
  intervention is required.

To observe the retries, query
`payment_provider_operations.response_payload` and the
`outbox_events.attempt_count` column after the worker has run.

### 4.4 Out-of-order / stale events

The `eventKey` is derived as `return:<txnRef>:<transactionNo|responseCode>`.
Replay a *different* transaction number for the same merchant reference
after success: this is treated as a new observation and never silently
overwrites the original `succeeded` state. The RPC re-applies state via
`record_vnpay_observation` with idempotency keys per `(merchant_reference,
event_key)` pair.

---

## 5. Sandbox ↔ production switch

The same code paths serve both environments. To promote from sandbox to
production:

1. Update the operator-supplied secrets:
   ```text
   VNPAY_TMN_CODE=<production TmnCode>
   VNPAY_HASH_SECRET=<production HashSecret>
   VNPAY_PAYMENT_URL=https://pay.vnpayment.vn/paymentv2/vpcpay.html
   VNPAY_API_URL=https://pay.vnpayment.vn/merchant_webapi/api/transaction
   VNPAY_ENVIRONMENT=production
   ```
2. Confirm `TUTORIA_ENVIRONMENT=production` in the supervisor config. The
   `financial-worker-config` will refuse to start a production worker that
   still has `VNPAY_ENVIRONMENT=sandbox`.
3. Redeploy the API + worker. There is no DB migration required.
5. Run a **single** low-value real transaction and verify the full lifecycle
   (3.5–3.8) before declaring production ready.

The switch is intentionally a manual operator action. There is no runtime
toggle.

---

## 6. Rollback / void a transaction

There is no equivalent to a provider-side "void" once a sandbox or
production IPN has been observed. Tutoria's refund model is the only
supported rollback path.

For a payment that must be undone after the fact:

1. Identify the `payment_id` and `payment_attempt` from the read endpoint
2. Create a refund via the cancellation/refund flow
   (`backend/src/routes/booking.ts` → `request_cancellation`) — the system
   records a `refunds` row with `status: "pending"`
3. The financial recovery worker calls `claim_pending_refund_executions`
   and invokes `executeRefund`, which calls the VNPay `refund` command
4. The refund result is recorded by `record_vnpay_refund_result`
5. A subsequent `claim_pending_refund_reconciliations` sweep confirms the
   refund against VNPay using the `queryrefund` command

For a transaction that must be **blocked before** a real provider call (e.g.
during the redirect, but before the user has clicked "Pay"):

1. Mark the booking as cancelled with reason `payment_window_closed`
2. The next `expire_stale_bookings` sweep terminates the booking row
3. The IPN, if it arrives later, is reconciled via
   `POST /api/v1/internal/payments/reconcile` with the reconciliation
   token. The reconcile endpoint queries the provider and either finalizes
   or rejects the attempt.

In all cases the audit trail in `admin_audit_log` records who triggered
the action and why. No raw DB edits are supported.

---

## 7. Observability hooks for verification

- `financial_worker_started` / `financial_worker_sweep_completed` — worker
  liveness, on stderr/stdout depending on supervisor config
- `payment_ipn_received` — every IPN received, with the normalised
  outcome (never the raw signature)
- `payment_observation_recorded` — the RPC outcome
- `payment_finalization_failed` — finalization failures (expected during
  the ambiguous path)
- `refund_execution_exception` — refund transport errors
- `payment_provider_operation_succeeded` / `payment_provider_operation_failed`
  — `payment_provider_operations` table writes

`scripts/team-observability.py` and the per-run summary in
`.codex/TEAM_PERFORMANCE.md` include the relevant counters for verification.

---

## 8. CI / nightly verification

A full lifecycle run is too expensive for every PR. The relevant slices
run in CI:

- `backend/test/payment-provider.test.ts` — adapter-level signature,
  timeout, and normalisation checks
- `backend/test/payment-lifecycle.test.ts` — booking → start → observe →
  finalize state machine
- `backend/test/payment-service-shutdown.test.ts` — graceful worker
  shutdown

A nightly job against the live sandbox is recommended. Use the runbook
above as the script; verify the IPN arrives within 60 seconds and the
booking transitions to `confirmed` within 5 minutes. Failures should page
the on-call owner via the existing payment-worker alert in
`docs/financial-worker-runbook.md`.
