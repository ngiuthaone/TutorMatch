# Tutoria Load Testing (k6)

## Setup

1. Install k6:
   - macOS: `brew install k6`
   - Linux: see https://k6.io/docs/getting-started/installation/
   - Docker: `docker pull grafana/k6`

2. Get your test credentials. The scripts read from env:
   - `BASE_URL` — base URL of your API (e.g. `https://staging.tutoria.com`)
   - `SUPABASE_ANON_KEY` — Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (for setup)
   - `LEARNER_TOKEN` — a real auth token from a test learner account
   - `SESSION_ID` / `BOOKING_ID` — IDs of seeded test data

3. Get a list of tutor IDs for the profile test:
   ```bash
   psql ... -c "select id from public.tutor_profiles where publication_status='published' limit 100"
   ```

## Run a single test

```bash
cd /Users/soshi/Documents/tutormatch/load-test
BASE_URL=https://staging.tutoria.com \
  SUPABASE_ANON_KEY=<anon> \
  k6 run scripts/01-browse.js
```

## Run the full suite

```bash
cd /Users/soshi/Documents/tutormatch/load-test
for script in scripts/*.js; do
  echo "=== Running $script ==="
  BASE_URL=... SUPABASE_ANON_KEY=... k6 run --out json=results/$(basename $script .js).json $script
done
```

## Interpret the output

SLOs from `docs/slos.md`:
- Tier 1 (Critical: /bookings, /payments/*, /sessions): p95 < 800ms, error rate < 0.5%
- Tier 2 (Important: /tutors, /events, /sessions browse): p95 < 300ms, error rate < 1%
- Tier 3 (Standard): p95 < 500ms, error rate < 2%

The threshold assertions in each script enforce these automatically. If a run fails the thresholds, the exit code is non-zero and the test summary shows which threshold was breached.

## When to run

- Before each production deploy (smoke test scale: 10 VUs for 30s)
- Weekly against staging (full scale: 100-200 VUs for 2-3 min)
- After any major backend change (full scale)
