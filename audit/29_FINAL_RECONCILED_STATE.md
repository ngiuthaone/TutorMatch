# 29 — FINAL RECONCILED STATE

**Date:** 2026-08-27
**Author:** Orchestrator (reconciliation of prior forensic audit reports 01–18 with Manus independent Product Reality / E2E audit)
**Branch:** `consolidation/2026-08-20-pre-manus` @ `9aa03a20f9046a6922da2df26cd28ec1c7f8c53e`
**Scope:** READ-ONLY reconciliation. No code, migration, deploy, commit, or fix was performed.

---

## A. Purpose and Method

Two independent audits produced partially conflicting pictures of Tutoria:

1. **Prior forensic audit (this repo, reports 01–18):** deep source/DB/tests reconstruction. Verdict leaned "backend core strong, but not deployable/connected end-to-end." Reported backend unit tests 337/337 PASS; discover tests 165/165; root auth 100/100; integration tests BLOCKED by stale local Supabase (26 FAIL / 24 PASS / 99 SKIP); live Vercel originally served an unrelated CRA scaffold (that observation predates the current `discover-gules-xi` deployment).
2. **Manus independent audit (4 near-duplicate files in `~/Downloads/tutoria_audit_results{,_v2}/`):** runtime/E2E read-only audit of `https://discover-gules-xi.vercel.app`. Verdict: "Production shell, demo guts" (~30% E2E readiness); claims the app is a static demo-mode shell, booking/payment disconnected, worker TTL broken, `/bookings/[id]` 404, host center mock, pricing `fixed_v1`.

This report reconciles the two into ONE authoritative baseline. Each Manus claim is classified **CONFIRMED / PARTIALLY_CONFIRMED / CONTRADICTED / UNKNOWN**, with file:line/runtime evidence. Evidence hierarchy respected: runtime > passing tests > implemented code > config > comments. "Exists" is never equated with "complete."

---

## B. Resolution of the Core Disagreement

The single most important reconciliation: **Manus and the prior forensic audit were looking at two different layers, and both are true.**

- **Source code layer:** `discover/` contains a complete, real API client layer (`booking-api.ts`, `workshop-booking-api.ts`, `tutor-booking-api.ts`, `tutor-cv-api.ts`, `payment-api.ts`, `marketplace-api.ts`), a production Supabase auth stack (`auth/session.ts`, `auth/supabase-client.ts`, `auth/server-verify.ts`), and a robust backend shared-booking engine. This layer is **present and mostly implemented in code.**
- **Deployed runtime layer:** `discover-gules-xi.vercel.app` runs with **no `NEXT_PUBLIC_TUTORIA_*` env vars set**, so `auth/config.ts:45` defaults `demoMode=true`, `isLiveMode()` is false, and every real API surface is bypassed. The code paths users actually see on the live site are fixtures, static-iframe HTML, and `localStorage`.

**Consequence:** the live deployment is a demo shell, but the source is NOT a mock — it has a real (if gated) production data path. Manus's "30% E2E readiness" describes the *runtime*; the prior forensic "strong backend core" describes the *source*. Both are correct at their layer. The real gap is **configuration/deployment + surface wiring + a handful of genuine defects**, not an absent backend.

Manus's headline "static frontend shell, disconnected from production services" is therefore **CONFIRMED for the live runtime only**, and **qualified** because the same code holds a real, working API layer that simply is not yet activated on the deployed host.

---

## C. Manus Claim-by-Claim Classification

| # | Manus claim | Classification | Evidence / Basis |
|---|-------------|----------------|------------------|
| C1 | Vercel deployment `discover-gules-xi.vercel.app` is the live Tutoria app | **CONFIRMED** | Live fetch returns the full Tutoria landing (`/discover`), not a CRA scaffold (which the earlier `tutormatch.vercel.app` served). `discover/.vercel/project.json` project "discover". |
| C2 | `window.TUTORIA_CONFIG` NOT_DEFINED; `/config.js` → 404 | **CONFIRMED** | Live `curl /config.js` → 404; no `tutoria-config` injection observed in HTML. `config.ts:150-164` loads `/config.js` only when env fallbacks absent and returns silently on 404. |
| C3 | `auth/config.ts` defaults `demoMode=true` unless `NEXT_PUBLIC_TUTORIA_DEMO_MODE=="false"` | **CONFIRMED** | `discover/src/lib/auth/config.ts:45`: `demoMode: process.env.NEXT_PUBLIC_TUTORIA_DEMO_MODE !== "false"`. |
| C4 | Deployment routes all `/api/*` to 404 (static shell) | **PARTIALLY_CONFIRMED** | Root `vercel.json:25-27` routes `/api/(.*)`→404, but this belongs to the root "tutormatch" project, not the Next.js "discover" project (rooted at `discover/`, framework nextjs). Live `/api/events` → **200** (real Next route handler), `/api/v1/test` → **404**, `/api/events` POST exists (`app/api/events/route.ts`). **Correction:** what fails is `/api/v1/*` (the Fastify backend proxy path), not *all* `/api/*`. The backend is not deployed/reached; there is no `/api/v1/*` handler on the Vercel host. |
| C5 | Discovery/events listed from `event-data.ts` + `events-exact.html` fixtures | **CONFIRMED for listing; CONTRADICTED for detail** | `/events` iframe `public/events-exact.html` (hard-coded fixtures + merges `tutoria-published-events`) — `events-embed.tsx:49`. BUT `/events/[slug]` detail page uses `getMarketplaceListing("event", slug)` → `/api/v1/marketplace/event` (real API), not fixtures — `workshop-detail-page.tsx:119`, `events/[slug]/page.tsx`. Fixtures only feed `generateStaticParams`/metadata. |
| C6 | `/events/[slug]` routing "falls back to Pizza 4P's fixture regardless of slug" | **CONTRADICTED (source); UNKNOWN (deployed build)** | Current source: slug detail calls the API; on failure the client sets `not-found` (no Pizza fallback to render). Live SSR returns 200 shell for any slug (client decides ready/not-found). The Pizza-4P's fallback Manus saw is not present in this code; likely an artifact of prerendered metadata/generateStaticParams or a stale deployed build. |
| C7 | Booking/payment "NOT CONNECTED / MOCK" in runtime | **CONFIRMED for runtime; CONTRADICTED as "absent in source"** | Real API client exists (`booking-api.ts:154,178`, `payment-api.ts:46`) but gated behind `isLiveMode()`; in demo runtime the checkout is a client-side confirmation. The *wiring exists in code*; it is simply unused on the live host. |
| C8 | `/bookings/[id]` redirect after booking → route missing → 404 | **CONFIRMED** | `workshop-detail-page.tsx:214` `window.location.assign('/bookings/'+id)`. Only `discover/src/app/bookings/page.tsx` exists (no `[id]` dynamic child). No route render for `/bookings/[id]` in app dir. |
| C9 | Financial worker omits `sweepExpiredWorkshopBookings` → TTL never runs | **CONFIRMED** | `backend/src/workers/financial-worker-runtime.ts:25-29` sweeps only `refund_execution`/`refund_reconciliation`/`payment_finalization`. `sweepExpiredWorkshopBookings` exists in `payment-service.ts` + DB RPC `expire_stale_workshop_bookings` but is not in the loop. **Additive omission.** |
| C10 | VNPay backend implemented, frontend mock | **CONFIRMED** | `payments.ts` route, `vnpay-adapter.js`, migrations 0008/0009 present (code). Frontend `payment-api.ts:46` is live-gated. VNPay runtime ENV UNKNOWN (sandbox configured in `render.yaml`). |
| C11 | `/center` is static iframe bridge, hard-coded "Linh Nguyen", mock when not live | **CONFIRMED** | `center/page.tsx:57` iframe `center.html`; `center.html:125` "Linh Nguyen · All locations · Owner"; `center/page.tsx:23,42` returns mock `tutoria-center-demo` when `!isLiveMode()`. **BUT:** live mode has real RPC wiring (`tutor-booking-api.ts:96` `/api/v1/me/tutor-bookings`, accept/reject/cancel). Mode-gated hybrid, mock by default. |
| C12 | Workshop creator is a static prototype; publish does not create real offerings/sessions | **CONFIRMED** | Creator writes `localStorage tutoria-published-events` / Node file `data/published-events.json` (`event-creator.tsx`, `published-event-store.ts`). Does NOT call `create_offering`/`create_session`. |
| C13 | Auth is mock `localStorage tutoria_accounts` in demo | **CONFIRMED (demo) / CONTRADICTED (as "only" behavior)** | `sign-up-flow.tsx:113-115` writes `tutoria_accounts` when `!live`; `sign-in-form.tsx:20` reads it. Live path (`session.ts`) uses real Supabase `signInWithPassword`/`signUp`. Mode-gated hybrid. |
| C14 | Shared booking engine supports `hourly_v1`(tutor)/`fixed_v1`(workshop) | **PARTIALLY_CONFIRMED** | `20260819120000_shared_booking_engine.sql` defines `resolve_booking_pricing` with `fixed_v1` (workshop) / `hourly_v1` (tutor). **BUT** the later workshop-v1 migrations + live route validation use `flat_per_participant_v1`, not `fixed_v1` (see Section D). |
| C15 | Prior "90% readiness" wrong; true E2E ~30% | **PARTIALLY_CONFIRMED** | Readiness is layer-dependent: backend source is strong, but *production E2E of the deployed demo host* is low. The "90%" figure was never an audited claim in this repo. |
| C16 | `/center` unauthenticated access is a security risk pattern | **PARTIALLY_CONFIRMED** | Route is reachable (live 200), but the served data is a mock fixture, not real PII — so no live leak. However the architecture (public route + mode-gated data) is a **structural** risk if live mode is enabled without auth (RLS untested against it). |
| C17 | Missing workshop publishing to `offerings`/`sessions` | **CONFIRMED** | Supabase already has `create_offering` + `create_session` RPCs; the frontend creator does not call them. |
| C18 | `/learning` static iframe hard-coded "Khoa Nguyen" progress | **CONFIRMED** | `learning/page.tsx` + `learning-exact.html:170,320-389` ("Khoa Nguyen", 68/42/27%). No backend learning-progress API exists. |
| C19 | Courses/community routes are static shells | **CONFIRMED** | `courses-embed.tsx:49` iframe `courses-reference.html`; `communities-page.tsx` hard-coded; discussions/articles via `lib/storage.ts` localStorage. |

**Net:** of 19 distinct Manus claims → 11 CONFIRMED, 7 PARTIALLY_CONFIRMED, 1 CONTRADICTED (C6). No claim was entirely wrong; the largest corrections are C4 (not *all* `/api/*` is 404) and the framing that the source lacks a real data path (it exists but is gated).

---

## D. Pricing-Model Contradiction (Resolved)

The prior forensic record (and observed `backend/src/routes/booking.ts:13`) used `flat_per_participant_v1` for workshops. Manus reported `fixed_v1`. Both exist:

| Migration | Workshop pricing model | Role |
|-----------|------------------------|------|
| `20260819120000_shared_booking_engine.sql` | `fixed_v1` | First shared engine `resolve_booking_pricing` (older, 08-19) |
| `20260820100000_workshop_booking_v1_schema.sql` | `flat_per_participant_v1` | Bookings pricing constraint CHECK (`'hourly_v1','flat_per_participant_v1'`) — lines 10, 27-28, 52-57 |
| `20260820100001_workshop_booking_v1_rpcs.sql` | `flat_per_participant_v1` | Latest `create_booking` (inline pricing) line 57-78; `create_offering` validates `pricing_model not in ('hourly_v1','flat_per_participant_v1')` (line 456), i.e. **rejects `fixed_v1`** |
| `backend/src/routes/booking.ts:13` | `flat_per_participant_v1` | Route validation enum |

**Resolution:** `fixed_v1` is a **dead/superseded branch** inside `resolve_booking_pricing` (only defined in the older shared engine, never redefined, and no offering can be created with it via the current `create_offering`). The **authoritative workshop path is `flat_per_participant_v1` (and `hourly_v1` for tutors)**. Manus's "fixed_v1" reading was based on the shared-engine migration alone. **Corrective note for code:** the `fixed_v1` branch in `resolve_booking_pricing` should be reconciled/removed so the DB constraint set is single-source-of-truth.

**Related genuine defect (bridges both audits):** there are now **two `create_booking` overloads** — 2-arg (`session_id, participant_count dfs=1`, last from shared engine) and 3-arg (`... , p_idempotency_key dfs=null`, from `20260820100001:9`). `CREATE OR REPLACE` with a different signature creates an overload, not a replacement → ambiguous `PGRST203` when the client calls without explicit arg matching. Confirmed by prior forensic integration-test failure.

---

## E. Definitive System Matrix (Source truth; runtime = demo unless noted)

Legend for **Integration**: `CONNECTED` = real backend/marketplace/Supabase path; `MOCK` = fixtures/localStorage/static-iframe; `HYBRID` = live-gated; `GAP` = backend absent or broken.

| System / Surface | Backend (source) | Frontend (source) | Integration (live runtime) | E2E verdict |
|---|---|---|---|---|
| Auth (Supabase + `/api/v1/me`) | IMPLEMENTED | IMPLEMENTED | HYBRID (MOCK `tutoria_accounts` in demo) | Demo MOCK |
| Discover/Home | marketplace routes exist | IMPLEMENTED (fixture arrays) | MOCK | MOCK |
| Events listing `/events` | — | IMPLEMENTED (iframe `events-exact.html`) | MOCK | MOCK |
| Event/Workshop detail `/events/[slug]`, `/workshops/[slug]` | `GET /api/v1/marketplace/event` IMPLEMENTED | IMPLEMENTED | CONNECTED (API) — not-found without API | **CONNECTED (breaks in demo)** |
| Workshop listing `/workshops` | `GET /api/v1/sessions` IMPLEMENTED | IMPLEMENTED | CONNECTED (API) | CONNECTED (breaks in demo) |
| Events-live `/events-live` | `GET /api/v1/offerings`,`/api/v1/sessions` IMPLEMENTED | IMPLEMENTED | CONNECTED (API) | CONNECTED (breaks in demo) |
| Tutor profile `/tutor/[name]` | `GET /api/v1/tutors`,`/tutors/{id}` IMPLEMENTED | IMPLEMENTED (iframe bridge) | HYBRID (live API; demo static) | Case-dependent |
| Tutor discovery `/people`, `/search` | search/list routes IMPLEMENTED | IMPLEMENTED (iframe/browser) | MOCK | MOCK |
| Booking engine (shared `offerings`/`sessions`/`bookings`) | IMPLEMENTED (migrations + RPCs) | IMPLEMENTED (`booking-api.ts`) | CONNECTED code; **runtime broken by overload + no backend** | PARTIAL (defect) |
| Payment (`/api/v1/payments/start`, VNPay) | IMPLEMENTED (payments.ts, vnpay-adapter, migrations) | IMPLEMENTED (`payment-api.ts`) | HYBRID | PARTIAL |
| Payment TTL / financial worker | IMPLEMENTED but **call omitted in loop** | N/A | BROKEN (worker gap) | BROKEN |
| Host Center `/center` | `me/tutor-bookings` + host RPCs IMPLEMENTED | IMPLEMENTED (iframe `center.html`) | HYBRID (demo mock) | MOCK (demo) |
| Workshop/Eevent creator `/events/new` | `create_offering`/`create_session` IMPLEMENTED | IMPLEMENTED (writes localStorage) | MOCK | MOCK |
| Learning `/learning`, schedule | **NOT_IMPLEMENTED** (no progress API) | IMPLEMENTED (iframes) | MOCK | MOCK |
| Messages `/messages` | **NOT_IMPLEMENTED** (no messaging API) | IMPLEMENTED (iframe) | MOCK | MOCK |
| Notifications | **NOT_IMPLEMENTED** (localStorage even in live) | IMPLEMENTED | MOCK | MOCK |
| Discussions/Articles/Communities | **NOT_IMPLEMENTED** | IMPLEMENTED (fixtures + localStorage) | MOCK | MOCK |
| Courses `/courses` | **NOT_IMPLEMENTED** | IMPLEMENTED (iframes + fixtures) | MOCK | MOCK |
| Marketplace read (`/api/v1/marketplace/{kind}`) | IMPLEMENTED | IMPLEMENTED | CONNECTED (breaks in demo) | CONNECTED |

**Reading:** Only four source surfaces are truly API-connected (workshop/event detail, workshop list, events-live, and — in live mode — tutor profile / center / auth). A broad set of community/social surfaces (messages, notifications, learning, courses, discussions, articles, communities) have **no backend at all** and are documentary mocks. The `discover` home is hard-coded fixtures.

---

## F. Definitive User-Flow Matrix (with first real failure point)

**LEGEND M = mock, C = connected-to-API (live), B = broken, X = missing.**

### Host → Workshop loop
| Step | Frontend | Backend | E2E | First real failure |
|---|---|---|---|---|
| Host signs in | M (demo) | IMPL | M→needs live | Demo auth writes localStorage; no real Supabase on host |
| Create workshop `/events/new` | M (creator) | IMPL (`create_offering`) | **B** | Creator writes localStorage, does NOT call `create_offering` → nothing persisted server-side |
| Publish offering/sessions | M | IMPL RPCs | **B** | Not wired to RPCs |
| View/manage in `/center` | M (iframe) | IMPL host RPCs | M demo | Demo returns `tutoria-center-demo`; live works but unauthenticated route risk |
| TTL expiry sweep | N/A | IMPL but **loop omitted** | **B** | Worker never calls `sweepExpiredWorkshopBookings` → stale bookings lock capacity |

### Learner → Workshop loop
| Step | Frontend | Backend | E2E | First real failure |
|---|---|---|---|---|
| Discover workshops | C (API) / M (listing) | IMPL | C in live | Demo listing is iframe fixtures; detail is API → breaks in demo |
| View detail | C (API) | IMPL | C in live | Live needs working `/api/v1/marketplace/event` |
| Sign in (auth) | M/HYBRID | IMPL | M demo | Demo bypasses real auth |
| Book session | C (`booking-api.ts`) | IMPL `create_booking` | **B below** | Ambiguous `create_booking` overload (PGRST203) + no backend |
| Pay (VNPay) | C `payment-api` | IMPL | PARTIAL | No deployed backend; VNPay env UNVERIFIED |
| **Redirect after confirm** | `/bookings/[id]` | — | **B** | Route 404 (C8) |
| Learning/attendance | M iframe | NOT_IMPL | M | No progress backend |

### Tutor loop
| Step | Frontend | Backend | E2E | First real failure |
|---|---|---|---|---|
| Onboard/CV | C (`tutor-cv-api`) | IMPL | C live / M demo | Demo static |
| Profile/availability/offering | C | IMPL | C live | Live only |
| Booking accept/reject | C (`tutor-booking-api`) | IMPL | C live / M demo | Live only |
| Session completion | PARTIAL | PARTIAL | PARTIAL | No single verified completion path |

---

## G. KEEP / REPAIR / REWRITE / BUILD / DEPRECATE

### KEEP (production-grade, don't rebuild)
- **Shared booking engine** (`offerings`/`sessions`/`bookings` + `resolve_booking_pricing`, RPCs, outbox, history, capacity) — the heart; only connect/finish.
- **Payment/refund/payout V2** domain: payment-provider migrations 0008/0009, refund obligation, refund recovery worker, VNPay adapter (sandbox).
- **Supabase auth + backend `/api/v1` stack** (Fastify, RLS-driven routes, `me`, tutor-cv, booking, payments, marketplace).
- **Financial worker skeleton** + refund sweeps (add the missing TTL call only).
- **API client layer** in `discover/` (`booking-api`, `tutor-cv-api`, `payment-api`, `marketplace-api`) — real, keep and activate.
- **Backend test suite** (337 unit + integration scaffolding) and **discover unit tests** (165) and **root auth** (100).

### REPAIR (small, targeted)
- **Worker TTL**: add `sweepExpiredWorkshopBookings` to `financial-worker-runtime.ts` sweep list (1-line-ish). [P1]
- **`/bookings/[id]` route**: add dynamic detail route or change redirect to `/bookings?created=...`. [P1]
- **`create_booking` overload**: reconcile 2-arg vs 3-arg signatures to remove `PGRST203`. [P0]
- **Pricing model**: reconcile `fixed_v1` (dead) with `flat_per_participant_v1`; single source of truth; remove stale `.bak` migration file. [P1]
- **Local DB for integration tests**: bring local Supabase to migration head (currently missing `20260819120000` partial apply + `20260820100001`/`...20000`) so integration tests can run. [P0 infra for verification]
- **`/config.js` + env activation**: deploy with real `NEXT_PUBLIC_TUTORIA_DEMO_MODE=false` + Supabase + API base URL (flips all HYBRID surfaces to live). [P0]
- **Design root CSP**: current policies are `Content-Security-Policy-Report-Only` (not enforced) — tighten before production. [P2]

### REWRITE (replace mock/iframe with backend-connected native UI, only where in alpha scope)
- **Workshop/event creator** — rewire to `create_offering`/`create_session`. [P0]
- **Host Center** — native React dashboard calling `me/tutor-bookings` + host RPCs (replace `center.html` iframe). [P2 for public; P0-lite for host loop]
- **Events listing & course listing** — replace static iframes (`events-exact.html`, `courses-reference.html`) with API-driven components. [P1]
- **Sign-in/sign-up** — strip demo localStorage auth once live Supabase is configured (keep demo only behind explicit dev flag). [P0 in bundled flip]

### BUILD (missing backend entirely — needed only post-alpha until scoped)
- **Messages/notifications backend** (no API exists). [POST_ALPHA unless in MVP]
- **Learning progress/attendance backend**. [POST_ALPHA]
- **Discussions/articles/communities persistence** (currently localStorage). [POST_ALPHA]
- **Courses marketplace** (no backend). [POST_ALPHA]
- **Real image upload** (S3/object storage; currently base64/localStorage). [P2/POST]

### DEPRECATE / clean
- **Stale `.bak` migration** `20260820100001_workshop_booking_v1_rpcs.sql.bak`. [housekeeping]
- **Root `tutormatch.vercel.app` CRA scaffold** and the `discover-gules-xi` demo-mode deployment as the only public host — replace the canonical live host with a live-mode deploy. [P0 ops]
- **`/api/state`, simulated/simple JSON stores, localStorage demo identities** for anything using real identity/ownership/payments. [production rule]

---

## H. Minimum Private Alpha Scope (smallest credible loop)

Two loops, fully server-authoritative, money-correct:

**Loop 1 — Host → Workshop:**
1. Live auth (Supabase) for host + learner.
2. Creator → `create_offering` + `create_session` (real publish).
3. Learner discovers/books via real `/api/v1/sessions` + `create_booking` (fix overload).
4. Payment TTL active (fix worker).
5. VNPay payment + fixed `/bookings/[id]` post-pay view.
6. Host Center (native, or authenticated live bridge) to manage bookings.
7. Refund/payout loop on cancel (already code-backed).

**Loop 2 — Tutor:**
1. Live auth.
2. CV publish → profile → offering/availability.
3. Booking request → accept/reject → session → completion (server-authoritative, `expectedVersion` CAS already in API client).
4. Tutor Center to manage.

**REQUIRED_FOR_ALPHA:** all of the above; **POST_ALPHA:** messages, notifications, learning/attendance dashboard, discussions, articles, communities, courses marketplace, native image upload.

---

## I. Prioritized Fixes (P0 / P1 / P2)

| ID | Priority | Component | Evidence | Root cause | Journey | Fix direction | Complexity |
|----|----------|-----------|----------|-----------|---------|---------------|-----------|
| P0-1 | P0 | Vercel deploy config | `vercel.json:25`, live demo runtime | Demo mode default + no `/api/v1` relay | All | Activate live env (`DEMO_MODE=false`, Supabase, API base); deploy backend + document canonical host | M |
| P0-2 | P0 | `create_booking` overload | 2-arg vs 3-arg migrations; PGRST203 | Signature mismatch → 2 overloads | Learner book | Reconcile to single signature | S |
| P0-3 | P0 | Auth live path | `config.ts:45`, `sign-in-form.tsx:20` | Demo localStorage bypass | All | Configure live Supabase; remove demo auth for prod | S |
| P0-4 | P0 | Workshop creator | `event-creator.tsx` writes localStorage | No `create_offering` call | Host | Wire creator → RPCs | L |
| P1-1 | P1 | Financial worker TTL | `financial-worker-runtime.ts:25-29` | Omitted sweep call | Host | Add `sweepExpiredWorkshopBookings` | S |
| P1-2 | P1 | `/bookings/[id]` | `workshop-detail-page.tsx:214` | Route missing | Learner | Add dynamic route or query-param success | S |
| P1-3 | P1 | Pricing model truth | shared engine `fixed_v1` vs `flat_per_participant_v1` | Two migration layers | Learner/booking | Reconcile; single source; drop `.bak` | S |
| P1-4 | P1 | Local Supabase (tests) | integration BLOCKED | Migrations not applied to local | Verification | Bring local DB to head | S |
| P1-5 | P1 | Events/listing iframes | `events-exact.html`,`courses-reference.html` | Static iframe | Discovery | Native API-driven lists | M |
| P1-6 | P1 | `/center` auth | public route + mock data | Demo fallback | Host | Auth-gate + live RPC (or native) | M |
| P2-1 | P2 | Host Center native | `center.html` iframe | Static bridge | Host | Native React dashboard | XL |
| P2-2 | P2 | Image upload | base64/localStorage | No storage | Creator | S3/object upload via backend | M |
| P2-3 | P2 | CSP enforce | `Report-Only` headers | Not enforced | Security | Promote to enforce; audit RLS on `/center` | M |
| P2-4 | P2 | Marketplace RLS audit | N/A | Not verified | Security | Confirm only-host writes listings | S |

---

## J. Deployment Truth

- **`discover-gules-xi.vercel.app`**: genuine Tutoria `discover` app, but **DEMO MODE** (no live env). Reachable routes: `/`, `/discover`, `/events`, `/events/*`, `/workshops`, `/auth/sign-in`, `/center`, `/learning` (200); `/api/events` 200; `/api/v1/*` and `/config.js` 404; `/sign-in` (no `/auth`) 404. **Not a production source of truth.**
- **Backend**: Fastify + Supabase exists in source; **Render `tutoria-api-staging` + `tutoria-financial-worker-staging` configured in `render.yaml` but live deploy status UNVERIFIED** (no confirmation any instance is up). No `/api/v1/*` is reachable from the Vercel host.
- **Supabase prod** (`sufjrstewzvzjzvzekry.supabase.co`): reachable (401 unauth), but migration state UNKNOWN; local per-forensic integration is stale.
- **Verdict: deployment is CONFIGURATION+OPERATIONS gated.** The code is ready to connect; the live runtime is not connected.

---

## K. Residual Policy / Security Notes

- **Do NOT rebuild** the existing backend (Supabase schema, offerings, sessions, booking engine, pricing, payments, VNPay, refunds, RLS, outbox, worker). Only connect/finish and replace the prototype frontend pieces.
- **Real identity/ownership/money must not** route through localStorage, JSON files, demo users, `/api/state`, or simulated payments. The demo `tutoria_accounts`/`tutoria-published-events`/`data/published-events.json` idempotency surfaces must be excluded from production flows.
- **Unauthenticated `/center` is structural risk** if live mode flips; gate before activation.
- **No external-source incorporation happened** in this reconciliation; license gate not re-triggered (read-only).

---

## L. Status Summary

- **Verification:** Backend unit 337/337 PASS; discover 165/165; root auth 100/100 (prior-verified). Integration tests UNVERIFIED (BLOCKED — stale local DB), which is itself a P1 item. Live runtime reverified (read-only) this session.
- **Manus claims:** 11/19 CONFIRMED, 7 PARTIALLY_CONFIRMED, 1 CONTRADICTED (event-detail Pizza fallback). No claim categorically false; the material corrections are the `/api/*` scope (C4) and proving the source has a real, gated API layer.
- **Headline reconciliation:** "Vỏ Production, Ruột Demo" is accurate for the **deployed runtime**; the **source** is "Production core, gated data path, many mock community surfaces." The single biggest lever is DOM/DEPLOY (turn on live mode + deploy backend), not new engineering.
- **Private Alpha is not yet runnable** because the live host is disconnected and two genuine defects block the money loop (overload `PGRST203`, worker TTL, `/bookings/[id]`). The foundation to reach it exists.
- **Final standing:** **PARTIAL — capable backend core with a real-but-not-deployed API path; live host in demo mode; community/social layer is mock; not production-verified.**

---

## TUTORIA FINAL CURRENT STATE

```
PLATFORM:  Tutoria (TutorMatch)
VERDICT:   PARTIAL  — "Production core, gated data path, demo runtime; not production-verified."

BACKEND:   PASS     — 337/337 unit tests; typecheck+build PASS; strong shared booking engine,
                     payments/VNPay/refund/payout, RLS, outbox, worker. Not deployable-in-place:
                     integration tests BLOCKED by stale local DB; /api/v1 not reachable on any host.
FRONTEND:  PARTIAL  — discover tests 165/165 PASS. Four surfaces API-connected (workshop detail,
                     workshop list, events-live, tutor profile[live]); many community surfaces mock
                     (messages, notifications, learning, courses, discussions, articles, communities).
                     Live deploy runs in DEMO MODE (no env), static iframes + localStorage.
INTEGRATION:NOT CONNECTED at runtime — real /api/v1 client layer exists but gated; live host 404s on
                     /api/v1/* and /config.js.
DEFECTS:   BROKEN   — create_booking overload (PGRST203); worker omits workshop TTL sweep;
                     /bookings/[id] redirect 404; /center unauthenticated (structural).
DEPLOYMENT:UNVERIFIED — discover-gules-xi = demo shell; Render backend UNCONFIRMED; prod Supabase
                     migration state UNKNOWN.
PRIVACY/SEC: PARTIAL — no live PII leak (mock data); RLS present but /center + CSP not hardened.
EXTERNAL:  PASS/gate — read-only; no incorporation this session.
FINAL:     PARTIAL / NOT PRODUCTION-READY — the foundation for Private Alpha exists in source;
           activation requires config+deploy + 3 targeted repairs (overload, worker TTL,
           booking-detail route) before the money loop closes.
```

---

## TOP 10 THINGS TO FIX BEFORE PRIVATE ALPHA

1. Turn on live config on the discover host (`NEXT_PUBLIC_TUTORIA_DEMO_MODE=false` + Supabase + API base URL) and fix `/api/v1` reachability. **(P0-1)**
2. Reconcile the two `create_booking` overloads to kill `PGRST203` so booking creation actually resolves. **(P0-2)**
3. Wire live Supabase auth end-to-end and remove the demo `tutoria_accounts` bypass from production. **(P0-3)**
4. Rewire the workshop/event creator to call `create_offering` + `create_session`. **(P0-4)**
5. Add `sweepExpiredWorkshopBookings` to the financial worker loop (unlocks payment TTL). **(P1-1)**
6. Fix the post-booking redirect (`/bookings/[id]` route or query-param success). **(P1-2)**
7. Bring the local Supabase to migration head so integration tests can run and give the journey a verification gate. **(P1-4)**
8. Reconcile pricing model (`fixed_v1` vs `flat_per_participant_v1`) to a single source of truth; drop the `.bak`. **(P1-3)**
9. Deploy + confirm the Render backend (`tutoria-api-staging`, financial worker) and verify production Supabase migration state. **(deployment)**
10. Replace demo iframe listings (`events-exact.html`, `courses-reference.html`) with API-driven lists for the alpha surfaces. **(P1-5)**

## TOP 10 THINGS THAT CAN WAIT (POST-ALPHA)

1. Native Host Center (replace `center.html` with React dashboard). **(P2-1)**
2. Messages backend + native UI (none exists). **(BUILD)**
3. Notifications backend (localStorage even in live). **(BUILD)**
4. Learning progress / attendance backend. **(BUILD)**
5. Discussions / articles / communities persistence (currently localStorage). **(BUILD)**
6. Courses marketplace backend. **(BUILD)**
7. Real image S3 upload (replaces base64/localStorage). **(P2-2)**
8. Enforce CSP (currently Report-Only) + RLS audit on `/center`. **(P2-3/P2-4)**
9. Remove root CRA scaffold + legacy localStorage demo surfaces from production path. **(DEPRECATE)**
10. Full marketplace search/filter backend for `/search` (currently "not connected"). **(P1-later)**
