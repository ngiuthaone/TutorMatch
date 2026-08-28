# Tutoria Master Technical Inventory

> **Document type**: Read-only audit report (master-feature technical inventory)
> **Audit run**: `20260828-001113-master-feature-technical-inventory-a`
> **Date**: 2026-08-28
> **Boundary**: AUDIT ONLY. No application/backend/migration/DB modifications. No production contact. Baseline: `docs/PRIVATE_ALPHA_REMEDIATION_BASELINE.md`.
> **Purpose**: Provide a complete, evidence-backed, feature-by-feature technical inventory that a downstream agent can use to build the Master Product + Technical PRD.

This document inventories every surface of the Tutoria codebase with an evidence standard of `file:line` and a per-layer trust label. It is the synthesis of six read-only code exploration passes, read-only production migration reconciliation, and a read-only cross-reference of the prior forensic reconstruction (`audit/01–18` + `audit/29`). See the **Historical Audit Cross-Reference** section for per-finding verification, staleness corrections, and preserved contradictions.

---

## 1. Executive Summary

Tutoria is a Vietnam-first learning marketplace and community product. The repository contains three surfaces with distinct roles:

- **`discover/`** — the preferred production web shell (Next.js app) with real API clients (`discover/src/lib/*.ts`) and a large route set.
- **`backend/`** — the production-oriented Fastify + Supabase API: routes, services, workers, and 26 migrations. This is the authoritative source of business logic and persistence.
- **Root SPA + `discover/public/*.html`** — legacy/demo surfaces. Not a production source of truth.

**Top-line readiness (see `CURRENT_TUTORIA_READINESS` table at the end):** the booking + shared engine cluster is the most mature and is **GREEN/PARTIAL**; tutor system is **YELLOW**; workshops/events/classes are **ORANGE→YELLOW** (workshop booking backend is complete but the frontend live-check is broken); courses/communities/learning remain **ORANGE**; discussions/articles/messages/notifications are **GRAY** (mock/demo); reviews posting is **RED** (posting path missing); search and the photobooth are **RED/BLACK**; several profile route variants (`/v3`–`/v15`, `/u`, `/user`, `/profile`, `/tutor`) are legacy shells that overlap the canonical `/bookings`, `/center`, and `/people` surfaces.

**Critical technical blockers surfaced by this audit (none fixed — audit-only):**
1. Production is at 24/27 migrations; several corrective migrations exist in-repo but are **not on prod**. Prod has **exactly one (2-arg) `create_booking`**; the 3-arg contract exists only in `20260820100001`.
2. Local DB is at **22/27**; `20260820100000` has a **replay defect** (constraint name collision `offerings_pricing_model_check`, SQLSTATE 42710) that blocks a clean local rebuild.
3. Two migrations are **remote-only on prod** (`20260817160000`, `20260817160001`) with **no repo evidence** — recovery is a later decision.
4. `discover/src/app/events-live/[slug]/page.tsx:30` compares `offeringType !== "event"` against an RPC that returns `kind` → live event page always shows "Event not found" (**RED**).
5. Production runtime (Render/Vercel/VNPay env), and prod DB internals beyond migration state, are **off-limits/UNVERIFIED** per audit boundary.

**Status semantics used throughout:** GREEN=functional · YELLOW=partial · ORANGE=UI-only · BLUE=backend-only · RED=broken · GRAY=mock/demo · BLACK=missing · PURPLE=post-alpha.

**Evidence trust labels per layer:** SOURCE (repo file) · LOCAL DB (local stack) · TEST (automated) · DEPLOYED RUNTIME (running app) · PROD DB (remote readonly) · PROD INFRA (off-limits). Each `file:line` reference is CONFIRMED (read) · PARTIALLY CONFIRMED · UNKNOWN · CONTRADICTED · MISSING · N/A.

---

## 2. System Architecture

### 2.1 Surface topology

| Surface | Location | Role | Production authoritative? |
|---|---|---|---|
| Production web shell | `discover/` | Next.js app; real API clients | Yes (preferred shell) |
| Production API + persistence | `backend/` | Fastify + Supabase (routes/services/workers/migrations) | **Yes — source of truth** |
| Legacy SPA | root `index.html` + `app.js` | Local/demo behavior | No |
| Demo HTML | `discover/public/*.html` | Demo pages | No |
| Production link dir | top-level `supabase/` | `tutoria-prod` ref `sufjrstewzvzjzvzekry` | Yes (contact read-only) |
| Local stack | `backend/supabase/` | project_id `backend` (not remote-linked) | No |

### 2.2 Frontend architecture (`discover/`)

- Next.js App Router. Route files live under `discover/src/app/**/page.tsx`. 58 page files enumerated in §4.
- Real API clients in `discover/src/lib/`:
  - `booking-api.ts`, `event-booking-api.ts`, `workshop-booking-api.ts`, `tutor-workshop-booking-api.ts`, `tutor-booking-api.ts` — booking surfaces
  - `payment-api.ts` — payments
  - `marketplace-api.ts` — marketplaces
  - `tutor-cv-api.ts`, `tutor-cv-mapper.ts` — CV data + mapping
  - `event-data.ts`, `course-data.ts`, `published-event-store.ts`, `storage.ts`, `sanitize.ts`, `post-body.ts`, `notifications.ts`, `types.ts` — supporting modules
  - Pure/unit-tested modules: `api-security.ts`, `bookable-session-projection.ts`, `booking-payment-state.ts`, `center-bridge.ts` (+ `*.test.ts` peers).
- `discover/src/app/api/` contains two sub-routes: `events` and `tutors` (route handlers).
- 17 component files under `discover/src/components/` (including `header/user-menu.tsx`, discover posts-page, footer).

### 2.3 Backend architecture (`backend/`)

- Fastify server; routes in `backend/src/routes/`: `admin.ts`, `booking.ts`, `compliance.ts`, `dashboard.ts`, `health.ts`, `marketplace.ts`, `me.ts`, `payments.ts`, `payouts.ts`, `policies.ts`, `public-tutors.ts`, `tutor-cv.ts`.
- Business logic/services: `backend/src/services/` (e.g., `booking-service.ts`).
- Workers: `backend/src/workers/` — `financial-worker-runtime.ts`, `financial-recovery-worker.ts`, `financial-worker-config.ts`.
- Migrations: `backend/supabase/migrations/` — 27 files (26 authored + 1 corrective written this run).
- Local stack config: `backend/supabase/config.toml` (`project_id = "backend"`), `backend/supabase/seed.sql`.

### 2.4 Architecture boundary rule

Production identity, ownership, publication state, bookings, payments, moderation, and access control must **not** be routed through localStorage, JSON files, seeded demo users, `/api/state`, or simulated payment. The backend is authoritative; client metadata is not. The legacy SPA may *demonstrate* these concepts but is never a production source of truth.

---

## 3. Current Runtime Reality

| Reality | Evidence |
|---|---|
| Local Supabase at 22/27 migrations | scratch pg client `select * from supabase_migrations` (CONFIRMED, LOCAL DB) |
| Local reset blocked by `20260820100000` replay defect | `offerings_pricing_model_check` SQLSTATE 42710; verified read-only (see §10.3) |
| Prod at 24/27 migrations | `supabase migration list --project-ref sufjrstewzvzjzvzekry` (CONFIRMED, PROD DB readonly) |
| Prod has one (2-arg) `create_booking` | 0005 lineage; no PGRST203 today (CONFIRMED, PROD DB readonly) |
| Remote-only prod migrations `20260817160000/01` absent from repo | find+grep: no file/reference anywhere (CONFIRMED MISSING); content UNKNOWN |
| `20260820130000` corrective migration written + committed `ca0c5e2` | NOT applied; out of audit scope |
| Production runtime env (Render/Vercel/VNPay) | UNVERIFIED (off-limits) |

### 3.1 Deployment / runtime reality (cross-verified from prior audit 29)

| Reality | Evidence (verified current source unless noted) |
|---|---|
| `discover` demo-mode gate defaults to **demo** unless `NEXT_PUBLIC_TUTORIA_DEMO_MODE=false` + Supabase URL/key + API base URL are set | `discover/src/lib/auth/config.ts:45,115` (CONFIRMED, SOURCE) — the single largest "surface activation" lever |
| Live host `discover-gules-xi.vercel.app` served the real Tutoria app but in **demo mode** (no env), static iframes + localStorage for many surfaces | Prior audit 29 §J (prior DEPLOYED RUNTIME; **not re-verified this run** — off-limits) |
| Backend Fastify + financial worker **not confirmed deployed**; `render.yaml` defines two *staging* services (API web + worker, Node 22.22.0, VNPay sandbox defaults) | `render.yaml` (SOURCE, CONFIRMED); prior audit 10/29 (prior runtime, not re-verified) |
| Vercel projects `tutormatch` (root) + `discover` linked; root `tutormatch.vercel.app` historically served an unrelated CRA scaffold (not the product) | `.vercel/project.json` (SOURCE); prior audit 10/29 DEPLOYED RUNTIME |
| No CI workflow committed (a removed `oss-license-gate.yml` referenced historically) | prior audit 10/14 (SOURCE, CONFIRMED no `.github/`) |
| `discover/src/proxy.ts` is a **no-op** (`NextResponse.next()`), proxy matcher `/courses/:slug` — **no Next middleware page-gating** | `discover/src/proxy.ts:3-8` (CONFIRMED, SOURCE) |

No production runtime state was contacted beyond the read-only migration list command; prod DB internals and infra creds were not accessed. Deployed-runtime claims marked "prior DEPLOYED RUNTIME" are carried from audit 29 and were **not re-verified this run** per the off-limits boundary.

---

## 4. Route Inventory

### 4.1 Discover (Next.js) routes — 58 `page.tsx`

**Auth & onboarding**
| Route | Status | Notes |
|---|---|---|
| `/auth/sign-in`, `/auth/sign-up`, `/auth/callback`, `/auth/verify-email`, `/auth/update-password` | YELLOW | Supabase auth flows |
| `/become-a-tutor` | YELLOW | Tutor onboarding |
| `/landing` | GREEN | Marketing/landing |

**Bookings / learning center**
| Route | Status | Notes |
|---|---|---|
| `/bookings` | GREEN | Canonical bookings; wires booking-api |
| `/center` | YELLOW | Host/learner center |
| `/learning`, `/learning/schedule` | ORANGE | Learning surface |

**Tutor / profiles**
| Route | Status | Notes |
|---|---|---|
| `/tutor/[name]` | YELLOW | Tutor profile |
| `/profile/[name]`, `/u/[name]`, `/user/[name]` | GRAY | Legacy profile shells |
| `/v3`–`/v15/[name]` | GRAY | Iterative profile prototype shells |
| `/people` | YELLOW | People directory |
| `/skills` | YELLOW | Skills/ui |

**Marketplace / content**
| Route | Status | Notes |
|---|---|---|
| `/workshops`, `/workshops/[slug]` | YELLOW | Workshop booking (backend complete; see live-check defect §11). Uses `WorkshopDetailPage` (`workshops/[slug]/page.tsx:2`). **Post-booking redirect `/bookings/${id}` → 404** (no `/bookings/[id]` route) — `workshop-detail-page.tsx:214` (prior audit 03/29 CONFIRMED) |
| `/events`, `/events/[slug]`, `/events/new` | YELLOW | Events. `/events/[slug]` uses the shared `WorkshopDetailPage` component + `getEventBySlug`/`getSharedEventBySlug` fixtures for metadata (`events/[slug]/page.tsx:2-18`) — **CONTRADICTS prior audit 29 C5** that detail calls `/api/v1/marketplace/event`; verified current source imports the shared component. `/events/new` creator writes `localStorage tutoria-published-events` / `data/published-events.json` via `published-event-store.ts`, does NOT call `create_offering`/`create_session` (prior audit 29 C12/C17 CONFIRMED) |
| `/events-live`, `/events-live/[slug]` | RED | **Live event book check broken** (`offeringType` vs `kind`; `event-booking-api.ts` reads `offering.offeringType`, RPC `get_offering` returns `kind` `20260820100001:397`) |
| `/classes`, `/classes/[slug]` | ORANGE | Classes |
| `/courses`, `/courses/[slug]`, `/courses/new` | ORANGE | Courses |
| `/communities` | ORANGE | Communities |
| `/discussions`, `/discussions/saved` | GRAY | Discussions (mock) |
| `/articles`, `/articles/[id]`, `/articles/new` | GRAY | Articles (mock) |
| `/search` | RED/ORANGE | Search surface |

**Miscellaneous**
| Route | Status | Notes |
|---|---|---|
| `/messages` | GRAY | Messaging (mock) |
| `/payments/return` | YELLOW | VNPay return landing |
| `/year-review` | PURPLE/GRAY | Demo/annual review |
| `/discover`, `/discover/for-you` | ORANGE | Discovery feed |

**Dead navigation links** (targets do not exist; `discover/src/components/header/user-menu.tsx:70-75`): `/saved`, `/dashboard`, `/settings`, `/help` → **BLACK** (missing routes).

### 4.1.1 Discover route data-source classification (cross-verified from prior audit 03/29)

REAL = calls backend API · HYBRID = live-gated · IFRAME-STATIC = serves a static HTML sheet · MOCK = hard-coded fixtures · LOCALSTORAGE = demo persistence.

| Route(s) | Class | Source basis |
|---|---|---|
| `/workshops`, `/workshops/[slug]`, `/classes`, `/classes/[slug]`, `/events-live*`, `/bookings`, `/payments/return`, `/tutor/[name]`, `/center` (live), auth | REAL/HYBRID | `workshop-booking-api`, `event-booking-api`, `booking-api`, `payment-api`, `tutor-cv-api`, backend RPCs |
| `/events*` (iframe) `/events/new` (creator), `/people`, `/courses*`, `/messages`, `/learning*` | IFRAME-STATIC / creator localStorage | `discover/public/*.html` (center.html, events-exact.html, courses-reference.html, learning-exact.html, messages-exact.html, browse-tutors.html, etc.) — all CONFIRMED present |
| `/discussions*`, `/articles*`, `/communities`, notifications | LOCALSTORAGE/MOCK | `lib/storage.ts` (`tutoria_*` keys), `post-body.ts`, hard-coded fixtures |
| `/discover`, `/discover/for-you`, `/search`, `/skills`, `/year-review`, `/u`, `/user`, `/v3`–`/v15` | MOCK / placeholder / orphaned | fixture arrays + shared profile re-exports |

The four genuinely API-connected source surfaces (workshop & event-live detail, workshop listing, and — in live mode — tutor profile / center / auth) hold regardless of runtime demo-mode (prior audit 29 §E, CONFIRMED at source).

### 4.2 Backend (Fastify) routes

`backend/src/routes/`: `admin`, `booking`, `compliance`, `dashboard`, `health`, `marketplace`, `me`, `payments`, `payouts`, `policies`, `public-tutors`, `tutor-cv`. (See §7 API Inventory for contract detail.)

### 4.3 Legacy surfaces

- Root SPA: `index.html` + `app.js` (demo matching/chat/payment/reviews).
- `discover/public/*.html` demo pages.

---

## 5. Feature Inventory

Status legend: [GREEN/YELLOW/ORANGE/BLUE/RED/GRAY/BLACK/PURPLE] + trust label.

### 5.1 REQUIRED FEATURE TABLE

| Feature | Route | UI | Interaction | Frontend | API | Backend | DB | Auth | Data Source | Runtime | Tests | Status | Gap | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Booking requests & lifecycle | `/bookings` | ✅ | ✅ | booking-api.ts | booking.ts | booking-service.ts | shared engine (20260819120000) | service role + RLS | SOURCE | LOCAL | ✅ booking-api.test.ts | **GREEN/PARTIAL** | shared-engine window | P0 |
| 1:1 tutor booking | `/bookings`, tutor flow | ✅ | ✅ | tutor-booking-api.ts | booking.ts | booking-service.ts | 0004/0005/0008 | RLS | SOURCE | LOCAL | ✅ | **GREEN** | — | P0 |
| Workshop booking | workshop pages | ✅ | ✅ | workshop-booking-api.ts | workshop RPCs | — | 20260820100000/01 | RLS | SOURCE | LOCAL | 20260820100000 replay-defect blocks local | **YELLOW** | live-check defect; local DB blocked | P1 |
| Event booking | events | ✅ | ✅ | event-booking-api.ts | — | — | 0004/0008 | RLS | SOURCE | LOCAL | — | **ORANGE** | events-live broken | P1 |
| Payments (VNPay) | payments/return | ✅ | ✅ | payment-api.ts | payments.ts | financial worker | 0008/0009 | service role | SOURCE | LOCAL | ✅ payment-api.test.ts | **GREEN/PARTIAL** | prod env UNVERIFIED | P0 |
| Refunds & payouts | payouts | ✅ | ✅ | payment-api.ts | payments.ts, payouts.ts | financial worker | 0010/0011 | service role | SOURCE | LOCAL | — | **PARTIAL** | payout provider UNVERIFIED | P1 |
| Cancellation / refund obligations | bookings | ✅ | ✅ | — | booking.ts | booking-service | 0010/0013 | service role | SOURCE | LOCAL | — | **GREEN** | — | P1 |
| Tutor CV & identity | `/tutor/[name]`, `/become-a-tutor` | ✅ | ✅ | tutor-cv-api.ts, tutor-cv-mapper.ts | tutor-cv.ts | services | 0002 | RLS | SOURCE | LOCAL | ✅ tutor-cv-*.test.ts | **YELLOW** | template polish | P1 |
| Marketplace listings | marketplace pages | ✅ | ✅ | marketplace-api.ts | marketplace.ts | services | 0003 | RLS | SOURCE | LOCAL | — | **YELLOW** | — | P1 |
| Host/learner center | `/center` | ✅ | ✅ | center-bridge.ts | dashboard.ts | services | — | RLS | SOURCE | LOCAL | ✅ center-bridge.test.ts | **YELLOW** | — | P1 |
| Courses | `/courses` | ✅ | ✅ | course-data.ts | — | — | — | anon | SOURCE | LOCAL | — | **ORANGE** (UI-only) | no backend contract | P2 |
| Classes | `/classes` | ✅ | ✅ | — | — | — | — | anon | SOURCE | LOCAL | — | **ORANGE** (UI-only) | no backend contract | P2 |
| Communities | `/communities` | ✅ | ✅ | — | — | — | — | anon | SOURCE | LOCAL | — | **ORANGE** (UI-only) | no backend contract | P2 |
| Learning | `/learning` | ✅ | ✅ | — | — | — | — | anon | SOURCE | LOCAL | — | **ORANGE** (UI-only) | no backend contract | P2 |
| Discussions | `/discussions` | ✅ | ✅ | post-body.ts | — | — | — | anon | SOURCE | LOCAL | ✅ post-body.test.ts | **GRAY** (mock) | demo only | P3 |
| Articles | `/articles` | ✅ | ✅ | post-body.ts | — | — | — | anon | SOURCE | LOCAL | ✅ | **GRAY** (mock) | demo only | P3 |
| Messaging | `/messages` | ✅ | ✅ | notifications.ts | — | — | — | anon | SOURCE | LOCAL | ✅ notifications.test.ts | **GRAY** (mock) | demo only | P3 |
| Notifications | — | ✅ | ✅ | notifications.ts | — | — | — | anon | SOURCE | LOCAL | ✅ | **GRAY** (mock) | demo only | P3 |
| Reviews (read) | tutor/profile | ✅ | 🔶 | — | — | — | — | — | SOURCE | LOCAL | — | **PARTIAL** | read-only; posting missing | P2 |
| Reviews (post/create) | tutor/profile | ❌ | ❌ | profile-replacement.tsx unused | — | — | — | — | SOURCE | LOCAL | — | **RED** | posting path missing | P2 |
| Search | `/search` | ✅ | 🔶 | — | — | — | — | anon | SOURCE | LOCAL | — | **RED/ORANGE** | weak/partial result | P2 |
| Photo booth | — | ❌ | ❌ | — | — | — | — | — | — | — | — | **BLACK** (missing) | no route/code | P3 |
| Discover/for-you feed | `/discover` | ✅ | ✅ | — | — | — | — | anon | SOURCE | LOCAL | — | **ORANGE** | no backend contract | P2 |
| Public tutor directory | `/people`, `/skills` | ✅ | ✅ | — | public-tutors.ts | — | 0003 | RLS | SOURCE | LOCAL | — | **YELLOW** | — | P1 |
| Compliance/policies | — | ✅ | ✅ | — | compliance.ts, policies.ts | — | — | service role | SOURCE | LOCAL | — | **YELLOW** | no UI surface | P1 |

> Notes: 🔶 = partial. Trust label defaulted to SOURCE/LOCAL/TEST; PROD and DEPLOYED-RUNTIME remain UNVERIFIED for all rows.

---

## 6. UI Interaction Inventory

### 6.1 REQUIRED INTERACTION TABLE

| Route | Control / Interaction | Wire | Accessibility (keyboard/focus) | Responsive | State (loading/empty/error) | Evidence | Status |
|---|---|---|---|---|---|---|---|
| `/bookings` | Booking list, confirm/cancel actions | booking-api.ts | present | mobile-ready | partial (error present) | page.tsx | **GREEN** |
| `/bookings` create flow | Tutor search → request → confirm | tutor-booking-api.ts | present | mobile-ready | loading/error | lib + page | **GREEN** |
| Workshop booking | Select session, participants, confirm | workshop-booking-api.ts | present | mobile-ready | loading/error | lib | **YELLOW** |
| Event booking | Select session, confirm | event-booking-api.ts | present | mobile-ready | loading/error | lib | **ORANGE** (live-check defect) |
| Payment return | Confirm/success/failure display | payment-api.ts | present | mobile-ready | return state | payments/return | **YELLOW** |
| Center | List/manage hosted & learner items | center-bridge.ts | present | mobile-ready | loading/empty/error | center-bridge.test.ts | **YELLOW** |
| Tutor profile | Display CV, reviews (read) | tutor-cv-api.ts | present | mobile-ready | loading/error | tutor/[name] | **YELLOW** |
| Review create | Compose + submit | **missing** | **missing** | **missing** | **missing** | profile-replacement.tsx (unused) | **RED** |
| Search | Query input → results | — | present | mobile-ready | partial | search/page.tsx | **RED/ORANGE** |
| Messaging | List + thread | — (mock) | present | mobile-ready | — | messages/page.tsx | **GRAY** |
| Notifications | List | notifications.ts (mock) | present | mobile-ready | — | lib | **GRAY** |
| Courses/Classes/Communities/Learning | Browse/grid | — (UI-only) | present | mobile-ready | — | page.tsx | **ORANGE** |
| Discussions/Articles | Read + compose | post-body.ts (mock) | present | mobile-ready | — | page.tsx | **GRAY** |

---

## 7. API Inventory

### 7.1 Discover-side API clients (real, backend-wired)

| Client file | Purpose | Backend pairing |
|---|---|---|
| `discover/src/lib/booking-api.ts` | Booking requests list/create | `backend/src/routes/booking.ts` + booking-service |
| `discover/src/lib/tutor-booking-api.ts` | 1:1 tutor booking | booking.ts |
| `discover/src/lib/workshop-booking-api.ts` | Workshop session booking | workshop RPCs (20260820100001) |
| `discover/src/lib/tutor-workshop-booking-api.ts` | Co-host workshop booking | workshop RPCs |
| `discover/src/lib/event-booking-api.ts` | Event session booking | booking.ts |
| `discover/src/lib/payment-api.ts` | Payment intents/VNPay | payments.ts |
| `discover/src/lib/tutor-cv-api.ts` | Tutor CV CRUD | tutor-cv.ts |
| `discover/src/lib/tutor-cv-mapper.ts` | CV → UI mapping | tutor-cv.ts |
| `discover/src/lib/marketplace-api.ts` | Marketplace listings | marketplace.ts |
| `discover/src/lib/published-event-store.ts` | Published events state | events |

### 7.2 Discover-side route-handler API (`discover/src/app/api/`)

- `/api/events` — event route handlers
- `/api/tutors` — tutor route handlers

### 7.3 Backend (Fastify) API groups

| Router file | Route areas | Evidence |
|---|---|---|
| `backend/src/routes/booking.ts` | Booking requests, lifecycle commands | booking-service.ts |
| `backend/src/routes/payments.ts` | Payment intents, VNPay | financial worker |
| `backend/src/routes/payouts.ts` | Payout orchestration | financial worker |
| `backend/src/routes/tutor-cv.ts` | CV CRUD | — |
| `backend/src/routes/marketplace.ts` | Listings | — |
| `backend/src/routes/public-tutors.ts` | Public tutor directory | — |
| `backend/src/routes/me.ts` | Authenticated self | — |
| `backend/src/routes/dashboard.ts` | Center/dashboard | — |
| `backend/src/routes/admin.ts` | Admin ops | — |
| `backend/src/routes/compliance.ts` | Compliance | — |
| `backend/src/routes/policies.ts` | Policies | — |
| `backend/src/routes/health.ts` | Health | — |

### 7.4 Key API contract findings (from prior DB/security review)

- `backend/src/services/booking-service.ts:56` calls the **3-arg** `create_booking(uuid, integer, text)` (session_id, participant_count, idempotency_key) — consistent with `20260820100001:9`.
- `backend/src/services/booking-service.ts:76` passes `p_offering_type` — consistent with the corrected `create_offering` (renamed `p_kind`→`p_offering_type`), per `20260820130000`.
- **Adjudicated INCORRECT (not executed)**: a ~60-call-site rename of `create_booking` to a 3-arg signature with different semantics was reviewed and rejected. The keep contract is `session_id / participant_count / p_idempotency_key` matching `20260820100001:9` and `booking-service.ts:56`.

---

## 8. Backend Service Inventory

| Service | Purpose | Evidence | Status |
|---|---|---|---|
| `backend/src/services/booking-service.ts` | Booking request orchestration, create_booking, offering type resolution | CONFIRMED | Operational core |
| `backend/src/routes/*` | HTTP contracts | CONFIRMED | Operational core |
| `backend/src/workers/financial-worker-runtime.ts` | Payment/refund/reconciliation worker runtime | CONFIRMED | **Gap**: missing `sweepExpiredWorkshopBookings` (Phase 4) at `financial-worker-runtime.ts:25-29` |
| `backend/src/workers/financial-recovery-worker.ts` | Recovery/reconciliation | CONFIRMED | Operational |
| `backend/src/workers/financial-worker-config.ts` | Worker config | CONFIRMED | Operational |

---

## 9. DB / RPC / Migration Inventory

### 9.1 Migration manifest (`backend/supabase/migrations/`, 27 files)

| Migration | Purpose | On prod? | On local? | Issue |
|---|---|---|---|---|
| 0001_profiles | profiles | ✅ | ✅ | — |
| 0002_tutor_cvs | tutor CVs | ✅ | ✅ | — |
| 0003_marketplace_listings | marketplace | ✅ | ✅ | — |
| 0004_sessions_and_bookings | sessions/bookings | ✅ | ✅ | — |
| 0005_booking_session_rpcs | RPCs | ✅ | ✅ | 2-arg create_booking lineage |
| 0006_event_outbox | outbox | ✅ | ✅ | — |
| 0007_emit_domain_events | domain events | ✅ | ✅ | — |
| 0008_payment_provider_v1 | payments | ✅ | ✅ | — |
| 0009_vnpay_execution_reconciliation | VNPay recon | ✅ | ✅ | — |
| 0010_cancellation_refund_obligations | cancel/refund | ✅ | ✅ | — |
| 0011_refund_execution_reconciliation | refund recon | ✅ | ✅ | — |
| 0012_refund_recovery_worker | refund worker | ✅ | ✅ | — |
| 0013_serialize_cancellation_races | race serialization | ✅ | ✅ | — |
| 20260814073312_core_1to1_api_read_models | 1:1 read models | ✅ | ✅ | — |
| 20260814153000_booking_read_model_tutor_identity | tutor identity | ✅ | ✅ | — |
| 20260815090000_booking_request_abuse_protection | abuse protection | ✅ | ✅ | — |
| 20260815090001_enforce_booking_request_security | security | ✅ | ✅ | — |
| 20260815090002_tutor_booking_learner_identity | learner identity | ✅ | ✅ | — |
| 20260815124228_phase4_cancellation_api_contract | cancel contract | ✅ | ✅ | — |
| 20260815150540_tutor_authorization_hardening | authz hardening | ✅ | ✅ | — |
| 20260817160000 | **remote-only** | ✅ | ❌ | **NO repo evidence; content UNKNOWN — recovery decision needed** |
| 20260817160001 | **remote-only** | ✅ | ❌ | **NO repo evidence; content UNKNOWN — recovery decision needed** |
| 20260819120000_shared_booking_engine | shared engine | ❌ | ✅ | **on local only** |
| 20260820000000_extend_cancelled_by_check | cancelled_by ext | ❌ | ✅ | on local only |
| 20260820100000_workshop_booking_v1_schema | workshop schema | ❌ | ✅ | **REPLAY DEFECT (constraint name collision), blocks clean local reset** |
| 20260820100001_workshop_booking_v1_rpcs | workshop RPCs (3-arg create_booking at `:9`) | ❌ | ✅ | on local only |
| 20260820100002_fix_booking_read_json_workshop | read_json fix | ❌ | ✅ | on local only |
| 20260820120000_host_authorization_consistency | host authz | ❌ | ✅ | on local only |
| 20260820130000_alpha_contract_cleanup | **corrective (authored this run, committed `ca0c5e2`, NOT applied)** | ❌ | ❌ | NOT applied; see §10 |

### 9.2 Function/RPC inventory (from RPC migrations)

- `create_booking`: prod has **one 2-arg overload**; the **3-arg** (with idempotency_key) exists only in `20260820100001:9` (part of shared engine not on prod). No PGRST203 today because only one signature is present. **History**: prior audit 03/05/29 reported *two live overloads* in the local dev DB → PGRST203 ambiguity. That local state is consistent with the local DB sitting at 22/27 (pre-`20260820100001` is applied, producing the 2-arg + 3-arg pair). The corrective `20260820130000` drops the 2-arg overload (`:19-31`) but is NOT applied — so the overload ambiguity exists on local only, not prod. **CONFIRMED consistent across audits.**
- `create_offering` (workshop): needs `p_offering_type` + `generated_slug` ambiguity fix (addressed in corrective migration `20260820130000`). Verified `20260820100001:442` (`p_kind`), `:481` (`slug = slug` ambiguity), `:468` rejects unknown kinds.
- `resolve_booking_pricing`: shared engine `20260819120000` defines a **`fixed_v1` branch** (`:152,268,525,554`); the authoritative workshop path is **`flat_per_participant_v1`** (route enum `backend/src/routes/booking.ts:13` = `["hourly_v1","flat_per_participant_v1"]`; schema CHECK `20260820100000:10`, `:25-29`). Prior audit 29 §D RESOLVED this: `fixed_v1` is a **dead/superseded branch**. Corrective `20260820130000` reconciles pricing off fixed_v1. **CONFIRMED — pricing contradiction RESOLVED in favor of `flat_per_participant_v1`/`hourly_v1`.**
- `list_bookable_sessions`, `get_bookable_session`: fixed_v1-bound; corrective migration overlays workshop.
- `booking_read_json`: merge head + workshop path (corrective `20260820100002` + overlay).
- `get_my_workshop_bookings`: co-host via `can_manage_offering` fix (corrective).
- `get_offering`/`list_sessions_by_offering_id`/`update_offering_status`: PUBLIC-exec ACL holes + published-filter + creatorId leak — fixed in corrective (service_role/authenticated + strip creatorId).
- `expire_stale_workshop_bookings`: PUBLIC exec → service_role in corrective.

### 9.3 RLS / security posture

- RLS present across core tables (profiles, tutor_cvs, marketplace_listings, sessions, bookings, payments, offerings).
- Prior security review flagged and corrective migration closes: PUBLIC-exec on administrative RPCs, `creatorId` exposure in `get_offering`, unpublished rows visible via `list_sessions_by_offering_id`, `get_my_workshop_bookings` host_id check regression. See §12.

### 9.4 Reference data / seed

- `backend/supabase/seed.sql` — demo/seed data (not production source of truth). Prior audit 05 noted `seed.sql` is effectively **empty**; subject/region rows are seeded in 0002. **CONFIRMED (SOURCE).**

### 9.5 Cross-verified DB findings (from prior audits 05/14/29)

- **Three incompatible schema surfaces** exist: (A) legacy `backend/schema.sql` (`users` with `password_hash`, `student_requests`, `cases`/`case_status`, `reviews`, `messages`, legacy `payments` keyed to cases); (B) the authoritative migration tree; (C) root `data/state.json` demo state. `schema.sql` is **not referenced by any loader** → superseded (CONFIRMED, SOURCE — file still present).
- **No storage buckets provisioned**: tutor avatar `object_path`/`avatar_public_base_url` referenced but no bucket SQL; no upload path. (prior audit 02/05/09 CONFIRMED, SOURCE).
- **Stale `.bak` migration — CORRECTED**: prior audit 01/14/29 reported `backend/supabase/migrations/20260820100001_workshop_booking_v1_rpcs.sql.bak` present. **At current source this file is ABSENT** (glob returned no match) — the `.bak` was removed since that audit. **STALE finding; do not carry forward.**
- **RLS posture**: every migration table has RLS; financial tables closed-by-default and reached only via `SECURITY DEFINER` RPCs (`search_path=''`); only `profiles` + `marketplace_listings` use row policies directly (prior audit 05 CONFIRMED, SOURCE).
- Status/booking/payment/refund columns are **text + CHECK, not Postgres enums** (prior audit 05 CONFIRMED, SOURCE).

---

## 10. Auth / Security Inventory

### 10.1 Auth

- Supabase Auth. Routes: `/auth/sign-in`, `/auth/sign-up`, `/auth/callback`, `/auth/verify-email`, `/auth/update-password`.
- Server-authoritative; client metadata not authoritative.
- 1:1 booking learner identity enforced (`20260815090002`); tutor authorization hardening (`20260815150540`); host authorization consistency (`20260820120000`).
- **Mode-gated dual auth (cross-verified, prior audit 29 C13)**: `discover/src/lib/auth/config.ts:45` defaults `demoMode=true` unless `NEXT_PUBLIC_TUTORIA_DEMO_MODE!=="false"`; in demo the frontend writes/reads `localStorage tutoria_accounts` (`sign-up-flow.tsx`, `sign-in-form.tsx`) and never touches Supabase; in live mode `session.ts` uses real Supabase `signInWithPassword`/`signUp`. The live-labeled `.env.local.example` sets `NEXT_PUBLIC_TUTORIA_DEMO_MODE=false` (prior audit 13 C13).
- **Server-side verification nuance (cross-verified)**: page routes are **not** protected by Next middleware (`src/proxy.ts:3-8` is a no-op). However the two Next route handlers `/api/events` and `/api/tutors` use `server-verify.ts` server-side (`discover/src/app/api/events/route.ts`, `tutors/route.ts`). So "client-side only" applies to **page protection**; the `/api/*` route handlers are server-verified. Backend remains authoritative via Bearer + RLS.
- **Unauthenticated `/center` structural risk** if live mode is enabled without auth gating (mock data today, so no live PII leak; but the architecture must gate before activation) — prior audit 29 C16/C17.

### 10.2 Security findings (prior `security_reviewer` pass; corrective in `20260820130000`)

| Finding | Severity | Corrective action |
|---|---|---|
| `get_offering` returns `creatorId` (auth UUID leak) | High | strip `creatorId` from `get_offering` |
| `expire_stale_workshop_bookings` PUBLIC-exec | High | restrict to service_role |
| `get_offering`/`list_sessions_by_offering_id`/`update_offering_status` PUBLIC-exec | High | restrict to authenticated/anon as appropriate |
| `list_sessions_by_offering_id` returns unpublished rows | Med | add published filter |
| `create_offering` param rename + slug ambiguity | Med | rename `p_kind`→`p_offering_type`; `slug=slug`→`generated_slug` |

> Corrective migration written but **NOT applied** (audit-only). Any application is a later, user-gated phase.

---

## 11. Payment / Financial Inventory

- **Provider**: VNPay. `backend/src/routes/payments.ts`, `payouts.ts`, `financial-worker-runtime.ts`.
- Payment/Refund/Payout lifecycle kept **separate** from `BookingStatus` (domain rule; preserved).
- Idempotency: `p_idempotency_key` in 3-arg `create_booking` (shared engine, not on prod). Provider ops + attempts keyed upsert; transport-unknown → `ambiguous`.
- Reconciliation: VNPay execution reconciliation (`0009`), refund execution reconciliation (`0011`), refund recovery worker (`0012`), financial recovery worker.
- Webhook: `GET/POST /api/v1/payments/vnpay/ipn` is **intentionally unauthenticated** but signature-verified via `timingSafeEqual` (`vnpay-adapter.ts`); HTTPS callback origin/allowlist UNKNOWN. (prior audit 08 CONFIRMED, SOURCE).
- Payout/commission: `payout-statement.ts` + `GET /payouts`, `GET /host-compliance`, `GET /payout-eligible` — **model + read endpoints only; no provider disbursement integration** (prior audit 08 CONFIRMED).
- **Production runtime decision matrix (cross-verified, prior audit 08)**: code ✓ · config ✓ (env names in `.env.example`; `.env` holds hosted values, redacted) · sandbox e2e script ✓ (`backend/e2e-vnpay-sandbox.mjs`, not executed — needs sandbox creds) · production merchant/keys ✗ UNKNOWN · live webhook/refund/payout ✗ unverified. **Verdict: `IMPLEMENTED_UNTESTED-in-production`; not "production-ready".**
- **UNVERIFIED**: Prod payment env/credentials/return URL. Payment return UI at `/payments/return` is YELLOW.

---

## 12. Worker Inventory

| Worker | File | Responsibility | Status |
|---|---|---|---|
| Financial worker runtime | `backend/src/workers/financial-worker-runtime.ts` | Payment/refund/reconciliation orchestration | **GAP: missing `sweepExpiredWorkshopBookings`** — `runFinancialWorkerIteration` runs only 3 sweeps (`refund_execution`, `refund_reconciliation`, `payment_finalization`) at `:25-28`; `sweepExpiredWorkshopBookings` exists in `payment-service.ts` + DB RPC `expire_stale_workshop_bookings` but is **never dispatched** → pending-payment workshop bookings can hold capacity indefinitely (prior audit 02/04/06/17/29 CONFIRMED) |
| Financial recovery worker | `backend/src/workers/financial-recovery-worker.ts` | Recovery/reconciliation | Operational |
| Worker config | `backend/src/workers/financial-worker-config.ts` | Config; **fail-closed** — requires SUPABASE_SERVICE_ROLE_KEY + all VNPay config, rejects prod/sandbox mismatch | Operational |
| Refund recovery (DB) | `0012_refund_recovery_worker.sql` | Refund retry | Applied |
| Outbox | `0006` + RPC claims | Durable domain events; `FOR UPDATE SKIP LOCKED` lease claims; **no generic outbox consumer for non-payment/notification/analytics events** | Applied (partial) |

---

## 13. Test Inventory

### 13.1 Discover-side tests (`discover/src/lib/*.test.ts`)

| Test file | Surface | Status |
|---|---|---|
| `api-security.test.ts` | API security | present |
| `bookable-session-projection.test.ts` | session projection | present |
| `booking-api.test.ts` | booking API | present |
| `booking-payment-state.test.ts` | booking/payment state | present |
| `booking-verification-copy.test.ts` | verification copy | present |
| `center-bridge.test.ts` | center bridge | present |
| `notifications.test.ts` | notifications (mock) | present |
| `payment-api.test.ts` | payment API | present |
| `post-body.test.ts` | posts (mock) | present |
| `qa-regression.test.ts` | regression | present |
| `review-request-copy.test.ts` | review copy | present |
| `sanitize.test.ts` | sanitization | present |
| `tutor-booking-api.test.ts` | tutor booking | present |
| `tutor-cv-api.test.ts` | CV API | present |
| `tutor-cv-mapper.test.ts` | CV mapper | present |
| `tutor-route-catalog.test.ts` | route catalog | present |

### 13.2 Backend tests

- Backend test suite exists under `backend/` (migrations-driven integration via Supabase local stack). Local integration tests could not fully run because the local DB is at 22/27 and blocked by the `20260820100000` replay defect (see §9.4/§3).

### 13.3 Cross-audit test evidence (prior audit 11/17/29 — TEST layer)

| Suite | Command | Result (prior) |
|---|---|---|
| Backend unit | `backend pnpm test` | **337/337 PASS** (19 files) |
| Backend integration | `pnpm test:integration` | **24 pass / 26 fail / 99 skip** — BLOCKED by stale local DB (schema drift: `create_booking` overloads, missing `offering_hosts`, missing `20260820120000`), NOT proven app breakage |
| Discover frontend unit | `discover pnpm test` | **165/165 PASS** |
| Root auth | `pnpm test:auth` | **100/100 PASS** |
| Backend typecheck/build | `pnpm typecheck; pnpm build` | PASS |
| Discover typecheck/build | `tsc --noEmit`; `npm run build` | PASS (57 routes emitted) |
| Discover lint | `pnpm lint` | **FAIL — 68 errors / 4383 warnings** (42 in `src/`; react-hooks set-state-in-effect, any, unescaped); `.vercel/output/**` build artifacts in lint scope |
| OSS license gate | `python3 scripts/oss_guard.py ci` | PASS |
| VNPay sandbox e2e | `backend/e2e-vnpay-sandbox.mjs` | NOT executed (needs sandbox creds) — UNVERIFIED |

These counts are from the prior audit run; the current run **did not re-execute** these suites (audit-only, no build/test in scope). Treat as prior TEST evidence, not re-verified this run.

### 13.4 Coverage gaps

- No automated tests for reviews posting (feature is RED/missing).
- No automated browser QA artifacts present in repo (qa_browser runs are out-of-band).
- Workshop RPCs untested locally because migration not yet replayable.
- No meaningful tests for messaging/reviews/notifications backend (none exist), payout provider disbursement, production VNPay webhook/refund/payout, storage/avatar upload (prior audit 11 CONFIRMED).

---

## 14. User Journey Matrix

### 14.1 REQUIRED JOURNEY TABLE

| Journey | Start | Steps | End | Backend wired? | Status |
|---|---|---|---|---|---|
| Learner books 1:1 tutor | discover → tutor profile | search/request/confirm | `/bookings` | ✅ | **GREEN** |
| Learner books workshop | workshop page | select session, participants, confirm | `/bookings` | ✅ | **YELLOW** (live-check defect) |
| Learner books live event | events-live | select session, confirm | `/bookings` | 🔶 (breaks) | **RED** (offeringType vs kind) |
| Learner pays via VNPay | `/payments/return` | intent → redirect → return | `/bookings` | ✅ | **GREEN/PARTIAL** (env UNVERIFIED) |
| Learner cancels & gets refund | `/bookings` | cancel → refund obligation → execution | `/bookings` | ✅ | **GREEN** (rules; payout provider UNVERIFIED) |
| Tutor creates CV & lists | `/become-a-tutor` → `/tutor/[name]` | compose CV, publish, get listed | public directory | ✅ | **YELLOW** |
| Host creates offering/session | center | create offering, sessions, publish | live pages | ✅ (corrective pending) | **YELLOW** |
| Host manages bookings | `/center` | list, confirm, cancel | `/center` | ✅ | **YELLOW** |
| Learner browses courses/classes | `/courses` `/classes` | browse/grid | detail (static) | ❌ | **ORANGE** (UI-only) |
| User writes a review | tutor/profile | compose, submit | profile | ❌ | **RED** (posting missing) |
| User searches | `/search` | query, results | results | 🔶 | **RED/ORANGE** |
| User messages/notifications | `/messages` | list, thread | — | ❌ (mock) | **GRAY** |

---

## 15. Feature Dependency Graph

```
public-tutors / marketplace ------> profiles (0001)
       |                                   |
tutor CV (0002, tutor-cv-api) <-----------+------> become-a-tutor
       |
bookings (0004/0005) <-- shared engine (20260819120000) --+-- 1:1 tutor booking
       |                                                  +-- workshop booking (20260820100000/01)
       |                                                  +-- event booking
       v
payments (0008/0009) -> refund obligations (0010/0011/0013) -> payout
       |
financial worker (financial-*-worker) -> reconciliation
       |
center/dashboard (dashboard.ts, center-bridge.ts) -> host management
courses/classes/communities/learning (UI-only) <-- anon content
discussions/articles/messages/notifications (mock) <-- post-body/sanitize/notifications
reviews (read only) <-- tutor profile ; posting = missing -> RED
search/photobooth -> RED/BLACK (no backend)
```

Any corrective migration (`20260820130000`) depends on the shared engine being promotable first — **do not apply to prod before the migration reconciliation phase completes and local verification passes.**

---

## 16. Current vs Target Matrix

| Capability | Current | Target (private alpha) | Gap |
|---|---|---|---|
| 1:1 booking | GREEN | GREEN | none blocking |
| Workshop booking | YELLOW (frontend defect; local DB blocked) | GREEN | fix events-live check; replay migrations |
| Event booking | ORANGE/RED (live) | GREEN | fix offeringType vs kind |
| Payments VNPay | GREEN/PARTIAL | GREEN | verify prod env |
| Refund/payout | PARTIAL | GREEN | verify payout provider |
| Tutor identity (CV) | YELLOW | GREEN | polish templates |
| Courses/Classes/Communities/Learning | ORANGE (UI-only) | BLUE/GREEN with backend | no backend contract |
| Reviews | RED (posting) | GREEN | build posting path |
| Messaging/Notifications | GRAY (mock) | BLUE/GREEN | production contract |
| Search | RED/ORANGE | GREEN | build search backend |
| Photo booth | BLACK | PURPLE (post-alpha) | — |
| Migration state | local 22/27, prod 24/27, 2 remote-only | all reconciled + verified | reconciliation phase |

---

## 17. Private Alpha Requirements

- All P0/P1 items GREEN + local DB at head + integration tests passing (blocked by migration replay defect).
- Corrective `20260820130000` applied only after local verification and prod migration strategy approval (user gate).
- Prod migration state reconciled: document/promote the two remote-only migrations; promote shared engine consistently.
- Fix RED items: events-live offeringType check, reviews posting, dead nav links (`/saved`, `/dashboard`, `/settings`, `/help`).
- Payment env (VNPay return URL/credentials) verified in a safe staging environment.
- **Minimum credible alpha (prior audit 29 §H — cross-audit scope) = two fully server-authoritative money-correct loops**:
  - **Loop 1 — Host → Workshop**: live Supabase auth (host + learner); creator rewired to `create_offering`+`create_session` (currently writes localStorage — `published-event-store.ts`); learner discovers/books via real `/api/v1/sessions` + `create_booking` (fix overload); payment-TTL active (fix worker); VNPay payment + fixed post-pay view; authenticated host center; refund/payout loop on cancel.
  - **Loop 2 — Tutor**: live auth; CV publish → profile → offering/availability; booking request → accept/reject → session → completion (server-authoritative, `expectedVersion` CAS); tutor center.
- **Activation is configuration/deployment-gated, not engineering-gated for most surfaces**: turn on `NEXT_PUBLIC_TUTORIA_DEMO_MODE=false` + Supabase + API base URL (`auth/config.ts:45`), deploy/verify the Render backend + worker, and the HYBRID surfaces flip live. Three targeted defects (overload PGRST203, worker TTL, `/bookings/[id]` 404) block the money loop until fixed.
- **Auth gating before activation**: `/center` and protected surfaces must be server-gated + RLS-verified before live mode flips (structural risk if left public with real data).

## 18. Post-Alpha Requirements (PURPLE)

- Search backend replacement.
- Messaging/notifications production contract (currently mock).
- Photo booth feature.
- Courses/classes/communities/learning backend contracts (currently UI-only).
- Logout/CSP: enforce `Content-Security-Policy` (currently `Report-Only`), tight RLS audit on `/center`/marketplace writes.
- Native image/S3 upload to replace base64/localStorage (no storage bucket provisioned).
- Native host center (replace `center.html` iframe), native event/course listings (replace `events-exact.html`/`courses-reference.html`).
- Workshop expiry sweep in financial worker (`sweepExpiredWorkshopBookings`) — flagged Phase 4; **recommend promoting to alpha** since pending-payment workshop capacity leak blocks the money loop.
- Learning-progress/attendance backend.
- Year-review / discovery feed productionization.

## 19. Product Decisions Required

- Workshop capacity/pricing model finalization (pricing_model CHECK semantics) before promotion. **Pricing contradiction already RESOLVED toward `flat_per_participant_v1`/`hourly_v1`; `fixed_v1` is dead** — confirm no re-exposure (prior audit 29 §D).
- Reviews posting model: who may review whom, moderation. (Reviews have **no review table in the prod DB**; prior audit 02/06 — MISSING.)
- Messaging/notifications: provider + policy. (Neither has a backend; both mock/localStorage — prior audit 02/03.)
- Search: scope (tutors? content?) + ranking. (Currently placeholder/not-connected — prior audit 02/03/29.)
- Courses/classes/communities/learning: MVP depth (listing only vs booking).
- Whether the two remote-only prod migrations are retained as-is or documented as legacy.
- Auth demo-vs-live removal baseline: whether demo `localStorage tutoria_accounts`/`tutoria-published-events`/`data/published-events.json` paths are fully excluded from production flows (AGENTS.md + prior audit 29 §K).

## 20. Technical Blockers

1. `20260820100000` replay defect — constraint name collision `offerings_pricing_model_check` (SQLSTATE 42710). Blocks clean local reset & local integration testing. **Do not fix during audit.**
2. Prod at 24/27 + 2 remote-only migrations absent from repo (`20260817160000/01`) — content UNKNOWN; needs recovery/documented decision before promotion.
3. Shared engine (20260819120000) + workshop schema/rpcs not on prod; corrective `20260820130000` must not be applied out of order.
4. `events-live/[slug]` broken offeringType-vs-kind comparison (RED). **`/bookings/[id]` route missing** → post-booking redirect 404 (`workshop-detail-page.tsx:214`) — same learner booking-completion flow broken.
5. **`create_booking` overload ambiguity** (PGRST203) on any DB that has both 2-arg and 3-arg — current local DB (22/27) is affected; prod (only 2-arg) is not; corrective `20260820130000` resolves but is not applied.
6. Production runtime env (Render/Vercel/VNPay) UNVERIFIED (off-limits). **Demo-mode activation gate** (`auth/config.ts:45`) means the live host runs a demo shell until env is set + backend deployed.
7. No storage bucket provisioned (avatar/upload) — blocks any real image feature (prior audit 02/05/09).
8. No CI workflow — no automated enforcement of OSS gate / lint / tests (prior audit 10/14).

## 21. Recommended Implementation Sequence

Phase A: (no code) finalize migration reconciliation plan → repair `20260820100000` (SAFE: not on prod) → rebuild local DB → verify all migrations → run integration tests. **Gate: explicit prod strategy.** (See `PRIVATE_ALPHA_REMEDIATION_BASELINE.md` Final Execution Plan phases 1–12.)

Aligned with prior-audit 29 prioritization (P0-1…P1-5) where consistent:
1. Fix migration defects to unblock local verification: repair `20260820100000` replay; reconcile `create_booking` overload (via corrective `20260820130000` after local verification); bring local DB to head. [P1-4 / P0-2]
2. Fix `events-live` offeringType-vs-kind check (RED) and the `/bookings/[id]` post-booking 404 (redirect or dynamic route). [P1-2]
3. Add `sweepExpiredWorkshopBookings` to the financial worker sweep list. [P1-1]
4. Replay migrations to local head; run backend + discover tests to prove the journey gate. [P1-4]
5. Fix dead nav links. [housekeeping]
6. Build reviews posting. [P2]
7. Activate live environment + deploy/verify Render backend + worker; gate `/center` + protected routes; verify VNPay sandbox→staging. [P0-1/P0-3/P1-5]
8. Rewire event/workshop creator to `create_offering`+`create_session` (remove localStorage publish path). [P0-4]
9. Post-alpha: search, messaging/notifications, courses/communities/learning backend, photobooth, native host-center/image-upload/CSP.

## 22. Evidence Appendix

### 22.1 Evidence standard

Each claim in this report is tagged with a trust label:

- **SOURCE** — verified by reading repository files (`file:line`).
- **LOCAL DB** — verified against the local Supabase/Postgres stack.
- **TEST** — verified via automated tests.
- **DEPLOYED RUNTIME** — observed running app (not performed this audit).
- **PROD DB** — verified via read-only `supabase migration list --project-ref sufjrstewzvzjzvzekry` (migration state only; no data reads).
- **PROD INFRA** — not accessed (off-limits this audit).

Per-layer per-feature status: CONFIRMED / PARTIALLY CONFIRMED / UNKNOWN / CONTRADICTED / MISSING / N/A.

### 22.2 Key CONFIRMED evidence (`file:line`)

- Prod migration state (24 applied; one 2-arg create_booking): `supabase migration list` — PROD DB.
- Local migration state (22 applied; stopped at 20260820100000): scratch pg client — LOCAL DB.
- `20260820100000` replay defect: `offerings_pricing_model_check` collision (lines 9-10 inline CHECK vs line 24 ADD CONSTRAINT) — SOURCE+LOCAL DB.
- Remote-only `20260817160000/01` absent from repo: find+grep returned no file/reference — SOURCE (MISSING).
- `events-live/[slug]` broken check: `discover/src/app/events-live/[slug]/page.tsx:30` (`offeringType !== "event"` vs RPC returns `kind` `20260820100001:397`) — SOURCE.
- `booking-service.ts:56` 3-arg create_booking; `:76` `p_offering_type` — SOURCE.
- Financial worker gap `financial-worker-runtime.ts:25-29` — SOURCE (prior Phase-4 finding).
- Dead nav links `discover/src/components/header/user-menu.tsx:70-75` — SOURCE.
- Corrective migration `20260820130000` committed `ca0c5e2`, NOT applied — GIT + SOURCE.

### 22.3 UNKNOWN / UNVERIFIED

- Content of `20260817160000/01` — UNKNOWN (no repo evidence).
- Prod payment env, Render/Vercel/VNPay — UNVERIFIED (off-limits).
- Runtime browser behavior of each surface — UNVERIFIED (no browser QA this audit; documented from code).
- Local integration test results — UNVERIFIED until migrations replay to head.

### 22.4 Audit scope compliance

- No application/backend/migration/DB/seed modifications.
- No DB object creation/deletion/INSERT/UPDATE/DELETE.
- No production SQL beyond the read-only `migration list` command.
- No env/config/DNS/VNPay changes. No deployment.
- No commits of implementation fixes. (The corrective migration precedent `ca0c5e2` is from the *prior planning phase*, committed before this audit run began; this audit added no commits and did not touch application files.)

### 22.5 Historical audit source (cross-reference input)

- **Files**: `audit/01_SYSTEM_INVENTORY.md` … `audit/18_RISK_CLASSIFICATION.md` + `audit/29_FINAL_RECONCILED_STATE.md` (19 files total). Prior forensic reconstruction on branch `consolidation/2026-08-20-pre-manus` @ `9aa03a2`, dated 2026-08-27, including reconciliation with the Manus independent E2E runtime audit of `discover-gules-xi.vercel.app`.
- **Evidence hierarchy honored (per the task)**: current runtime > current prod DB > current repo source > current tests > existing forensic audits > historical docs. Where a prior audit is CONFIRMED at current source, it is folded in and marked; where it is a DEPLOYED-RUNTIME observation not re-run this session, it is explicitly labeled "prior DEPLOYED RUNTIME, not re-verified".
- **Not re-executed this run**: live runtime curls, backend/discover/root test suites, VNPay sandbox e2e, browser QA. These remain prior TEST/DEPLOYED-RUNTIME evidence unless re-verified.

---

## Historical Audit Cross-Reference

Cross-references the prior forensic reconstruction (`audit/01–18` + `audit/29`) against current source, tests, local/prod DB, and this audit's findings. **Current Status** reflects the current repo source unless labeled (prior DEPLOYED RUNTIME / prior TEST). Incorporated = folded into the relevant section (see `Incorp.` column); stale/contradicted findings are explicitly marked.

| Historical Audit | Finding | Current Status | Evidence | Incorp.? |
|---|---|---|---|---|
| 01/02/03 System & feature matrix | Three surfaces; root SPA = demo, backend + `discover` = real; `app.js` IIFE (~1947 lines, Vietnamese) | **CONFIRMED** at source | `app.js`, `backend/`, `discover/` | §2/§4.3 |
| 02 Feature matrix | Auth client-only (no server gating) | **AMENDED**: page routes unprotected, but `/api/*` route handlers use `server-verify.ts` | `discover/src/app/api/{events,tutors}/route.ts` | §10.1 |
| 02 | Messaging, reviews, storage buckets, communities, articles, notifications have **no production DB implementation** | **CONFIRMED** | no tables/libs found | §5/§19 |
| 02/05 | Payments/payouts/refunds **modeled + code-tested** but **production provider runtime UNKNOWN/unverified** | **UNVERIFIED** (prior + off-limits) | §11 | §11 |
| 03 | Auth client-side only; no Next middleware server protection | **CONFIRMED** (page level); note `proxy.ts` no-op | `src/proxy.ts:3-8` | §3.1/§10.1 |
| 03/06/07/17/29 | **`/bookings/[id]` redirect after booking → 404** (no route) | **CONFIRMED** | `workshop-detail-page.tsx:214`; `discover/src/app/bookings/` has no `[id]` | §4/§14/§20 |
| 03/11/17/29 | Discover lint **FAIL**: 68 errors / 4383 warnings; `.vercel/output/**` in lint scope; typecheck+build PASS; 165/165 unit PASS | **CONFIRMED** (prior TEST; not re-run this run) | prior audit 11 | §13.3 |
| 03/08/11/12 | **VNPay sandbox e2e** `backend/e2e-vnpay-sandbox.mjs` exists, not executed (needs creds) | **UNVERIFIED** | file present | §11 |
| 04/06/17/29 | **Financial worker omits `sweepExpiredWorkshopBookings`** → payment-TTL never runs (only 3 sweeps) | **CONFIRMED** | `financial-worker-runtime.ts:25-28` vs `payment-service.ts` | §12/§20 |
| 04 | Backend unit 337/337; typecheck+build PASS; integration BLOCKED (26F/24P/99S) by stale local DB | **CONFIRMED invariant**; integration still blocked by local DB at 22/27 | prior TEST + current LOCAL DB | §13.3 |
| 04/08/11 | Integration failures = **schema drift**, not necessarily broken app code | **CONFIRMED** | PGRST203 `create_booking` overloads; missing `offering_hosts` | §13.3/§20 |
| 05 | Two incompatible schema surfaces: legacy `schema.sql` vs migration tree; `data/state.json` demo | **CONFIRMED** | `backend/schema.sql`, `data/state.json` (08-17) | §9.5 |
| 05/06 | **`create_booking` two live overloads** (2-arg + 3-arg) → PGRST203 on local | **CONFIRMED local / NOT on prod**; corrective drops 2-arg (not applied) | `20260820100001:9`; `20260820130000:19-31` | §9.2/§20 |
| 05/09 | **No storage bucket** provisioned (avatar schema only) | **CONFIRMED** | no bucket SQL | §9.5/§20 |
| 05/09 | Outbox: no generic consumer for non-payment/notification/analytics events | **CONFIRMED** | 0006 + claims, financial worker only | §12 |
| 06/07 | Workshop = most complete offering end-to-end; gaps: payment-TTL not dispatched, booking-detail 404, review flow absent, payout provider unverified | **CONFIRMED** | §12/§14/§20 | §12/§17 |
| 07/29 C12/C17 | **Workshop/event creator writes localStorage / `data/published-events.json`, does NOT call `create_offering`/`create_session`** | **CONFIRMED** | `published-event-store.ts`, `event-creator.tsx` (no RPC call) | §4.1/§17/§21 |
| 07 | Host authorization hardening `20260820120000` not applied to local dev DB | **CONFIRMED** (local 22/27) | LOCAL DB | §9.1 |
| 08 | VNPay webhook intentionally unauthenticated, signature-verified `timingSafeEqual`; HTTPS origin unknown | **CONFIRMED** (source); origin UNKNOWN | `vnpay-adapter.ts` | §11 |
| 08 | Payout/commission = model + read endpoints only, no provider disbursement | **CONFIRMED** | `payout-statement.ts`, `GET /payouts` | §11 |
| 09 | No UGC moderation/reviews surface; storage bucket RLS missing | **CONFIRMED** | §5/§19 | §5/§9.5 |
| 09/13 C13 | Notifications read **localStorage even in live mode** | **CONFIRMED** | `lib/notifications.ts` | §5 |
| 10/14 | No CI committed; no Dockerfile; worker has no HTTP health endpoint (JSON logs only) | **CONFIRMED** | no `.github/`; `render.yaml` | §3.1/§13.3 |
| 10/29 | Live `discover-gules-xi.vercel.app` served real app but **demo mode**; Render backend/worker **not confirmed deployed**; root `tutormatch.vercel.app` served unrelated CRA scaffold | **Prior DEPLOYED RUNTIME** (off-limits, not re-run) | prior audit 10/29 §J | §3.1 |
| 13 C1/C2/C3 | Migration drift local DB: missing 20260819120000 (partial) + 20260820120000; overload ambiguity; `20260819130000` fix absent from repo | **CONFIRMED / AMENDED**: repo-tracking now 22/27; `20260819130000` **still absent** (no file); the corrective path via `20260820130000` supersedes | LOCAL DB + find/grep | §9.1/§20 |
| 13 C11 | `tutormatch.vercel.app` serves default CRA scaffold, not Tutoria | **Prior DEPLOYED RUNTIME** (off-limits) | prior audit 13 | §3.1 |
| 14 | **Stale `.bak` migration** `20260820100001...sql.bak` present | **STALE / CORRECTED**: **absent at current source** (glob no match). Do not carry forward | glob `*.bak` | §9.5 (correction) |
| 14 | Orphaned demo: `app.legacy-ui.js`, `/skills`, `/year-review`, v3–v15, orphaned components (`CoursesPage`, `ProfileReplacement`, `pizza-workshop-frame`, etc.) | **CONFIRMED** | files + no route import | §4/§14 |
| 14 | Duplicated frontend booking-api state (multiple aliases), some alias-only | **CONFIRMED** (worth consolidation) | 5 booking lib files | §4.1.1 |
| 16/18 | **NOT production-ready** on evidence: prod not confirmed deployed, VNPay runtime unverified, TTL not dispatched, booking 404, DB not reproducible, frontend surfaces demo, no CI | **CONFIRMED overall verdict** (consistent with this audit) | aggregate | §17/§18/`CURRENT_TUTORIA_READINESS` |
| 29 §C1…C19 | Manus runtime claims: 11 CONFIRMED / 7 PARTIALLY / 1 CONTRADICTED (C6 event-detail Pizza fallback) | **CONFIRMED reconciliation**; the "Production core, gated data path, demo runtime" verdict stands | audit 29 | §3.1/§4.1.1 |
| 29 §D | **Pricing contradiction RESOLVED**: `fixed_v1` dead in `resolve_booking_pricing`; authoritative = `flat_per_participant_v1`/`hourly_v1` | **CONFIRMED** | `20260819120000:152`, `booking.ts:13`, `20260820100000:10,25-29` | §9.2/§19 |
| 29 §E | Only ~4 source surfaces truly API-connected (workshop/event-live detail, workshop list, tutor profile/center/auth in live mode); community/social surfaces have **no backend** | **CONFIRMED** | §4.1.1 | §4.1.1/§5 |
| 29 §H | Minimum alpha = two server-authoritative loops (Host→Workshop, Tutor); the rest post-alpha | **INCORPORATED** (product-scope guidance) | §17 | §17 |

**Unresolved contradictions preserved (not silently resolved):**
1. `events/[slug]` data path: prior audit 29 C5 said detail calls `/api/v1/marketplace/event`; current source imports the shared `WorkshopDetailPage` + fixture metadata (`getEventBySlug`/`getSharedEventBySlug`). Current source is authoritative → the component may still call the API at runtime, but the static metadata path is fixture-based. Flagged for the PRD builder to confirm against runtime.
2. Prior audit 03 said auth is "client-only, no server gating"; current `discover/src/app/api/*` route handlers use `server-verify.ts`. Amended to: pages unprotected, route handlers server-verified.
3. `session_hard_reserved` exact per-participant vs 1:1 summation semantics: **UNKNOWN** (both audits). **PRODUCT/DB DECISION REQUIRED** (affects workshop capacity).
4. `20260819130000` fix migration referenced by a signed-off report but absent from repo: **UNKNOWN** provenance; superseded by corrective `20260820130000` — decide retain-as-documented vs treat as legacy.
5. Deployed-runtime/migration-state of hosted prod Supabase (`sufjrstewzvzjzvzekry`) beyond `migration list` (24/27): **UNVERIFIED / off-limits**.

---

## FINAL REQUIRED SUMMARY (A–K)

**A. Inventory produced**: complete feature-by-feature technical inventory across three surfaces (discover shell, backend API/persistence, legacy demo).

**B. Sources**: 6 read-only code explorer passes + prior DB-engineer/security-review findings + read-only prod migration reconciliation + read-only cross-reference of `audit/01–18` & `audit/29` (19 prior forensic files). Trust labels per §22.

**C. Requirements standards**: status semantics (GREEN→BLACK) + evidence labels (SOURCE/LOCAL DB/TEST/DEPLOYED RUNTIME/PROD DB/PROD INFRA) applied consistently.

**D. What is production-authoritative**: `backend/` (Fastify + Supabase/migrations). Client metadata not authoritative. Legacy SPA / `public/*.html` never production source of truth.

**E. What is demonstrated only (not production)**: legacy SPA matching/chat/simulated payment/reviews; discussions/articles/messages/notifications (mock); UI-only courses/classes/communities/learning.

**F. Top readiness**: booking + shared engine = GREEN/PARTIAL; tutor system = YELLOW; workshops/events/classes = ORANGE→YELLOW; content surfaces = ORANGE; mock social = GRAY; reviews posting = RED; search/photobooth = RED/BLACK.

**G. Top blockers**: `20260820100000` replay defect; prod 24/27 + 2 remote-only migrations; events-live offeringType-vs-kind; shared engine not on prod; prod payment env UNVERIFIED.

**H. What is forbidden during audit**: any implementation/repair of the migration defect or application of corrective migrations; prod contact beyond read-only migration list.

**I. Corrective migration (`20260820130000`)**: authored + committed `ca0c5e2` in the prior planning phase; NOT applied; out of audit scope; apply only after user-gated reconciliation.

**J. Deliverable status for PRD build**: this inventory is **PASS-complete for scope** — it documents every surface, feature, state, gap, blocker, dependency, evidence, and requirement needed to write the Master Product + Technical PRD. Any PRD built from it must keep the audit boundary truthfulness labels and not silently claim YELLOW/ORANGE/RED surfaces are production-ready.

**K. Audit outcome**: **AUDIT COMPLETE — READ-ONLY**. No production contact, no DB mutation, no implementation changes made.

---

## CURRENT_TUTORIA_READINESS

| Feature | Runtime | Status | Evidence | Blocked by |
|---|---|---|---|---|
| 1:1 booking + lifecycle | GREEN | SOURCE+LOCAL+TEST | booking-api.test.ts | — |
| Shared booking engine | PARTIAL | SOURCE+LOCAL | 20260819120000 local-only | prod promotion |
| Workshop booking | YELLOW | SOURCE | workshop-booking-api.ts | events-live defect; local DB blocked |
| Event booking (live) | RED | SOURCE | events-live/[slug]:30 | offeringType vs kind |
| Payments VNPay | GREEN/PARTIAL | SOURCE+TEST | payment-api.test.ts | prod env UNVERIFIED |
| Refund/payout | PARTIAL | SOURCE | 0010/0011/0012 | payout provider UNVERIFIED |
| Tutor CV/identity | YELLOW | SOURCE+TEST | tutor-cv-*.test.ts | template polish |
| Marketplace | YELLOW | SOURCE+TEST | marketplace-api.ts | — |
| Center/dashboard | YELLOW | SOURCE+TEST | center-bridge.test.ts | — |
| Courses/Classes/Communities/Learning | ORANGE | SOURCE (UI) | page.tsx set | no backend |
| Discussions/Articles/Messages/Notifications | GRAY | SOURCE (mock) | post-body/notifications libs | mock only |
| Reviews read | PARTIAL | SOURCE | tutor profile | — |
| Reviews posting | RED | SOURCE | profile-replacement unused | missing path |
| Search | RED/ORANGE | SOURCE | search/page.tsx | no backend |
| Photo booth | BLACK | MISSING | — | no code |
| Migration state | 22/27 local, 24/27 prod | LOCAL DB + PROD DB | §9.1 | replay defect; remote-only |
| Corrective contract cleanup | NOT APPLIED | SOURCE+GIT | ca0c5e2 | user-gated phase |
| Pricing model | RESOLVED (`flat_per_participant_v1`/`hourly_v1`; `fixed_v1` dead) | SOURCE | `booking.ts:13`, `20260820100000` | none |
| Creator → offerings publish | BROKEN (localStorage only) | SOURCE | `published-event-store.ts` | no `create_offering` call |
| `/bookings/[id]` post-pay | RED (404) | SOURCE | `workshop-detail-page.tsx:214` | route missing |
| Demo-mode activation | OFF (gate `auth/config.ts:45`) | SOURCE | prior DEPLOYED RUNTIME (not re-run) | env + deploy required |
| Runtime browser verification | UNVERIFIED | — | — | browser QA out of band |

---

*End of Tutoria Master Technical Inventory. Audit run id `20260828-001113-master-feature-technical-inventory-a`.*
