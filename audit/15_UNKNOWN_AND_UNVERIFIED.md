# 15 — Unknown & Unverified

Everything that could not be confidently established (distinct from missing).

## Production / deployment
- **Actual production URL** of the real Tutoria product: UNKNOWN. The only live
  Vercel domain checked serves an unrelated default app; no Render hostname
  confirmed; docs say "No Render service deployed".
- **Whether the configured hosted Supabase project** (`sufjrstewzvzjzvzekry`)
  has the repo migrations applied, is used, and holds real data: currently
  UNKNOWN (host reachable, 401 unauth; no authenticated inspection performed).
- **VNPay production credentials, merchant allowlist, HTTPS callback origin**:
  UNKNOWN.
- **Production email/notification/SMS providers**: UNKNOWN (none configured in repo).

## Payments
- Whether a **live VNPay transaction / refund / payout** has ever succeeded:
  UNKNOWN (sandbox e2e not run this session; no production evidence).
- Provider webhook behavior under real traffic: UNKNOWN.

## Integration / DB
- Whether the **integration suite** passes once the local DB is resynced:
  UNKNOWN (blocked by DB drift; I did not mutate schema per audit rules).
- `session_hard_reserved` exact per-participant vs 1:1 summation for workshop
  capacity: UNKNOWN (depended on function body; logic inferred).
- Which specific integration failures are "real bugs" vs "schema-drift-only":
  UNKNOWN (cannot separate without a clean DB).

## Historical / docs truthfulness
- Who/why `20260819130000_discovery_integrity_fix.sql` was recorded as applied
  but is absent from the repo: UNKNOWN. Its prior hosted-apply claims are
  unverifiable from the repo.
- Whether `app.legacy-ui.js`, `concepts/*`, `dist/test-hero-animation.gif`,
  `discover/public/*exact.html`, and the v3–v15 routes are still used by any
  deployment: UNKNOWN (no loader found; INFERRED unused).

## Feature state unknown
- Reveal of whether `/center` host-management and `/become-a-tutor` flow
  actually complete end-to-end against the backend (unverified by browser QA this
  session): UNKNOWN.
- Whether any offline/public demo of the discover app is hosted and its data
  source: UNKNOWN.

## Distinguished unknowns
- Payments = "implementation present, **runtime unverified**" (not "broken").
- Integration = "blocked by DB drift" (not "application broken").
- Production = "not confirmed deployed" (not "deployed and working").
