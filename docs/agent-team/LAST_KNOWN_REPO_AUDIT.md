# Last Known Tutoria Repository Audit

Snapshot date: **2026-08-08**. This file is merge context, not a claim about the live checkout on installation day.

## Repository shape observed

The most complete prior audit covered three surfaces:

1. Root legacy TutorMatch SPA — valuable demo/state-machine prototype; not a production source of truth.
2. `backend/` — Node 22 / Fastify production-oriented API with Supabase-backed auth/data foundations.
3. `discover/` — Next.js product shell/prototype and the recommended production-web direction in that audit.

## Verified strengths in that audit

- Production-oriented authentication/session flows existed.
- Backend role/ownership enforcement and public/private tutor-field isolation existed for the implemented scope.
- Tutor CV draft/publish/public discovery foundations existed.
- Backend type-check, unit tests, and production TypeScript build passed in that audit.
- Discover unit tests passed in that audit.

## Known unresolved boundaries in that audit

- Root `/api/state`, `data/state.json`, seeded demo users, simulated payment, and browser/localStorage business state were demo-only.
- Some Discover write paths still used JSON files and were not production persistence.
- Booking, payments, direct messaging, reviews, verification, broad public UGC/community features, and several creator surfaces were prototype/deferred unless current code now proves otherwise.
- CI/release governance, staging E2E, RLS integration execution, privacy operations, production observability, and several launch gates still needed work.
- Discover lint had real source issues plus generated-output noise; the full production build was unverified due an environment/concurrent-install failure during the prior audit.

## Merge rule

Before changing application code, re-audit the live checkout. Never downgrade a newer implementation to match this snapshot. If the repo has advanced, update `TUTORIA_PRODUCT_BRAIN.md` and agent instructions to the newer truth.
