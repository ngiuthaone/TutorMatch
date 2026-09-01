# Tutoria runtime observability

This document covers the **production runtime** observability surface for the
Tutoria backend API and the background workers it depends on. It is the
companion to `docs/financial-worker-runbook.md` (worker incident playbooks) and
`docs/agent-team/OBSERVABILITY.md` (orchestration observability — distinct
topic).

## Log streams

| Surface              | Transport                                   | Where it ends up                                  |
|----------------------|---------------------------------------------|---------------------------------------------------|
| API (Fastify/pino)   | stdout JSON                                 | Render log drain → your log aggregator            |
| Financial worker     | stdout JSON                                 | Render log drain (separate service)               |
| Test runs (local)    | stdout                                      | `/tmp/test_output.log` (per repo convention)      |
| DB migrations        | stdout                                      | Render log drain (API service)                    |

All structured log lines are single-line JSON. The fields most useful for
operator investigations are listed below.

### API fields

Every request handled by Fastify carries:

- `requestId` — UUIDv4 generated per request, also returned in the response
  envelope as `requestId`. Match this value across pino lines, error
  responses, and downstream service calls.
- `reqId` — pino child binding identical to `requestId` in the request scope.
- `statusCode`, `code` — HTTP status and the Tutoria error code.
- `route`, `method`, `url` — request surface for grepping.
- `err` — non-secret error object on 5xx.

Search tip: `requestId=<uuid>` jumps between the gateway access log and the
application log.

### Worker fields

The financial recovery worker (`backend/src/workers/financial-recovery-worker.ts`)
emits:

- `event` — string event name; lifecycle events are `financial_worker_started`,
  `financial_worker_stopping`, `financial_worker_stopped`. Sweep events are
  `financial_worker_sweep_started`, `financial_worker_sweep_completed`,
  `financial_worker_sweep_failed`, `financial_worker_attention_required`.
- `workerId` — stable instance identifier from
  `FINANCIAL_WORKER_WORKER_ID`. Use it to correlate lines across restarts.
- `sweep` — name of the sweep phase (`refund-execute`, `refund-reconcile`,
  `payment-finalize`).
- `batchSize`, `leaseSeconds`, `releasedCount`, `errorCount` — per-sweep
  counters.
- `err` — non-secret error message on failure.
- `refundId`, `paymentId`, `bookingId` — when the sweep was acting on a
  specific row.

The worker is fail-closed and refuses to start without
`SUPABASE_SERVICE_ROLE_KEY` and complete VNPay configuration.

## Heartbeats

`worker_heartbeats` (added by `20260906000041_worker_heartbeats.sql`) holds the
most recent run for each worker process. Columns:

- `worker_id` — stable id, e.g. `financial-recovery-prod-1`.
- `last_run_at` — ISO timestamp of the most recent sweep iteration.
- `last_status` — `ok` | `degraded` | `attention_required` | `failed`.
- `last_error` — non-secret error message, or null.

These rows are written by the worker at the end of each iteration, and read by
the deep readiness probe (see below). A worker that has not written a row in
`staleThresholdSeconds` (default 120s, two intervals) is treated as
unhealthy.

```bash
# Inspect current heartbeats
docker exec supabase_db_backend psql -U postgres -d postgres -c \
  "select worker_id, last_run_at, last_status, last_error from public.worker_heartbeats;"
```

## Readiness probes

The API exposes two HTTP endpoints:

- `GET /api/v1/healthz` — liveness only (process is up). Cheap; safe for
  short-interval polling.
- `GET /api/v1/readyz` — deep readiness. Pings the database, storage, and
  reads `worker_heartbeats`. Returns 200 when everything is healthy; 503 with
  per-subsystem status when something is degraded.

```bash
# Local deep readiness
curl -s http://127.0.0.1:54321/api/v1/readyz | jq

# Production
curl -s https://tutoria.com/api/v1/readyz | jq
```

A typical healthy response shape:

```json
{
  "ok": true,
  "status": "ready",
  "checks": {
    "db": { "ok": true, "latencyMs": 4 },
    "storage": { "ok": true, "latencyMs": 7 },
    "workers": {
        "ok": true,
        "staleThresholdSeconds": 120,
        "stale": [],
        "items": [
          { "workerId": "financial-recovery-prod-1",
            "lastRunAt": "2026-09-01T08:02:31.000Z",
            "lastStatus": "ok", "lastError": null,
            "ageSeconds": 11 }
        ]
      }
  }
}
```

If `workers.stale` is non-empty, that worker is missing heartbeats and the
runbook (`docs/financial-worker-runbook.md`) applies.

## Common failure modes

These map directly to `event` values and runbook sections. Each failure
mode names the grep target so you can pivot from the runbook to the log.

| Symptom                                      | Grep target                                                                  |
|----------------------------------------------|------------------------------------------------------------------------------|
| Deep readyz returns 503 with `workers` stale | `financial_worker_sweep_failed` then the workerId in the runbook             |
| IPN stuck in `pending`                       | `event=financial_worker_sweep_started sweep=refund-reconcile`                |
| Refund RPC failing                           | `event=financial_worker_attention_required sweep=refund-execute`             |
| Sweep crashing the process                   | `financial_worker_stopping` followed by an absence of `financial_worker_started` for that `workerId` |
| Successful payment not finalized              | `event=financial_worker_sweep_completed sweep=payment-finalize releasedCount=0` |

For end-to-end incident response, see
`docs/financial-worker-runbook.md`. For deeper investigation workflow, grep
for `requestId` from a user report, then walk the API log → the worker log
via `bookingId`/`paymentId`.
