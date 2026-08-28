# 14 — Legacy & Technical Debt

Snapshot of dead/duplicate/deprecated/suspicious material. Nothing deleted.

## Confirmed dead / superseded

- **`app.legacy-ui.js` (+ `styles.legacy-ui.css`, `styles.legacy.css`)** — v2
  predecessor; no loader reference from current `index.html`. (INFERRED unused)
- **`backend/schema.sql`** — legacy case/request schema, superseded by migration
  tree; not load-referenced. (VERIFIED superseded)
- **`data/state.json`** — root SPA demo state (plaintext demo passwords). Demo,
  not production.
- **`dist/test-hero-animation.gif`** — stray animated artifact, not a build output.
- **`concepts/*`** — early design concept prototypes.
- **Discover iteration routes `v3`–`v15`, `/u/[name]`, `/user/[name]`** — likely
  unlinked demo/iteration artifacts (route files re-export shared profiles).
- **`/skills`, `/year-review`** — orphaned demo pages (not in nav).
- **Orphaned discover components** (no route import): `CoursesPage`,
  `CoursesSection`, `EventsPage`, `HappeningNearYou`, `RecommendedFeed`,
  `PersonalizedRecs`, `PeoplePage`, `ProfileReplacement`, `pizza-workshop-frame`,
  `published-event-page`, `workshop-booking-bridge`, `event-detail-page`, etc.

## Duplicate / ambiguous

- **Two `create_booking` overloads** live in DB (drift artifact).
- **`.bak` migration** `20260820100001_workshop_booking_v1_rpcs.sql.bak`
  (untracked) next to the live `.sql` — stale draft, not applied. Risk of drift.
- **`20260820000000` and `20260820100000`** both extend `cancelled_by`/actor to
  `'system'` — redundant overlap.
- **`backend/schema.sql` `user_role` enum** duplicated by migration 0001 (harmless,
  idempotent).

## Not-production (demo/localStorage, to be aware of)

- Root SPA simulated payment (no provider).
- `server.js` `/api/state` unauthenticated file persistence (explicit demo).
- Discover discussions/articles/communities/notifications → localStorage
  (`tutoria_*`), even in "live" mode for notifications.
- `discover/src/lib/course-data.ts`, `event-data.ts`, `for-you-data.ts`,
  `tutor-profile-data.ts` — hard-coded mock catalogs.
- Static iframe shells: `public/*exact.html`, `course-profile.html`,
  `browse-tutors.html`, `messages-exact.html`, `learning-exact.html`.

## Generated artifacts accidentally committed / in scope

- `discover/.vercel/output/**` build output present in working tree and included
  in lint scope (`react/no-this-alias` errors in compiled `.cjs`).
- `.vercel/*` gitignored (local-link evidence only).

## Duplicated business logic to watch

- Frontend booking state duplicated across `booking-api.ts`,
  `tutor-booking-api.ts`, `workshop-booking-api.ts`, `event-booking-api.ts`,
  `tutor-workshop-booking-api.ts` (forwarding aliases per
  DISCOVERY_INTEGRITY_FIX_REPORT FE-005 "tutor-booking-api.ts not generalized —
  backward-compat alias"). Some duplication is aliasing; worth consolidating.
- `app.js` module persistence (localStorage + `/api/state`) vs real backend
  (not wired) — demo/market duplication by design.

## No-CI debt

- No `.github/workflows` (a removed `oss-license-gate.yml` referenced historically).
  No automated CI currently enforces the OSS gate, lint, or tests in this repo.
