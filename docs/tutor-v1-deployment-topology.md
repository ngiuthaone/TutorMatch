# Tutor V1 deployment topology contract

Status: topology contract only. No provider account, deployment, or production
environment has been selected by this repository.

## Repository evidence

- `vercel.json` is a legacy SPA configuration. It deliberately returns 404 for
  `/api/*`; it is not an API or worker deployment contract.
- Discover reads public browser configuration (`NEXT_PUBLIC_*`) and calls an
  API base URL. Its browser-safe Supabase credentials are distinct from the
  backend service-role authority.
- The backend is a Fastify Node service with `GET /api/v1/health`, exact
  `FRONTEND_ORIGINS` CORS, and Node `22.x` in `backend/package.json`.
- The financial worker is a separate built Node entrypoint:
  `pnpm build && pnpm worker:start` from `backend/`.
- The worker has no public HTTP endpoint. Its supervision signal is process
  liveness plus structured startup, iteration, attention, and shutdown logs.
- Supabase migrations are repository-owned and include the payment/refund
  recovery RPCs. The local reset path applies the complete chain serially.
- Provider return/IPN routes are API origins, not frontend origins. Their
  final public hostnames remain undecided.

The root README's Render/Vercel examples are legacy root-SPA documentation and
are not treated as an accepted production decision for this integrated backend.

## Required production topology

```text
public HTTPS frontend (Discover)
        │ browser-safe Supabase config + API base URL
        ▼
HTTPS API/backend ───────► Supabase production project
        │  ▲                         ▲
        │  │ provider return/IPN      │ service-role server paths only
        ▼  │                         │
VNPay HTTPS callbacks       financial worker
                             (separate supervised process)
```

The API and worker may share a host or container image, but must be separate
process responsibilities and independently restartable. The service-role key,
VNPay merchant secret, and reconciliation secret never belong in Discover or
any `NEXT_PUBLIC_*` variable.

## Existing hosting assessment

| Surface | Current evidence | Assessment |
|---|---|---|
| Discover frontend | Vercel-compatible legacy SPA config; Next/Discover has browser-safe environment contracts | SUPPORTED for static/public HTTPS hosting, subject to exact production env and auth callback setup |
| API/backend | Fastify Node process and built `pnpm start`; no accepted hosting config | UNCERTAIN until a long-running Node 22 platform is selected |
| Financial worker | Built entrypoint and runbook; no supervisor/service manifest | UNCERTAIN until a platform with restart, secrets, logs, and SIGTERM grace is selected |
| Supabase | Repository migrations and local CLI project config | SUPPORTED as the database/auth boundary; production project, backups, and operations remain release work |
| VNPay callbacks | API adapter and return/IPN configuration fields exist | UNCERTAIN until a public HTTPS API origin and provider allowlists are selected |

## Small decision matrix

| Option | Shape | Strengths | Operating burden / risk |
|---|---|---|---|
| A — managed container services | Frontend hosting remains separate; API service and worker service run from the built Node image on a managed long-running container platform; Supabase remains managed | Simplest supervision, secret store, logs, HTTPS, restart policy, and independent API/worker commands | Requires selecting a platform and configuring two services; exact cost/limits need founder review |
| B — single VM with service manager | Frontend remains separate; API and worker are distinct Node 22 services under systemd or an equivalent supervisor; Supabase remains managed | Predictable process semantics and low vendor coupling | Founder owns OS patching, TLS/proxy, backups/monitoring integration, and incident recovery |
| C — orchestrated containers | Frontend remains separate; API and worker are separate deployments/jobs in an existing container orchestrator; Supabase remains managed | Strong isolation and scaling controls | Highest setup and operational burden; unjustified for current repository evidence without a platform already in use |

## Recommended V1 topology

`RECOMMENDED_V1_DEPLOYMENT_TOPOLOGY`: keep Discover on its existing public
frontend host; run the Fastify API and financial worker as two separate
long-running services on one managed container platform; use the production
Supabase project for Auth/Postgres; configure VNPay return/IPN/query/refund
URLs to the API's public HTTPS origin.

This is a topology recommendation, not a vendor selection. It minimizes
architectural change while giving the worker independent restart and log
visibility. The API must pass its exact frontend origin to CORS. The worker
must receive only server-side secrets and must not be reachable from the
browser.

`DEPLOYMENT_DECISION_REQUIRED` remains YES until the founder accepts a
platform and its service/secret/alert configuration. No vendor-specific files
should be added before that decision.

## Environment contract

Values are placeholders only; production must use HTTPS and real secret-store
values. No production variable may contain `localhost`.

### Discover frontend

- `NEXT_PUBLIC_TUTORIA_ENVIRONMENT=production`
- `NEXT_PUBLIC_TUTORIA_API_BASE_URL=https://<api-host>`
- `NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<public-key>`
- `NEXT_PUBLIC_TUTORIA_AUTH_CALLBACK_URL=https://<frontend-host>/auth/callback`
- `NEXT_PUBLIC_TUTORIA_DEMO_MODE=false`

Only public Supabase URL/key and public API/origin values are allowed here.

### API/backend

- `NODE_ENV=production`, `HOST`, `PORT`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `FRONTEND_ORIGINS=https://<frontend-host>` (comma-separated exact origins)
- `VNPAY_ENVIRONMENT=production`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`
- `VNPAY_PAYMENT_URL`, `VNPAY_API_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`
- `PAYMENT_RECONCILIATION_TOKEN` where the existing internal API contract uses it
- bounded request/rate-limit settings and the accepted proxy setting

The API service-role key is server-only if an API path requires trusted
financial operations; otherwise it must not be configured merely for browser
requests. Provider secrets and reconciliation secrets are never returned in
API responses or logs.

### Financial worker

Use the required worker contract in
[`financial-worker-runbook.md`](financial-worker-runbook.md): service-role
key, complete production VNPay configuration, matching environment marker,
batch/lease/backoff settings, worker ID, and log level. The worker does not
receive frontend-origin or browser session secrets.

## URL and callback contract

Final domains are intentionally undecided. The accepted shape is:

- frontend origin: `https://<frontend-host>`
- API origin: `https://<api-host>`
- VNPay return: `https://<api-host>/<accepted-return-path>`
- VNPay IPN: `https://<api-host>/<accepted-ipn-path>`
- Auth confirmation: `https://<frontend-host>/auth/callback`
- Password reset: `https://<frontend-host>/auth/callback`

The exact frontend origin must be present in API CORS and Supabase Auth
allowlists. Provider callback endpoints must be public HTTPS API routes and
must not require a browser session. Wildcard CORS/redirect allowlists are not
part of this contract.

## Auth email and SMTP boundary

Supabase Auth confirmation and password-reset delivery require a configured
production SMTP/email provider and exact callback allowlists. SMTP/provider
validation is `NEXT RELEASE_QA / PRODUCTION_ENV_GATE`, not part of this worker
gate. Do not configure or claim production email delivery without an accepted
provider and safe test account.

## Migration and startup contract

Production release is operator-controlled and never uses `supabase db reset`.

1. Apply the reviewed migration chain to the target Supabase project using the
   approved migration mechanism.
2. Verify the final migration/version and required worker RPCs/grants from a
   trusted operator path; a failed migration blocks the release.
3. Start/redeploy the API and pass `/api/v1/health` plus auth/CORS smoke.
4. Start the worker only after the compatible schema is verified; confirm its
   started and successful-iteration logs.
5. Deploy/update the frontend with the matching public API/auth origins.
6. Run provider callback reachability smoke in staging/sandbox. Production
   VNPay E2E is a later gate.

Rollback means stop the new API/worker, restore the last compatible application
version, and use forward corrective migrations or the documented data recovery
procedure. Do not roll back a schema blindly after authoritative financial
rows/events exist.

## Health and alerting contract

- API: `/api/v1/health` proves the Fastify process is serving. Platform health
  should also observe restart rate and request errors.
- Worker: process alive, `financial_worker_started`, successful iteration, and
  absence of repeated attention events. It must remain alive during temporary
  provider/DB failure and preserve durable retry/reconciliation state.
- Supabase outage: API/worker failures are observable and must not invent
  payment/refund success. Recovery resumes after dependency restoration.
- Required platform alerts: API unavailable; worker crash/restart loop;
  failed/stuck refund; unresolved succeeded payment/finalization; repeated
  provider callback or reconciliation failure.

These alerts are platform configuration requirements, not active repository
alerts. Release owners must record notification destinations, thresholds,
on-call ownership, and a test timestamp before production.

## Production-like staging checklist

Before the separate VNPay release gate, staging must have:

- deployed frontend and API with real HTTPS origins;
- independently running worker with restart/log visibility;
- isolated Supabase project and final migrations;
- VNPay sandbox credentials only, with public return/IPN reachability;
- exact Supabase Auth confirmation/reset callback allowlists and validated
  email delivery;
- safe learner/Tutor test accounts and deterministic Session data;
- API, worker, database, provider-outage, restart/reclaim, and callback smoke
  evidence retained without secrets.

No VNPay sandbox transaction, deployment, or payout is performed by this gate.
