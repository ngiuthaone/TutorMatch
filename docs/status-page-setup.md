# Status Page Setup (Better Uptime)

## Why

Users need to know if the marketplace is down. A status page at `status.tutoria.com` is the canonical place.

## Provider: Better Uptime (free tier)

- URL: https://betteruptime.com
- Free tier includes 10 monitors, 3 status pages, 5-minute checks
- Alternative: https://statuspage.io (free tier: 1 status page, 50 components)

## Setup steps

1. Create a Better Uptime account (or Statuspage.io account).
2. Add HTTP monitors for each critical URL:
   - `https://tutoria.com/api/v1/readyz` (every 1 minute, "Critical")
   - `https://tutoria.com/api/v1/health` (every 1 minute, "Standard")
   - `https://tutoria.com/` (every 5 minutes, "Marketing site")
3. Set up the public status page at `status.tutoria.com` (CNAME to Better Uptime's endpoint).
4. Add component groups:
   - **API** — readyz, /api/v1/health
   - **Discovery** — /tutors, /tutor/:id
   - **Booking** — /bookings, /sessions
   - **Payments** — /payments/start, /payments/vnpay/ipn
   - **Notifications** — async worker
   - **Marketing site** — https://tutoria.com
5. Set up the alert channel: Solo founder gets an SMS via Twilio (or email if Twilio isn't set up).
6. Set up escalation: After 15 min no ack, page a backup contact (or just send a 2nd SMS).

## DNS for status.tutoria.com

CNAME `status` → Better Uptime's `statuspage.betteruptime.com` (or `yourcompany.statuspage.io`).

## Slack/email integration

In Better Uptime → Settings → Integrations, add:
- Slack webhook (post to a private #ops channel)
- Email (default)
- PagerDuty (optional, when team grows)

## Runbook

When the readyz monitor fires:
1. Read `docs/on-call.md` for severity classification
2. Check `request_logs` for the failing 5xx
3. Run `cat /var/log/tutoria/*.log | tail -1000` (or whatever the log path is)
4. Check `select * from worker_heartbeats order by last_run_at desc limit 5`
5. Follow `docs/financial-worker-runbook.md` if worker is the issue
6. Post an incident update to the status page
7. Once the monitor is green for 5 min, mark the incident resolved

## Postmortem

After any SEV-1 or SEV-2, write a postmortem in `docs/postmortems/YYYY-MM-DD-incident.md` with:
- Timeline
- Root cause
- Impact (users affected, revenue lost, SLO budget burned)
- Action items
