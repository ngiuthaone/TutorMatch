# QA Acceptance Contract — Production Event/Workshop Publication (backend + discover)

- Run ID: `pub-events`
- Phase: EMBARGOED pre-implementation (contract only; no source modified)
- Contract owner: qa_browser / qa domain
- Authoritative inputs: locked decisions D1–D7 (from orchestrator), planned implementation contract (per surface), and repo evidence read during preflight.
- Locked defaults: criteria below are authoritative. They change only via the contract-change protocol (Section 9), never silently.
- Status vocabulary: PASS / PARTIAL / UNVERIFIED / BLOCKED. FAIL is not a Tutoria run status.
- `PRODUCT_DECISION_REQUIRED` items: surfaced in Section 11; none are re-decided here.

---

## 0. Scope and grounding

### 0.1 Feature under contract
A signed-in creator on the live discover site publishes an event/workshop via the `/events/new` creator form. The allowed publish POST must land in the `backend/` Fastify + Supabase app as a durable `offerings` row (`kind='event'`), NOT in the discover JSON file (`discover/data/published-events.json`). Public read happens via a backend `GET /api/v1/events/:slug`.

### 0.2 What QA actually read (evidence grounding)
- `discover/src/app/api/events/route.ts` — current JSON POST path, `eventPostSchema`, live-auth gate via `verifyRequestUser`, in-memory rate limiter (10/60s), `sanitizeTree`, slug conflict 403 rule.
- `discover/src/lib/published-event-store.ts` — JSON file read/write path (`data/published-events.json`).
- `discover/src/app/events/[slug]/page.tsx` — demo read path (`getEventBySlug` → `getSharedEventBySlug`), renderer `WorkshopDataFrame`/`toWorkshopData`.
- `discover/src/app/events/new/event-new-frame.tsx` + `page.tsx` — iframe mount, `tutoria-event-published` message contract, redirect to `/events/<slug>`.
- `discover/public/event-creator-reference.html` — `createPublishedEvent()` (lines ~1568–1657), submit handler (lines ~1659–1692), visibility radio values `Public`/`Unlisted`/`Community only`, POSTs to `/api/events`, reads host from `tutoria_signup` / `tutoria_tutor_profile_submission` localStorage, base64 image data URLs.
- `discover/src/lib/event-booking-api.ts` — existing authenticated backend request pattern (`getSessionAccessToken`, `Authorization: Bearer`, `credentials: "omit"`).
- `discover/src/lib/auth/session.ts` — `getSessionAccessToken()` returns token only when `status === "authenticated"`.
- `discover/src/lib/auth/config.ts` — `demoMode` behavior; production forces `demoMode=false`.
- `backend/src/routes/marketplace.ts` — route/auth/rate-limit/body-limit template (`app.authenticate`, `preHandler`, `config.rateLimit`, scoped `bodyLimit`, `noStore`).
- `backend/src/plugins/authenticate.ts` — Bearer validation via `authService.validateAccessToken`, `request.auth = { userId, email, accessToken }`, 401/503 semantics, auth-header count/length checks.
- `backend/test-integration/local-supabase-setup.ts` + `auth-helpers.ts` + one integration test — confirmed local-Supabase test tier with `signUpConfirmed` (admin `email_confirm: true`) as the only way to obtain a verified user.
- `backend/test/marketplace.test.ts` — Fastify unit tier with `FakeAuthService` (`app.inject`).
- Migrations (only as needed for criteria): `20260819120000_shared_booking_engine.sql`, `20260820100000_workshop_booking_v1_schema.sql`, `20260820100001_workshop_booking_v1_rpcs.sql`, `20260820130000_alpha_contract_cleanup.sql`, `20260815090000_booking_request_abuse_protection.sql`.
- `backend/src/services/marketplace-service.ts`, `backend/src/app.ts`, `backend/src/config/env.ts`.

### 0.3 Repository facts that govern the contract (grounded, not decisions)
- `offerings` schema (shared engine + workshop schema): cols `id, kind, slug, title, creator_id, description, unit_price_vnd, currency, config jsonb, publication_status ('draft'|'published'|'unpublished'), published_at, unpublished_at, version, created_at, updated_at, pricing_model, price_per_participant_vnd, hourly_rate_vnd, booking_mode`. `config jsonb` column EXISTS and is the only payload-capable column (pricing columns are booking-model columns, NOT the discover event profile).
- `offerings` has `unique(kind, slug)`, `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` CHECK, RLS ENABLED with `revoke all` (no direct table access for anon/authenticated; access only via RPCs that hold `security definer` or via service-role).
- Canonical RPCs (post `20260820130000`):
  - `create_offering(p_offering_type, p_title, p_pricing_model, p_price_per_participant_vnd default null, p_hourly_rate_vnd default null, p_booking_mode default 'approval', p_description default null)` — `security definer`, gated by `assert_verified_booking_caller()` (D1 gate). **Does NOT** accept a client slug, does NOT accept `config`, ALWAYS inserts `publication_status='draft'`, generates slug from `p_title` with a NON-deterministic random-8 suffix on conflict, and returns `{id, slug, publicationStatus:'draft', version:1}`.
  - `update_offering_status(p_offering_id, p_expected_version, p_status)` — `security definer`, gated by `assert_verified_booking_caller()` + `can_manage_offering(uid, id, 'host')`, version CAS (`STALE_VERSION`), maps 'published'/'draft'/'unpublished', sets `published_at`/`unpublished_at`, returns new version.
  - `get_offering(p_offering_id)` — **by UUID only**, published-only, returns event/offering fields but **NOT `config`** and NOT `creator_id` (auth UUID stripped per policy).
  - There is **NO read-by-slug RPC** (`get_offering_by_slug` does not exist). `GET /api/v1/events/:slug` therefore requires either a new additive read-by-slug RPC/migration, or a service-role query path at the service layer.
- `can_manage_offering` resolves via the `offering_hosts` table (owner/host capability rows) plus admin role. `create_offering` does NOT insert an `offering_hosts` row for a newly created offering (only the shared-engine backfill inserted rows for pre-existing tutor offerings). **Consequence:** a freshly created event offering created via `create_offering` will NOT satisfy `can_manage_offering(creator, …, 'host')` unless an owner `offering_hosts` row is inserted in the same transaction. This affects whether `update_offering_status(…, 'published')` succeeds. This is an implementation gap the route/service must close, and the contract below requires explicit evidence of ownership so publish CAS works.
- `assert_verified_booking_caller()` requires `auth.uid() != null`, an existing `profiles` row, and non-null `auth.users.email_confirmed_at` (throws `EMAIL_VERIFICATION_REQUIRED` otherwise). This is the D1 gate.
- Global Fastify `bodyLimit` default is 16,384 bytes; the marketplace route overrides with a route-scoped `bodyLimit` (600 KB). The event payload contains base64 images up to ~350 KB each, so the events POST must set its own scoped `bodyLimit` large enough to accept a realistic full event (consistent with discover `eventPostSchema` image caps).
- Discover slug field allows `^[\w-]+$` (uppercase, underscore allowed) while the DB `offerings.slug` CHECK is `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase, no underscore, no leading/trailing dash) and `length <= 120`. The D4 "client slug is a request" contract must therefore guarantee the backend returns a slug that (a) is the actual stored one, (b) satisfies the DB CHECK, and (c) resolves under `/events/<slug>`. This may require the backend to normalize the client slug; the observable contract is the actual returned slug + resolvability, not byte-equality with the client request.
- Integration-test tier (`test-integration/`) requires local Supabase (`SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_DB_URL`, `SUPABASE_TEST_SERVICE_ROLE_KEY`) and refuses non-local hosts. Verified users are created only via `signUpConfirmed` (admin `email_confirm: true`).
- Live `discover` production requires `NEXT_PUBLIC_TUTORIA_DEMO_MODE=false`, real Supabase env, `apiBaseUrl`, auth callback.

---

## 1. Authorization (D1)

| # | Criterion | PASS condition |
|---|-----------|----------------|
| A1 | `POST /api/v1/events` without an `Authorization: Bearer` header returns **401** and does not persist any row. | Integration test: anonymous POST → 401; assert 0 `offerings` rows for the attempted slug; assert no discover JSON write (S2). |
| A2 | `POST` with an invalid/non-parseable Bearer token returns **401**; the access token is never echoed in the error body. | Integration + unit: inject garbage token → 401; `JSON.stringify(res.body)` does not contain the token string. |
| A3 | `POST` with a Bearer token for a **verified** (email-confirmed) user returns success (201/200) and the row's `creator_id` equals `auth.uid()`. | Integration test (`signUpConfirmed`): success; query `offerings` via service role; assert `creator_id = <user.id>`. |
| A4 | `POST` as an **unconfirmed** user (no `email_confirmed_at`) is rejected by the DB RPC gate (per D1, the gate is `assert_verified_booking_caller`). | Integration test: create a user without `email_confirm:true`; POST → rejected (mapped to an appropriate 4xx, e.g. 401/403); no row persisted. If the app maps `EMAIL_VERIFICATION_REQUIRED` to a 4xx with a clear code, assert that mapping. |
| A5 | **No cross-user mutation path:** a user cannot publish to or overwrite another user's slug via a `creatorId`/`creatorName` field in the body; ownership is derived from the token, and a client-supplied `creatorId` that differs from the caller is ignored (D5). | See H1/H4. Unit + integration: POST with body `creatorId` set to another user's id; assert stored `creator_id` is still the caller's. |
| A6 | The route uses the `app.authenticate` plugin path (or an equivalent that validates via `authService.validateAccessToken`) and only then reaches the handler. | Code inspection + unit with `FakeAuthService.authentication = { status: 'invalid' }` → 401, handler/service not invoked (e.g., service call counter remains 0). |

## 2. Durability / persistence (D2, D6-persistence)

| # | Criterion | PASS condition |
|---|-----------|----------------|
| P1 | A published event is a committed `offerings` row readable after the route call completes (not a transient/in-memory side effect). | Integration test: after a successful POST of a Public event, query `offerings` (service role) for `kind='event'`, matching slug; row exists with `publication_status='published'`, `version>=1`. Re-query after a separate round-trip to prove persistence. |
| P2 | The full discover event profile (the `eventPostSchema`-equivalent payload fields) is retained server-side for the public read. | Integration test: assert the stored `config` jsonb (or equivalent column identified by the implementer) contains the published event fields (title, subtitle, sessions, plan, galleryImage, hostBio, etc.). |
| P3 | **NO discover JSON-file write in the live path.** `discover/data/published-events.json` is NOT written when the live backend path is used. | Integration + code inspection: (a) assert the backend/save path does not import `published-event-store.saveSharedEvent`; (b) in a live-mode flow (or a test harness with a fresh `data/` dir), assert the JSON file remains absent/unchanged after a successful publish. (See D7 for the demo-mode exception.) |
| P4 | Duplicate identical publish attempts of the same (kind, slug) do not create two `offerings` rows (unique `(kind, slug)` holds). | Integration test: second POST with the same effective slug → either deterministic-suffixed new slug (A7/D4) or a conflict error; no duplicate PK/(kind,slug) row. Assert exactly the expected number of rows. |
| P5 | `version` CAS is respected on publish transition: publishing uses `update_offering_status(id, expected_version, 'published')`-style CAS; a stale expected version is rejected with no side effect. | Integration test: call the publish with a stale version → rejected; `status`/`version` unchanged. See also S/CAS notes in Section 3 criteria. |

## 3. Public read (`GET /api/v1/events/:slug`) (D2 visibility)

| # | Criterion | PASS condition |
|---|-----------|----------------|
| R1 | `GET /api/v1/events/:slug` for a **published** event returns 200 with the public event in the shape the discover `/events/[slug]` renderer consumes (EventDetail) and includes the actual stored slug. | Integration test: publish Public → `GET /events/<actual>` → 200, body contains title and `slug === actualSlug`. |
| R2 | `GET` for a **draft** or **unpublished** event returns **404** (published-only). | Integration test: create with visibility Unlisted/Community-only (stored draft) → GET returns 404. Also unpublished via `update_offering_status('unpublished')` → GET returns 404. |
| R3 | `GET` for an **unknown/nonexistent** slug returns **404**, not 500. | Integration test: random slug → 404. |
| R4 | **Owner cannot read own draft publicly:** even the owning creator, via the anonymous public GET, receives 404 for their own draft. | Integration test: creator publishes-as-draft (visibility != Public), then anonymous GET of that slug → 404 (i.e., "draft owned by caller NOT readable publicly"). |
| R5 | The public response **excludes auth UUIDs** (`creator_id`, `offering_hosts.user_id`, raw `auth.users.id`) and **excludes private contact data** (email-as-identifier-of-record, phone, exact private fields). | Integration test: `JSON.stringify(publicBody)` does not match `/creator_id|creatorId = <uuid>|email|phone|service_role/i` patterns and does not contain the caller's `auth.uid()` UUID. Host identity is present only as display data (D5). |
| R6 | Public GET is cache-safe for dynamic content or marked appropriately (`Cache-Control: no-store`), consistent with existing public routes. | Unit/integration: assert `Cache-Control: no-store` header on the public read (mirroring marketplace `noStore`). |

### 3.1 CAS / publish-transition coverage (augments P5, R2)
| # | Criterion | PASS condition |
|---|-----------|----------------|
| R7 | The publish transition and the ownership gate are proven to work for a **freshly created event** (i.e., the implementation provides an owner/host capability so `can_manage_offering` succeeds; otherwise publishing is impossible). | Integration test covering end-to-end: create event → publish (CAS) → verify row `publication_status='published'`. If the implementation closes the `offering_hosts` gap with an additive migration, assert the owner capability row is created scoped to that event and its owner. |

## 4. Visibility mapping (D2)

| # | Criterion | PASS condition |
|---|-----------|----------------|
| V1 | Visibility `Public` → the row is stored/published (status `published`) and is publicly readable. | Integration test: POST visibility=Public → row `publication_status='published'`; `GET` returns 200. |
| V2 | Visibility `Unlisted` → the row is stored as **draft** (NOT published) and is NOT publicly readable (404). | Integration test: POST visibility=Unlisted → row `publication_status='draft'`; `GET` → 404. |
| V3 | Visibility `Community only` → the row is stored as **draft** in this slice (backend `Community only` state is DEFERRED per D2); the user-facing consequence is "saved as a draft, not published." | Integration test: POST visibility=Community-only → row `publication_status='draft'`; `GET` → 404. API response/status indicates the save-as-draft outcome. |
| V4 | The API surface exposes the saved outcome clearly: at minimum, the POST response indicates `status` (published vs draft) so the framing contract in D2 ("creator told it is saved as a draft") can be honored. | Unit + inspection: response includes a `status` (or equivalent) field whose value is `published` for Public and `draft` for Unlisted/Community-only. |

## 5. Slug conflict (D4)

| # | Criterion | PASS condition |
|---|-----------|----------------|
| S1 | On a slug collision (existing `(kind, slug)`), the system **suffixes** the slug deterministically (not a raw error that abandons the publish) and the POST response returns the **ACTUAL** stored slug. | Integration test: publish slug X; publish another event whose effective slug would collide with X; assert the second succeeds with a returned slug ≠ X, the returned slug equals the stored `offerings.slug`, and the stored slug satisfies the DB CHECK `^[a-z0-9]+(-[a-z0-9]+)*$`. |
| S2 | `/events/<actual stored slug>` resolves to the event. | Integration test: after a colliding publish, `GET /api/v1/events/<returnedSlug>` (live path) → 200. (For the discover UI, the redirect uses the returned slug — see U-criteria.) |
| S3 | Client slug is a request, not authoritative: the backend decides the stored slug and returns it; the client must NOT re-derive/trust its own slug for the redirect. | Unit + integration: publish with client slug that conflicts; assert the response's `slug` is the server-chosen one and equals the stored value. If the client can supply a slug, the backend normalizes it to satisfy DB constraints (uppercase→lowercase, underscores dropped/converted, length cap) OR generates its own; either way the response returns the actual stored slug. |

## 6. Host identity (D5)

| # | Criterion | PASS condition |
|---|-----------|----------------|
| H1 | Client-supplied `creatorId` / host fields are **not** used for ownership or identity authority. | Integration test: POST with body `creatorId` set to a different user id → stored `creator_id` = caller; a public read never returns the client-supplied `creatorId`. |
| H2 | Host/profile identity shown on the public event is **derived from the verified user** (Supabase profiles/user metadata), not from client-supplied `hostName`/`hostRole` etc. alone. | Unit (FakeAuthService profile) + integration: assert the single source of host name/role/bio comes from the backend-derived profile path (e.g., `getOwnProfile`/`profiles`), and that a deliberately wrong client host field does not appear in the public read. |
| H3 | Public GET output is clean: no auth UUID, no email-as-identifier-of-record, no private contact data (see R5). | Covered by R5 assertions. |
| H4 | No route or RPC lets a caller assert another user's identity by passing `creatorId`/`hostId` as an ownership document. | Integration: cross-user POST attempt (A5) yields stored `creator_id` = caller, not the spoofed value. |

## 7. Demo regression (D7)

| # | Criterion | PASS condition |
|---|-----------|----------------|
| DR1 | Discover **demo mode** creator flow still writes the JSON path (`/api/events` → `published-event-store`). | Code inspection: demo branch of `/events/new` POST path remains on `/api/events` JSON store; optional demo-browser run confirms JSON write. |
| DR2 | Static/demo `/events/[slug]` page is unchanged and still renders demo events (including existing `allEvents` + shared JSON events). | Code inspection + demo browser run (or build) — the page still resolves `getEventBySlug`/`getSharedEventBySlug`. |
| DR3 | Live mode is gated by `demoMode=false` config (production forces it), so demo and live behavior are cleanly separated. | Config inspection + a `next build`/`tsc` success. |
| DR4 | Discover build/type check is green after the change (`next build`, `tsc`, and the discover vitest suite). | Run and report results; any failure = NOT green. |
| DR5 | Backend `pnpm typecheck`, `pnpm test` (unit), and the integration suite are green. | Run and report results. |
| DR6 | The redirect contract `{type:'tutoria-event-published', slug}` → `window.location /events/<slug>` with the **actual** returned slug is preserved; demo mode keeps redirecting via the JSON store's returned slug. | Code inspection of the live-mode POST redirect; unit-level or vendor-inspection of the message handler (`event-new-frame.tsx`). See U-criteria for live-browser limits. |

## 8. Input hardening, rate limit, sanitization, body caps

| # | Criterion | PASS condition |
|---|-----------|----------------|
| LD1 | The backend POST zod-validates against an `eventPostSchema`-equivalent and rejects invalid bodies with a 4xx (400) and no persistence. | Unit + integration: send invalid body (missing required field, bad slug chars, oversize array) → 400; assert no row/JSON write. |
| LD2 | Rate limiting is applied to the events POST (consistent with `config.rateLimit` and/or the in-memory limiter), returning 429 on burst. | Unit: exceed the per-window limit → 429. Rate-limit window/allocation is a reversible design choice — the PASS condition is that a limit exists and 429 triggers. |
| LD3 | Sanitization is applied to user/payload-controlled fields before persistence (mirroring `sanitizeTree` defense-in-depth; the DB is the authority and payload is display-only). | Code inspection: route/service sanitizes the submitted payload; a payload containing injection-looking strings is stored inertly and served without script/HTML execution risk. |
| LD4 | The route has a body-size cap consistent with the payload (base64 images up to ~350 KB each) and oversized bodies are rejected (413). | Unit: POST a body over the route cap → 413. The scoped `bodyLimit` must be large enough for a realistic event but bounded. |

## 9. Contract-change protocol
- Every criterion above is LOCKED for this run. It may be revised ONLY when new information legitimately surfaces, and only with these records: (a) original criterion, (b) why it changed, (c) who authorized it (orchestrator approval required), (d) the replacement wording. A criterion is never silently weakened because the implementation failed to satisfy it. Any change is appended to this file as a dated amendment; the original criterion text is preserved.
- QA reports each criterion's status (PASS / PARTIAL / UNVERIFIED / BLOCKED) against the ORIGINAL contract; where a criterion was amended, the amendment is cited.

## 10. Out-of-scope guardrails (D6)
The implementer MUST NOT creep into these in this slice:
| # | Guardrail | Enforcement evidence |
|---|-----------|----------------------|
| OS1 | **No bookings** — no `bookings`, `sessions` (booking-grade), `attendance`, `reschedule_requests`, or payment rows are created, modified, or required by the events publish/read. The event's own schedule/plan text in the payload is display content only. | Code inspection + integration: after publish, assert zero rows in `sessions`/`bookings` attributable to this event; no `create_booking`/`create_session` calls in the event code path. |
| OS2 | **No capacity acquisition** — no capacity reservation/locking is performed on publish. | Code inspection: no `session_hard_reserved`, no capacity CAS in the event path. |
| OS3 | **No payments/refunds** — no payment or refund objects are created. | Code inspection + grep for payment/refund calls in the event path. |
| OS4 | **No rearchitecture** — the venue is the existing `backend/` Fastify + Supabase app; no new database (e.g., not routing to JSON/localStorage)/file storage backends are introduced for real identity or publication authority. | Code inspection: publication state lives in `offerings` (Supabase), not localStorage/JSON. |
| OS5 | **Deletion is unpublish-only** (D3): no hard-delete API for events in this slice; `unpublished` via the `update_offering_status` CAS path is the documented removal semantics. | Code inspection: no hard-DELETE route for events; any removal goes through `unpublished`. |

---

## 11. Items QA could NOT fully ground / flagged for decision (QA does NOT decide)
These are factual gaps or policy tensions surfaced during preflight. They are recorded so the orchestrator/product can authorize before implementation, and so verification is not blocked by ambiguity:

- **F1 (flaggable, suggests additive migration):** The canonical `create_offering(uuid-based)` RPC does not carry `config`, does not honor a client slug, always inserts `draft`, and uses a NON-deterministic random-8 suffix on conflict. D4 requires a deterministic suffix and D2 requires storing the discover payload, which requires the `config` column. The planned "small additive migration ONLY if needed" is therefore LIKELY REQUIRED (read-by-slug + config write + owner host row). QA does NOT decide the migration shape; it requires that the observable criteria (S1–S3, P1–P2, R7, V1–V4) hold regardless of mechanism.
- **F2 (owner capability gap):** `create_offering` does not insert an `offering_hosts` row, so `can_manage_offering(creator, 'host')` fails for a brand-new event unless the implementation inserts an owner capability row (same transaction). Without it, `update_offering_status(…,'published')` cannot succeed. The contract requires R7 evidence that publish works end-to-end for a fresh event. `PRODUCT_DECISION_REQUIRED` if the team instead chooses a different ownership mechanism (e.g., bypass CAS via service-role) — but the no-cross-user rule (A5) and D5 still bind.
- **F3 (slug normalization):** discover permits `^[\w-]+$` (uppercase, underscores) while DB is `^[a-z0-9]+(-[a-z0-9]+)*$`. The backend must normalize/reject accordingly. Contract requires the returned slug to satisfy the DB CHECK and resolve (S1–S3); the exact normalization is the implementer's choice, not a product decision.

### 12. Verification-environment honesty (VERIFIABLE vs UNVERIFIED)
| Capability | Verifiable today? | Notes |
|------------|-------------------|-------|
| Backend unit tests (Fastify inject + FakeAuthService) | **YES** | `pnpm test`. Used for A2, A6, LD1–LD4, V4, H2, and error mapping/headers. |
| Backend integration tests against local Supabase | **YES (conditional on local Supabase running + env vars)** | `test-integration/` tier with `signUpConfirmed`. Covers A1–A7, P1–P5, R1–R7, V1–V4, S1–S3, H1–H4, OS1–OS5. Requires `SUPABASE_TEST_URL/PUBLISHABLE_KEY/DB_URL/SERVICE_ROLE_KEY` pointing at localhost. If local Supabase is not running, these are BLOCKED/UNVERIFIED. |
| Backend `pnpm typecheck` / build | **YES** | Runs locally. |
| Discover `next build` / `tsc` / vitest | **YES** | Runs locally (demo + live build config). |
| Demo-mode browser run (`/events/new` JSON path, static `/events/[slug]`) | **YES** | Local `discover` demo mode via browser (agent-browser if available; otherwise report as code-inspection + build). |
| Public-read curl against a real deployed backend once a row exists | **YES (conditional)** | If a backend deploy + seeded published row exists, curl `GET /api/v1/events/<slug>` anonymously to confirm 200 and clean output. Otherwise UNVERIFIED. |
| **Live signed-in browser publish** (`createSignedInUser` with a real account, visibility select, redirect to `/events/<actual>`) | **UNVERIFIED-CONDITIONAL** | Real sign-up may or may not yield a session without email confirmation; per `session.ts`, a non-authenticated session yields no access token, and per `assert_verified_booking_caller`, an unconfirmed email is rejected. **Precondition:** a real, email-confirmed `auth.users` account with an active Supabase session (access_token) must exist in the LIVE project’s Supabase, AND the creator must be signed-in on the live discover site. Meeting this precondition likely requires either (a) founder-provided credentials for an already-confirmed account, or (b) a confirmed sign-up being completed end-to-end in the live environment. Without it, the full authenticated browser E2E cannot be exercised by QA and the criterion is reported UNVERIFIED-CONDITIONAL with this exact precondition recorded. |

### 13. Required evidence for overall PASS
1. Integration suite green (or blocked explicitly) covering: A1–A7, P1–P5, R1–R7, V1–V4, S1–S3, H1–H4, and OS1–OS5 no-creep assertions.
2. Backend unit tests green for A2, A6, LD1–LD4, V4.
3. `pnpm typecheck` + `pnpm test` green in `backend/`.
4. Discover `next build` + `tsc` (+ discover vitest) green; DR1/DR2 confirmed by inspection.
5. Public-read curl (if a row exists) confirming R1/R5 clean output; otherwise UNVERIFIED with the same caveat.
6. Live signed-in browser E2E: **UNVERIFIED-CONDITIONAL** pending the Section 12 precondition. If unmet, that criterion and the redirect criterion are reported UNVERIFIED-CONDITIONAL (not implied success), and no claim of "production-publish verified in browser" is made.

Any criterion whose check could not run is reported UNVERIFIED (never implied PASS).

---

## 14. Browse listing contract (L-series) — additive amendment

Amendment record: added by orchestrator after the publish/read slice shipped, to cover the public browse listing (`GET /api/v1/events`, list RPC, and the live-mode discover merge into `/events`). Rationale: contract §0.1–§13 covered single-event publish/read but not the browse listing the feature was meant to serve ("functions like similar apps"). No prior criterion is weakened; this section is additive.

### 14.1 Scope
A public browse listing endpoint returns published events (`kind='event'`) for the `/events` discover browse feed (the `events-exact.html` iframe rendered in live mode). Mechanism: `list_public_events()` RPC (additive migration `20260830100000_events_public_list.sql`) → `eventPublicationService.listPublicEvents()` → public `GET /api/v1/events` (no auth) → discover `/api/events` GET merges backend events with shared demo events in live mode, deduped by slug (backend wins).

### 14.2 Criteria
| # | Criterion | PASS condition |
|---|-----------|----------------|
| L1 | The list returns **only** rows with `publication_status='published'` AND `kind='event'`. Drafts/unpublished rows and non-event offerings never appear. | Integration test: publish one Public + one non-Public (draft); `list_public_events()`/`GET /api/v1/events` contains the published slug and not the draft slug; ordering never includes non-public or non-event rows. |
| L2 | Each list item is a public card (slug, title, host, topic, type, price, capacity, date, time, location, level, image, subtitle where present), spread from the stored config plus slug/title. | Integration test: published event's list item includes slug, title, host, and the card fields that were stored; discover `/api/events` merge yields an `EventDetail` the `events-exact.html` card mapper can render. |
| L3 | No auth UUID, email-as-identifier-of-record, or phone/private-contact keys leak through the list (config scrubbing of identity/contact keys). | Integration test: `JSON.stringify(list)` does not contain the creator's `auth.uid()` UUID, the creator's email, phone, or scrubbed contact keys (`creatorId`, `creatorEmail`, `creator_id`, `phone`, etc.). |
| L4 | Newest published first. | Integration test: listed `published_at` values are non-increasing (descending). |
| L5 | List is cache-safe / marked no-store and returns 503 (not 500) when the backend/list service is unavailable. | Unit test: `Cache-Control: no-store` on `GET /api/v1/events`; service unavailable → 503 `SERVICE_UNAVAILABLE`. |
| L6 | Live-mode discover merge does not emit a duplicate slug and does not block on a backend outage (falls back to shared demo events if the backend fetch fails). | Discover route test/inspection: merged list has unique slugs; a failing backend fetch returns shared events only (no exception). |
| OS1–OS3 | Unchanged from §10: listing creates no sessions/bookings/attendance/capacity/payment rows. | Code + integration: list path performs no booking/session/payment writes. |

### 14.3 Verification-environment honesty (adds to §12)
| Capability | Verifiable today? | Notes |
|------------|-------------------|-------|
| Backend unit tests for list route (L5) | YES | `test/events.test.ts` (23 tests) via FakeAuthService/inject. |
| Backend integration tests for list RPC + route (L1–L4) | YES (conditional on local Supabase) | `test-integration/events-public-list.test.ts` (2 tests) + `events-publication.test.ts` (8) + events unit 23; uses `sql.unsafe(migration)` + `notify pgrst, 'reload schema'` to refresh PostgREST cache for a runtime-created function. |
| Live publish → browse round trip (publish full event via `POST /api/v1/events`, confirm it appears in discover `GET /api/events` with card fields and no identity leak) | YES (local stack) | Verified via running backend `:4000` + discover `:3456`; a full-format event was published and appeared in `/api/events` with topic/level/type/price/capacity/date/time/location/image and no UUID/email/phone. |
| Scripted literal browser click-through of the creator form → browse | UNVERIFIED | No playwright/puppeteer/agent-browser available (only interactive Chrome). API + render path proven; browser click-through remains UNVERIFIED. |

### 14.4 Required evidence for L-series PASS
1. `test/events.test.ts` green (includes L5 unit + R6 single-read regression).
2. `test-integration/events-public-list.test.ts` + `events-publication.test.ts` green against local Supabase.
3. Backend `pnpm typecheck` + `pnpm test` green; discover `pnpm test` (182) + `next build` green.
4. Live round trip: published full event appears in discover `GET /api/events` with full card fields and no identity leakage.
5. Browser click-through of creator form → browse: UNVERIFIED (no automation tooling); not implied PASS.

---

## 15. Operator checklist (soft launch)

This section is the operator-facing checklist for opening, monitoring, and gating the soft-launch gate. It is additive; no criterion above is weakened. The matching on-call runbook lives at `docs/soft-launch-events.md` — this section is the checklist version.

### 15.1 Pre-launch (must be true before opening the gate)
- [ ] Local Supabase fresh-DB apply of `20260901000000` + `20260902000000` migrations green
- [ ] Backend test suite green (`vitest run`)
- [ ] Discover test suite green (`vitest run`)
- [ ] `pnpm build` green
- [ ] `NEXT_PUBLIC_SITE_URL` set in deploy env
- [ ] Backend structured logs flowing to stdout (verify a publish POST produces an `events.publish.attempt` then `events.publish.success` line)
- [ ] Runbook committed at `docs/soft-launch-events.md`
- [ ] Rollback procedure tested in staging (set `NEXT_PUBLIC_TUTORIA_DEMO_MODE=true`, verify `/api/events` takes over)

### 15.2 Launch (enable the gate)
- [ ] Feature flag enabled in production (currently implicit via verified-user gate; no flag to flip)
- [ ] One manual smoke: verified user publishes one event, browses `/events/<slug>` from an unauthenticated browser, verifies host name matches

### 15.3 First 24h
- [ ] No spike in `publish.failure` with unexpected code
- [ ] No P0/P1 from the published event surface
- [ ] Rollback runbook on standby

### 15.4 First week
- [ ] At least 3 successful publishes
- [ ] No data integrity issues (no published events with leaked identity keys)
- [ ] Recommendations algorithm: verify "same host" events appear first in `/events/[slug]` sidebar

### 15.5 Public launch (gating to release)
- [ ] Full moderation tooling (G-8 from audit)
- [ ] Supabase Storage for images (G-4 from audit)
- [ ] Playwright E2E suite (G-7 from audit)
- [ ] Security reviewer sign-off

(End of file - total 211 lines)
