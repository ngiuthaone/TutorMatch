# Service Level Objectives — Tutoria v1

## Tier definitions

| Tier | Examples | Availability | p95 latency | Error rate |
|---|---|---|---|---|
| Critical (revenue) | POST /bookings, POST /payments/start, /payments/vnpay/ipn | 99.9% | <800ms | <0.5% |
| Important (read) | GET /sessions, /tutors, /events, /bookings/:id | 99.5% | <300ms | <1% |
| Standard | All other routes | 99.0% | <500ms | <2% |
| Async (webhooks) | /internal/* | 99.0% | <2000ms | <1% |

## Error budget
- 99.9% = 8h46m downtime/year, ~43m/month
- 99.5% = 43h48m/year, ~3h39m/month
- 99.0% = 87h36m/year, ~7h18m/month

## Measurement
- Per-request latency: captured by Fastify onRequest hook (x-request-id header, requestId log field)
- Per-route aggregation: query `request_logs` (added in this PR) by `route, status_class, hour_bucket`
- Error rate: 5xx / total requests per route
- SLO breach detection: hourly cron reads `request_logs`, fires when rolling 30-day breach exceeds budget

## Alerting (W4.B below)
- SEV-1: critical route breach → page immediately
- SEV-2: important route breach → email + Slack within 15m
- SEV-3: standard route breach → daily summary

## Out of scope for v1
- Per-customer latency
- Geographic SLOs
- Synthetic monitoring (only real-user traffic in v1)
