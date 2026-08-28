# Tutoria financial recovery worker

The financial recovery worker is a separate, long-running Node process. It runs one bounded pass of refund execution, refund reconciliation, and payment finalization recovery. It does not own financial policy or replace database/provider idempotency rules.

## Build and start

Run from `backend/`:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm worker:start
```

The supported production entrypoint is the built `dist/workers/financial-recovery-worker.js`. Do not run the `tsx` development script in production. Node 22.x is the repository runtime contract.

Required worker configuration is supplied through the supervisor's secret store/environment, never through browser code:

```text
NODE_ENV=production
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
VNPAY_ENVIRONMENT=production
VNPAY_TMN_CODE=<merchant-code>
VNPAY_HASH_SECRET=<merchant-secret>
VNPAY_PAYMENT_URL=<production-payment-url>
VNPAY_RETURN_URL=https://<frontend-host>/payments/return
VNPAY_IPN_URL=https://<api-host>/api/v1/payments/vnpay/ipn
VNPAY_API_URL=<production-merchant-api-url>
VNPAY_REQUEST_TIMEOUT_MS=15000
FINANCIAL_WORKER_INTERVAL_MS=60000
FINANCIAL_WORKER_BATCH_SIZE=50
FINANCIAL_WORKER_LEASE_SECONDS=300
FINANCIAL_WORKER_RELEASE_BACKOFF_SECONDS=60
FINANCIAL_WORKER_LOG_LEVEL=info
FINANCIAL_WORKER_WORKER_ID=<stable-instance-id>
```

The worker fails closed if service-role authority, complete VNPay configuration, or environment separation is missing. Production requires `NODE_ENV=production` and `VNPAY_ENVIRONMENT=production`; non-production workers must use the sandbox environment. Never log secret configuration values.

## Supervision contract

Render is the accepted deployment platform for this topology. The API and
worker are separate long-lived services with independent process lifecycles;
the worker uses a 60-second platform termination window and a shorter
15-second provider request timeout. A serverless request timeout is not a
worker lifecycle.

The worker has no public HTTP health endpoint. Readiness evidence is `financial_worker_started` followed by completed sweep events and a successful iteration. `financial_worker_stopping` and `financial_worker_stopped` prove graceful termination. Alert on repeated crashes/failure to become ready, `financial_worker_attention_required`, repeated `financial_worker_sweep_failed`, refund work stuck beyond an operator-selected operational threshold, and successful payment observations unresolved in the database beyond an operator-selected threshold.

Thresholds and notification ownership are operational release decisions, not booking/payment domain policy. A permanently failed refund is terminal in the existing financial model and must be investigated or reconciled by an operator, not retried forever.

## Recovery rehearsal and incidents

1. Start the built worker with deterministic local/staging configuration.
2. Send SIGTERM or SIGINT and confirm stopping/stopped promptly. Idle sleep is
   interruptible; an in-flight provider request is aborted and recorded as an
   ambiguous/recoverable outcome rather than a definitive failure.
3. Restart it and confirm DB leases allow eligible work to be reclaimed after lease expiry; two workers must not duplicate a provider operation.
4. In staging, make the provider or database unavailable and confirm failed iterations remain observable, the process remains alive, and persisted lease/backoff/idempotency behavior controls retry.

The provider request timeout must remain comfortably below Render's 60-second
termination budget. On shutdown, the worker aborts the active provider request,
claims no additional batch rows after shutdown begins, and leaves any uncertain
provider outcome for durable reconciliation after restart. The expected graceful
shutdown is one provider timeout plus database cleanup margin (approximately 20
seconds under the staging defaults), not the full platform budget.

For attention events, preserve worker ID, timestamp, sweep name, and the non-secret error message. Inspect persisted financial operation and provider status using existing operator controls. Do not clear claims or mark payment/refund state from the browser.

This runbook does not authorize a production VNPay transaction, payout, or deployment. Those remain separate release gates after a platform is selected.
