# On-Call — Tutoria v1 (Solo Founder)

## Schedule
- Primary: you, 24/7
- Backup: none in v1 (escalate to manual fix if no ack in 30 min)

## Channels
- Phone page via Twilio (or PagerDuty free tier) when `readyz` fails
- Slack/email for SEV-2 and SEV-3
- GitHub Issues for SEV-3

## Severity
- **SEV-1** (page now, response in 15min):
  - /api/v1/readyz returns 503 for 5+ minutes
  - Critical route (POST /bookings, /payments/*) error rate > 5% for 5+ minutes
  - Worker (financial-recovery) hasn't run in 30+ minutes
  - Data integrity check fails
- **SEV-2** (email + Slack, response in 2h):
  - Important route error rate > 2% for 30+ minutes
  - readyz degraded (one of DB / storage / worker check failing)
  - SLO burn rate exceeds 2x budget
- **SEV-3** (daily summary, response in 24h):
  - Standard route elevated error rate
  - Minor performance regression

## Runbooks
- `docs/financial-worker-runbook.md` — financial-recovery worker
- `docs/observability.md` — log/heartbeat/health endpoint inspection
- `docs/vnpay-e2e-verification.md` — VNPay manual flow

## Quick checks
1. `curl https://tutoria.com/api/v1/readyz` — should return 200
2. `curl https://tutoria.com/api/v1/health` — basic health
3. Supabase dashboard: `select * from worker_heartbeats order by last_run_at desc limit 5;`
4. Log search: filter by `requestId=<from-page>` or `workerId=financial-recovery`

## Escalation
- If no response within 30 min on SEV-1: try backup channels (SMS, personal email)
- If still no response within 1h: post a public status page update (https://status.tutoria.com if configured; otherwise email blast)
