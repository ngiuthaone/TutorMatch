# Soft Launch Runbook — Workshop / Event Publication Surface

Audience: on-call engineer at 02:00. Keep this file actionable. If something here is wrong or stale, fix it in the same PR that changed the behavior.

---

## 1. Overview

### What is being launched
The **event/workshop publication** surface on the live `discover` site, backed by the production `backend/` Fastify + Supabase service.

In scope:
- Creator publish flow at `/events/new` (iframe-based creator form, hosted in a `pizza-workshop.html`-style asset) → `POST /api/v1/events` → `create_tutoria_event` RPC → durable row in `public.offerings` (`kind='event'`).
- Public browse listing at `GET /api/v1/events` (no auth) feeding the live `/events` feed (via discover's `/api/events` GET merge).
- Public event detail page at `/events/[slug]` (served by `WorkshopDataFrame` loading `pizza-workshop.html`).
- Verified-user gate (`assert_verified_booking_caller()`): authenticated **and** email-confirmed.

Out of scope for this soft launch (do NOT consider these "in production" — they are explicitly deferred):
- Bookings, sessions (booking-grade), attendance, reschedule.
- Payments / refunds / VNPay wiring on the event surface.
- Capacity acquisition / locking.
- Hard-delete event API.
- Supabase Storage for images (base64-in-config remains).
- Full moderation tooling, Playwright E2E, security reviewer sign-off.

### Gate
**Any verified user** (authenticated + email-confirmed via `assert_verified_booking_caller()`) can publish. There is:
- **No** tutor-only restriction.
- **No** admin approval step.
- **No** invite list / allowlist.

Anyone who signs up and confirms their email can publish immediately. See Section 3 for how to tighten this if invited-host-only becomes the policy.

### What "soft launch" means here
The gate is open, traffic is invited hosts, no public marketing push. We want signal from real publishes before turning on public discoverability. The rollback paths in Section 5 must be exercisable without a code deploy.

---

## 2. Environment variables

Production deploy config that affects this surface. Anything missing or wrong here breaks the surface silently.

### 2.1 `discover` (Next.js) deploy env

| Var | Expected prod value | What happens if missing / wrong |
|---|---|---|
| `NEXT_PUBLIC_TUTORIA_API_BASE_URL` | `https://<backend-host>` (e.g. Render service URL) | If empty, the iframe creator loses `?apiBaseUrl` → iframe falls back to `/api/events` (see Section 5 Option B). Publish is impossible until restored. |
| `NEXT_PUBLIC_TUTORIA_DEMO_MODE` | `"false"` (string, exact) | If `"true"` or unset, `/api/events` runs locally and returns the demo set; `isLiveMode()` is false; Supabase client is not constructed. In production, the runtime config **throws** if `demoMode=true` (see `discover/src/lib/auth/config.ts:52`). |
| `NEXT_PUBLIC_TUTORIA_ENVIRONMENT` | `"production"` | Defaults to `NODE_ENV==="production" ? "production" : "development"`. Wrong value can flip HTTPS-validation behavior on the config loader. |
| `NEXT_PUBLIC_TUTORIA_AUTH_CALLBACK_URL` | `https://<prod-domain>/auth/callback` | If empty, the runtime falls back to `window.location.origin + /auth/callback` in the browser; misconfigured callback URL breaks the OAuth return path. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-project>.supabase.co` | In live mode this is required (`config.ts:115`); session creation fails otherwise. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key (NOT service role) | In live mode this is required; client Supabase is not constructed without it. **Never** set this to the service-role key. |
| `NEXT_PUBLIC_SITE_URL` | `https://<prod-domain>` (no trailing slash) | Used by `/events/[slug]` canonical, `sitemap.ts`, `robots.ts`. **If unset, falls back to `http://localhost:3000`**, which is wrong in prod and breaks SEO + canonical URLs. Read in `discover/src/app/sitemap.ts:10`, `robots.ts:4`, `events/[slug]/page.tsx:96`. |

### 2.2 `backend` (Fastify) deploy env

| Var | Expected prod value | What happens if missing / wrong |
|---|---|---|
| `NODE_ENV` | `"production"` | Triggers the HTTPS-only superRefine check (`backend/src/config/env.ts:57`); mixed-content origins fail validation. |
| `TUTORIA_ENVIRONMENT` | `"production"` | Surfaced in logs and used by feature decisions. |
| `HOST` | `0.0.0.0` (or platform default) | Local-only binding breaks deploy. |
| `PORT` | platform-assigned | Backend unreachable. |
| `FRONTEND_ORIGINS` | `https://<prod-domain>` (comma-separated, full origin incl. scheme) | Must be valid URLs; wildcard rejected. Non-development requires HTTPS. CORS fails closed. |
| `SUPABASE_URL` | `https://<prod-project>.supabase.co` | Backend refuses to start (`z.string().url()`). |
| `SUPABASE_PUBLISHABLE_KEY` | anon/publishable key | Backend refuses to start (`min(1)`). |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (server-only) | Required for `listPublicEvents`, `getPublicEventBySlug` (service-role query path) and for the `create_tutoria_event` RPC handoff. Without it, reads return 503 and publishes fail. **Never** expose to a browser build. |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | defaults OK | Global guardrail. |
| `EVENT_PUBLISH_RATE_LIMIT_MAX` | default `10` | Per-creator publish burst cap. Returning 429 here means a creator is hammering publish; not an outage. |
| `EVENT_READ_RATE_LIMIT_MAX` | default `120` | Per-IP browse / detail read cap. A burst returning 429 here may be scrapers, not an outage. |
| `BODY_LIMIT_BYTES` | global default `16384` | The route overrides with its own scoped `bodyLimit` for `POST /api/v1/events`; global cap is unrelated to event payload size. |
| `MAX_AUTHORIZATION_HEADER_LENGTH` | default `8192` | Bearer header guard. |
| `LOG_LEVEL` | `"info"` in prod | Structured Pino logs go to stdout. Lower to `"debug"` for incident triage (cost: more volume). |

### 2.3 Vars that must NOT be set for this surface
- Any VNPay var (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, …) is irrelevant here. If you accidentally set partial VNPay config, the env loader will refuse to start (`superRefine` rule at `backend/src/config/env.ts:62`).
- Any payment reconciliation / financial worker var — out of scope.

### 2.4 Sanity-check after deploy
Run these from the operator's terminal:
1. `curl -fsS https://<backend-host>/healthz` → 200.
2. `curl -fsS https://<backend-host>/api/v1/events` → 200 with `events: []` (or the published set), no 503.
3. `curl -i https://<discover-host>/api/events` (live mode) → **410 Gone** (this is correct — the local route is demo-only).
4. `curl -fsS https://<discover-host>/sitemap.xml` → contains the prod `NEXT_PUBLIC_SITE_URL`, not `localhost:3000`.

---

## 3. Feature flag / gating

### Current gate (in effect)
**Verified user.** The DB-side `assert_verified_booking_caller()` RPC gate requires:
- `auth.uid() IS NOT NULL`,
- an existing `profiles` row,
- `auth.users.email_confirmed_at IS NOT NULL`.

Failing the email check throws `EMAIL_VERIFICATION_REQUIRED`, which the route maps to **403 `EMAIL_VERIFICATION_REQUIRED`** with the user-facing message "Please confirm your email before publishing."

There is **no** additional application-layer gate on top of this. Any verified user can publish.

### Tightening options (if invited-hosts-only becomes the policy)

Pick ONE — they are mutually exclusive in implementation:

**Option (a) — Allowlist table (recommended for invited cohorts):**
- New table `public.event_publish_allowlist` keyed by `auth.users.id` (or `profiles.id`), populated out-of-band.
- Read inside the `POST /api/v1/events` route **before** invoking the service: `if !(await allowlistHas(authUserId)) throw 403 FORBIDDEN`.
- RLS: deny all to anon/authenticated; reads only via service-role.
- Roll-out: insert host IDs, redeploy, no migration of existing data.

**Option (b) — Role check:**
- Add a `role` (or `is_event_host`) column on `profiles` (or a `profile_roles` table).
- Backend route checks the column via service-role.
- Drawback: requires a Supabase migration + admin tooling to grant/revoke.

**Option (c) — Keep open (current default for soft launch):**
- Verified user only.
- Acceptable because the soft launch traffic is invited hosts who have already been verified.

### How to flip from (c) to (a) during the soft launch
1. Apply additive migration creating `event_publish_allowlist`.
2. Insert invited-host UUIDs via service-role SQL.
3. Add the allowlist check in `backend/src/routes/events.ts:167` between `preHandler: app.authenticate` and the schema parse.
4. Deploy. Existing events remain visible (this only gates new publishes).
5. To re-open: drop the check from the route, redeploy. No data cleanup needed.

---

## 4. What to monitor

The backend emits structured Pino events to stdout. Pipe stdout to your log aggregator (Datadog, Loki, etc.) and alert on the rules below.

### 4.1 Structured log events (authoritative)

| Event | When | Key fields |
|---|---|---|
| `events.list` | Public browse listing, requested + completed | request: `query`. completed: `count`, `latencyMs`. |
| `events.get` | Public single read, requested + found/not_found | `slug`, `status` (`found` / `not_found`), `latencyMs`. |
| `events.publish.attempt` | Every publish POST that passed preHandler + schema | `slug`, `userId` (auth UUID). |
| `events.publish.success` | Publish that reached the RPC and returned a row | `slug` (the **stored** slug, possibly suffix-collided), `status` (`published` / `draft`), `offeringId`, `version`, `userId`, `latencyMs`. |
| `events.publish.failure` | Publish that errored | `slug`, `code` (one of `AUTH_REQUIRED`, `EMAIL_VERIFICATION_REQUIRED`, `FORBIDDEN`, `INVALID_SLUG`, `INVALID_TITLE`, `EVENT_INVALID`, `SLUG_EXHAUSTED`, `INVALID_TRANSITION`, `SERVICE_UNAVAILABLE`), `message` (when available), `userId`. |

Source of truth: `backend/src/routes/events.ts:139–227`.

### 4.2 Things to alert on

- **Spike in `events.publish.failure` with `code=EMAIL_VERIFICATION_REQUIRED`**. Indicates users are bypassing the verify flow (e.g. a signup path that doesn't enforce confirm). Investigate the signup endpoint.
- **Spike in `events.publish.failure` with `code=EVENT_INVALID`**. Payload too large or shape-violation. Check that the global 3MB config cap and the per-image 500KB cap are still enforced; check the client form for a regression.
- **`events.publish.failure` with `code=SLUG_EXHAUSTED`**. An earlier deterministic suffix ran out. Should be extremely rare; if it happens, the slug-collision code needs review.
- **`SERVICE_UNAVAILABLE` events on `events.publish.failure`, `events.list`, or `events.get`**. Backend can't reach Supabase. Page backend on-call.
- **p95 `latencyMs` on `events.list` or `events.get` > 1500ms** over a 5-minute window. DB read latency regression.
- **`events.publish.success` rate drops to zero while `events.publish.attempt` is non-zero.** Publish path is broken; reads may still work but creators see errors. Page backend on-call.

### 4.3 Things to NOT alert on
- `code=NOT_FOUND` on `events.get` is normal (404s for missing slugs, scraper traffic).
- Low-rate `EMAIL_VERIFICATION_REQUIRED` is normal until the soft-launch cohort has all confirmed.
- `events.publish.failure` with `code=INVALID_SLUG` / `INVALID_TITLE` from a single user likely indicates form input; only alert if multi-user.

### 4.4 Identity-leak guardrail (run periodically)
Sample the last 100 `events.list` / `events.get` JSON responses from the wire and assert:
- No `creator_id` field.
- No UUID-shaped strings in the JSON.
- No `email` / `phone` / `creatorId` keys.
- Host identity appears only as display data (`hostName` / `hostRole` / `hostBio` from the verified user's profile).

`backend/src/services/event-publication-service.ts` is responsible for scrubbing; the route does not additionally scrub. If the assertion fails, treat as a P1 — the contract R5 / L3 are being violated.

---

## 5. Rollback procedure

Three options, in order of reversibility vs. data preservation. Pick the smallest one that solves the incident.

### Option A — Full rollback to demo mode (recoverable, loses live signal)

**What to do:**
1. In the `discover` deploy env, set `NEXT_PUBLIC_TUTORIA_DEMO_MODE=true`.
2. Redeploy `discover`. **Do NOT touch `NEXT_PUBLIC_TUTORIA_API_BASE_URL`** — leave it pointing at the live backend so flipping the flag back later is one-line.
3. **Critical caveat:** the iframe creator at `/events/new` reads `apiBaseUrl` from the runtime. With `NEXT_PUBLIC_TUTORIA_API_BASE_URL` still set and `demoMode=true`, the iframe creator **may** still POST to the live backend while the browse/list endpoints fall back to the local demo set. This is **inconsistent**. To make the rollback coherent you must EITHER:
   - also clear `NEXT_PUBLIC_TUTORIA_API_BASE_URL` (forces the iframe to fall back to `/api/events` which is live-mode-disabled → 410), OR
   - accept the inconsistency for the duration of the rollback and tell the on-call handbook that publishes may still succeed against the backend during a demo-mode rollback (publishes are durable; this is not data loss, but is unexpected behavior).

**User-facing behavior:**
- `/events` browse: shows demo/shared events only (no live published events visible).
- `/events/[slug]` detail: shows demo events only.
- `/events/new`: iframe creator without `apiBaseUrl` → POSTs to `/api/events` → 410. **Publish is impossible** until flag flipped back.
- New visitors cannot publish; existing live events remain in the DB (no data loss).

**When to use:** catastrophic frontend regression, or to give the on-call engineer room without exposing new publishes.

### Option B — Kill switch: iframe creator without API base (publish-only kill, least invasive)

**What to do:**
1. In the `discover` deploy env, **clear** `NEXT_PUBLIC_TUTORIA_API_BASE_URL` (set to empty string).
2. Redeploy `discover`.

**User-facing behavior:**
- Iframe creator at `/events/new` loads without `?apiBaseUrl` → falls back to `POST /api/events` → **410 Gone** (live mode, demo route disabled).
- `/events` browse: still calls `GET /api/v1/events` via the discover `/api/events` GET merge → live backend events **still appear** as long as backend is up.
- `/events/[slug]` detail: still resolves via `GET /api/v1/events/:slug` → live events **still render**.

**Net effect:** publishes are killed; reads continue. This is the cleanest "pause new content, keep existing content visible" lever.

**When to use:** abuse report, bad actor, or short-term pause to investigate a publish-path bug without taking the listing down.

### Option C — Data-preserving: feature flag on the backend (durable, surgical)

**What to do:**
1. Add a config flag (env var or feature-flag service) the `POST /api/v1/events` route reads on entry. If disabled, throw `503 SERVICE_UNAVAILABLE` ("Publishing is temporarily disabled.").
2. Roll out the flag default = disabled; flip to enabled only when ready.
3. Existing published events remain readable.

**User-facing behavior:**
- `/events/new` POST → 503 with a clear "publishing is disabled" body. The iframe surfaces this as a submit error.
- `/events` browse + detail unchanged.
- `GET /api/v1/events` and `GET /api/v1/events/:slug` still 200.

**When to use:** you need to disable new publishes for a multi-hour window (e.g. moderation tooling rollout) and Option B's iframe-side kill is too blunt.

**Caveat:** this requires a code change to the route to read the flag. If you don't have a flag infra, prefer Option B.

### Decision table
| Incident | Use |
|---|---|
| Live listing or detail page rendering broken | **A** (full rollback) |
| Need to stop new publishes temporarily | **B** (kill switch) or **C** (data-preserving) |
| Need to stop publishes for >1h without redeploy | **C** (only if flag infra exists) |
| Bad actor discovered | **B**, then investigate |
| Backend down | Wait for backend recovery; no env-var change helps |

---

## 6. Known limits (accepted for soft launch)

- **Images are base64 in `config jsonb`.** Per-image cap (in client form) ~500KB; full-config cap 3MB serialized (`backend/src/routes/events.ts:181`); body cap on `POST /api/v1/events` is 4MB. Realistic for a small event with a few images. Supabase Storage migration is post-launch.
- **No Playwright E2E suite.** Browser click-through of the creator form → browse is UNVERIFIED in the QA contract. We rely on backend integration tests + manual smoke.
- **No full moderation tooling.** Only server-derived host identity (from `profiles`) and the publish rate limit (`EVENT_PUBLISH_RATE_LIMIT_MAX`) protect against abuse. There is no report/remove/ban surface.
- **Local `/api/events` route is demo-only and returns 410 in live mode.** This is intentional — the live path is `POST /api/v1/events` → RPC. Any client that POSTs to `/api/events` in production gets a Gone.
- **No automated browser smoke in CI.** Manual smoke at launch only.
- **No content moderation on the visible detail page.** Workshop plan / description / image alt-text are stored as-is and rendered in the WorkshopDataFrame iframe. Treat all event content as user-generated.
- **Deterministic slug suffix on collision.** The server chooses the stored slug and returns it; clients must trust the returned slug (see S1–S3 in the QA contract). Do not assume client-supplied slug survives.
- **No replay of pre-launch shared demo events into the live DB.** The demo shared events remain visible only in demo mode.

---

## 7. Operator contact

This section is TBD. Fill in once the rotation is staffed.

| Situation | Page |
|---|---|
| Backend down, all events endpoints 5xx | TBD — backend on-call |
| Supabase unreachable | TBD — DB on-call |
| Suspected auth / RLS bypass (identity leak) | TBD — security on-call |
| Bad-actor publish surge / abuse report | TBD — trust & safety |
| Frontend discover app broken | TBD — frontend on-call |
| Log aggregator / pipeline down | TBD — platform on-call |

Escalation chain: backend → security → founder.

---

## 8. Post-launch checklist

### First 24 hours
- Verify at least one manual publish from the creator side (verified user, signed in, lands on `/events/<slug>`).
- Verify a second browser (unauthenticated) can read `/events/<slug>`.
- No spike in `events.publish.failure` with unexpected code.
- No P0/P1 from the event surface.
- Rollback runbook (this file) is on standby and the operator rotation has acknowledged it.

### First week
- At least 3 successful publishes from distinct creators.
- Verify the "same host" events sidebar on `/events/[slug]` is populated from the backend (not demo).
- Identity-leak guardrail run at least once (Section 4.4) returns clean.
- `events.publish.success` p95 latency under 1500ms.
- No published events with leaked identity keys (Section 4.4 passes).
- No `code=SERVICE_UNAVAILABLE` spikes.

### First month
- Decide whether to keep the verified-user gate or tighten to allowlist (Section 3).
- Decide whether to roll Supabase Storage for images (removes base64 cap).
- Decide whether to ship the moderation tooling (report/remove/ban).
- Decide whether to add Playwright E2E before opening the gate wider.
- Security reviewer sign-off collected before any public-launch move.
- Decide whether `EVENT_PUBLISH_RATE_LIMIT_MAX=10` is the right ceiling for the cohort size.

### Public-launch gating (must be true before removing the soft-launch posture)
- Full moderation tooling shipped and reviewed.
- Supabase Storage for images shipped.
- Playwright E2E suite green on the publish + browse + detail flow.
- Security reviewer sign-off.
- This runbook updated to reflect post-launch decisions.
