# TUTORIA MASTER PRODUCT + TECHNICAL IMPLEMENTATION SPECIFICATION
## v5.0 — Build-Ready Implementation Authority

**Date:** 28 August 2026
**Status:** IMPLEMENTATION AUTHORITY — pending final owner/product-decision approval
**Primary evidence layer:** `docs/TUTORIA_MASTER_TECHNICAL_INVENTORY.md`
**Prior product/technical contract:** `~/Downloads/TUTORIA_MASTER_PRODUCT_TECHNICAL_PRD_v4.0.md` (rules + prioritization source)
**Historical reconciliation:** `audit/29_FINAL_RECONCILED_STATE.md` and `audit/01–18`
**Implementation consumers:** OpenCode / Codex / engineering agents
**Architecture/product arbitration:** ChatGPT + explicit owner decisions
**Audit rule:** Current source/runtime evidence overrides stale historical claims.

---

# 00. DOCUMENT AUTHORITY

## 00.1 What this document is

This is the **build-ready Product + Technical Implementation Specification**. It converts the evidence layer (`docs/TUTORIA_MASTER_TECHNICAL_INVENTORY.md`) and the v4.0 PRD rules into an **executable contract**: every retained page, component, interaction, state, API, DB/RPC dependency, gap, and verification requirement carries a **stable, machine-readable requirement ID** and is **bidirectionally traceable** to implementation + test + acceptance evidence.

An engineering agent consuming this document must **not** need to rediscover the product. Every decision that is not yet frozen is explicitly marked `PRODUCT DECISION REQUIRED` and must not be guessed.

## 00.2 Source-of-truth hierarchy (cannot be overridden by any historical claim)

```text
CURRENT REPOSITORY SOURCE
CURRENT TESTS / LOCAL DB EVIDENCE
CURRENT VERIFIED RUNTIME
PRODUCTION DB / INFRASTRUCTURE EVIDENCE
HISTORICAL AUDITS
DESIGN PROTOTYPES / MOCKS
ASSUMPTIONS
```

## 00.3 How to read an ID

Every requirement ID is stable and scoped by prefix. Pattern: `<AREA>-<NNN>` and, where it is a fragment of a larger flow, `<AREA>-<NNN>.<PART>`.

| Prefix | Area |
|---|---|
| `DOC` | Document authority / cross-cutting |
| `SCOPE` | Product scope & Alpha boundary |
| `REAL` | Current system reality / runtime |
| `ARCH` | Architecture |
| `ROLE` | Roles & permissions |
| `DOM` | Domain model / entities / state |
| `AUTH` | Authentication & account |
| `DISC` | Discover / marketplace |
| `WORK` | Workshop |
| `BOOK` | Shared booking engine / booking |
| `PAY` | Payment / VNPay / refund / payout |
| `FINW` | Financial worker / async |
| `HOST` | Host Center |
| `LEARN` | Learner Center / bookings list |
| `TUT` | Tutor system |
| `EVT` | Events |
| `CLS` | Classes |
| `CRS` | Courses |
| `SOC` | Social (communities / discussions / articles) |
| `MSG` | Messaging |
| `NOTIF` | Notifications |
| `LRN` | Learning Center |
| `REV` | Reviews |
| `SCH` | Search / filters |
| `PROF` | Profiles / photobooth |
| `ADM` | Admin / operations |
| `ANL` | Analytics |
| `API` | API contract (routes) |
| `SRV` | Backend service contract |
| `DB` | Database contract (tables/columns) |
| `RPC` | RPC/function contract |
| `SEC` | Auth / RLS / security |
| `STG` | Storage contract |
| `EVT2` | Event/outbox/notification contract |
| `WORKER` | Worker/async contract |
| `MIG` | Migration plan |
| `TEST` | Test contract umbrella (§28): TEST-U (=`TST`) unit, TEST-I (=`ITST`) integration |
| `TST` | Unit test contract (short form of TEST-U) |
| `ITST` | Integration test contract (short form of TEST-I) |
| `E2E` | E2E test contract |
| `RTM2` | Runtime verification contract |
| `AC` | Acceptance criteria (per feature) |
| `DEC` | Product/technical decision (open) |
| `BLK` | Blocker |
| `IMP` | Exact implementation requirement |
| `PH` | Implementation phase |
| `DOD` | Definition of done |
| `TRACE` | Traceability link |

## 00.4 Required section mapping (this v5.0 builds the 40-section skeleton)

| # | Section | Location |
|---|---|---|
| 00 | Document Authority | this file §00 |
| 01 | Product Scope | this file §01 |
| 02 | Current System Reality | this file §02 |
| 03 | Architecture | this file §03 |
| 04 | Roles & Permissions | this file §04 |
| 05 | Domain Model | this file §05 |
| 06 | Route Registry | this file §06 |
| 07 | Page-by-Page Specification | `docs/spec-v5/00_auth.md` + `01_workshop.md` + ... (per surface) |
| 08 | Component Registry | per-surface files |
| 09 | UI Interaction Registry | per-surface files |
| 10 | User Journey Specifications | `docs/spec-v5/14_journeys.md` |
| 11 | API Contract | `docs/spec-v5/11_api_contract.md` |
| 12 | Backend Service Contract | `docs/spec-v5/12_backend_service.md` |
| 13 | Database Contract | `docs/spec-v5/13_database.md` |
| 14 | RPC Contract | `docs/spec-v5/14_rpc.md` |
| 15 | Auth/RLS/Security Contract | `docs/spec-v5/15_security.md` |
| 16 | Payment Contract | `docs/spec-v5/16_payment_contract.md` |
| 17 | Worker/Async Contract | `docs/spec-v5/17_worker_async.md` |
| 18 | Notification/Event Contract | `docs/spec-v5/18_events_notifications.md` |
| 19 | Storage Contract | `docs/spec-v5/19_storage.md` |
| 20 | Search Contract | `docs/spec-v5/20_search.md` |
| 21 | Analytics Contract | `docs/spec-v5/21_analytics.md` |
| 22 | Feature-by-Feature Current State | `docs/spec-v5/22_current_state.md` |
| 23 | Feature-by-Feature Target State | per-surface + this file §01 |
| 24 | Gap Specification | `docs/spec-v5/24_gap_spec.md` |
| 25 | Exact Implementation Requirements | `docs/spec-v5/25_impl_requirements.md` |
| 26 | Dependency Graph | this file §03 + `docs/spec-v5/26_dependency_graph.md` |
| 27 | Migration Plan | `docs/spec-v5/27_migration_plan.md` |
| 28 | Test Contract | `docs/spec-v5/28_test_contract.md` |
| 29 | E2E Contract | `docs/spec-v5/29_e2e_contract.md` |
| 30 | Runtime Verification Contract | `docs/spec-v5/30_runtime_verification.md` |
| 31 | Alpha Scope | this file §01 + per surface |
| 32 | Post-Alpha Scope | this file §01 |
| 33 | Product Decisions | `docs/spec-v5/33_product_decisions.md` |
| 34 | Technical Decisions | `docs/spec-v5/33_product_decisions.md` (§34) |
| 35 | Implementation Phases | `docs/spec-v5/35_phases.md` |
| 36 | Definition of Done | this file §36 |
| 37 | Requirement Traceability Matrix | this file §37 (index) + per-surface `RTM` tables |
| 38 | Evidence Registry | this file §38 |
| 39 | Contradictions / Unknowns | this file §39 |
| 40 | Final Implementation Checklist | this file §40 |

The full RTM lives across the per-surface files; §37 of this file is the **index** that ties every surface file's ID ranges together.

---

# 01. PRODUCT SCOPE

`SCOPE-001` — Tutoria is a Vietnam-first learning marketplace + community. Scope of this spec = make one coherent, authoritative, money-correct marketplace loop run for **Private Alpha** (Workshop + Tutor), while explicitly deferring community/social/LMS surfaces to Post-Alpha unless an owner decision promotes them.

`SCOPE-002` — **Alpha boundary (per v4.0 §2, adopted):** Private Alpha = a real Host and a real Learner can complete the Workshop money loop, and a real Tutor/Learner can complete the Tutor loop, against authoritative backend/database state. See `docs/spec-v5/00_auth.md`, `01_workshop.md`, `03_booking.md`, `04_payment.md`, `07_tutor.md`.

`SCOPE-003` — **Post-Alpha by default** (`PURPLE`): messaging, realtime notifications, communities, discussions, articles/CMS, full course marketplace/LMS, advanced recurring classes, advanced rescheduling, reviews (unless promoted), photobooth production infra, advanced analytics, broad admin tooling, affiliate/marketing.

`SCOPE-004` — Do not silently promote routes to Alpha. A route is Post-Alpha unless listed as Alpha here or by explicit `DEC-*`. Default Post-Alpha routes: `/messages`, `/communities`, `/discussions`, `/articles`, `/courses*`, `/learning` (full LMS), `/skills`, `/year-review`, `/u`, `/user`, `/v3`–`/v15`, photobooth.

`SCOPE-005` — The existing shared booking engine, payment adapter, Supabase Auth, RLS pattern, outbox, and financial worker are **preserved, not rebuilt**. See §49-v4.0 rules adopted as `ARCH-*`.

---

# 02. CURRENT SYSTEM REALITY

See `docs/TUTORIA_MASTER_TECHNICAL_INVENTORY.md` for the full evidence ledger. Summary truths (all cross-verified; current `REAL-*` IDs):

`REAL-001` — Three surfaces: root legacy SPA (demo), `backend/` (Fastify + Supabase, authoritative), `discover/` (Next.js web shell, preferred production frontend).

`REAL-002` — Migration state: **local 22/27, prod 24/27**. Prod has the two remote-only migrations `20260817160000`/`20260817160001` absent from repo. Several corrective migrations (`20260819120000`, `20260820000000`, `20260820100000/01/02`, `20260820120000`, `20260820130000`) are in-repo but not on prod. See `docs/spec-v5/27_migration_plan.md`.

`REAL-003` — `20260820100000` has a **reported replay defect** (`offerings_pricing_model_check` duplicate, SQLSTATE 42710) blocking a clean local reset. **VERIFIED PARTIALLY:** the migration adds `ADD CONSTRAINT offerings_pricing_model_check`; no **in-repo** collision partner exists — a 42710 would require a constraint already present from a remote-only migration (`20260817160000/01`, absent from repo) or prior apply state. **Exact mechanics to be reproduced at apply time** (not asserted). Was not applied during audit.

`REAL-004` — `create_booking` has historical 2-arg and 3-arg overloads in the repo (`(uuid,int)` in `0005`+`20260815090001`; `(uuid,int,text)` in `20260820100001`). Corrective `20260820130000` (committed `ca0c5e2`) drops the 2-arg and keeps `(uuid,int,text)`; it is in-repo but **not on prod**. Prod-side state is UNVERIFIED (prod off-limits to this audit). See `docs/spec-v5/14_rpc.md`.

`REAL-005` — Pricing contradiction **RESOLVED**: `fixed_v1` is dead in `resolve_booking_pricing`; authoritative = `flat_per_participant_v1` (workshop) / `hourly_v1` (tutor).

`REAL-006` — Demo-mode gate: `discover/src/lib/auth/config.ts:45` defaults `demoMode=true` unless env is set → live host runs a demo shell. The single largest "surface activation" lever.

`REAL-007` — Financial worker `runFinancialWorkerIteration` runs only 3 sweeps; `sweepExpiredWorkshopBookings` is **not dispatched** → workshop pending-payment TTL never expires capacity.

`REAL-008` — `/bookings/[id]` is missing; `workshop-detail-page.tsx:214` redirects there → post-booking 404.

`REAL-009` — `events-live/[slug]/page.tsx:30` checks `offeringData.offeringType !== "event"`, but the `events-live` surface serves **workshop** offerings (`offeringType === "workshop"`), so the detail always returns "Event not found". `offeringType` is a real field (not an RPC `kind` mismatch); the bug is comparing to the wrong kind for this surface.

`REAL-010` — No storage bucket provisioned; no real messaging/notifications/reviews/LMS backend.

`REAL-011` — Backend unit 337/337 PASS; discover 165/165 PASS; root auth 100/100 PASS (prior TEST). Integration suite **blocked** by local DB drift (26F/24P/99S prior). Not re-executed this run.

`REAL-012` — Production deployment/payment runtime **UNVERIFIED / off-limits** this audit. Live `discover-gules-xi.vercel.app` previously ran in demo mode (prior DEPLOYED RUNTIME).

---

# 03. ARCHITECTURE

## 03.1 Target topology

```text
public HTTPS frontend (discover/Next) ── browser-safe Supabase config + API base URL
        │
HTTPS API/backend (Fastify) ──► Supabase production project
        │  ▲                         │ service-role server paths only
VNPay HTTPS callbacks                ▼
                                  financial worker (separate process)
```

`ARCH-001` — Backend is authoritative; client metadata is not. Preserve this boundary.
`ARCH-002` — Preserve the existing `Offering → Session → Booking → Payment → Completion` architecture. Do not create parallel booking models.
`ARCH-003` — Preserve RLS / `SECURITY DEFINER` / `search_path=''` / service-role-worker boundaries.
`ARCH-004` — Browser must never authoritatively set price, capacity, participant count, booking eligibility, payment/refund state, ownership, payout, or session safety.
`ARCH-005` — No fake persistence for transactional state (no localStorage/fixture/static-JSON as marketplace truth). See §1.3 v4.0, adopted.

See `docs/spec-v5/26_dependency_graph.md` for the full graph.

---

# 04. ROLES & PERMISSIONS

`ROLE-001` — Roles (Supabase `user_role`): `student` (learner), `tutor`, `admin`. `tutor` also acts as `host` for offerings.

| Role | Can | Cannot |
|---|---|---|
| Anonymous | Read public discovery/profile/offering metadata | Create bookings, see private data, mutate anything |
| Learner (`student`) | Create bookings for eligible sessions, view own bookings, pay for own bookings, cancel per policy, view own history | Manage others' offerings, see others' private data/payments, mutate bookings they don't own |
| Tutor | Create/manage own offerings+sessions+availability, accept/reject own bookings, complete sessions, view own financials, publish CV/profile | Manage other hosts' offerings, set learner bookable price client-side |
| Host (tutor acting as host) | Manage own listings/bookings/attendees/earnings, publish | Access another host's atendee PII |
| Admin | User/host/tutor mgmt, booking support, refund ops, moderation, financial reconciliation, reports | Unauthorized direct data mutation without separate admin authn |

`ROLE-002` — Admin actions are separately authorized; admin UI is not a substitute for backend authorization.
`ROLE-003` — Role elevation (`enable_tutor`) is service_role-only; `handle_new_user_profile` ignores client metadata role (per `20260815150540`).

---

# 05. DOMAIN MODEL

## 05.1 Entities (authoritative names; see `docs/spec-v5/13_database.md`)

`DOM-001` — **Offering** (`offerings`): kind ∈ {tutor, workshop, class, event}; pricing_model ∈ {hourly_v1, flat_per_participant_v1} (dead `fixed_v1` excluded); booking_mode ∈ {approval, instant}; publication_status; creator_id; slug; config jsonb.
`DOM-002` — **OfferingHost** (`offering_hosts`): host↔offering membership.
`DOM-003` — **Session** (`sessions`): offering_id (NOT NULL), starts_at/ends_at, min/max participants, status ∈ {scheduled, cancelled, completed}.
`DOM-004` — **Booking** (`bookings`): status text+CHECK ∈ {requested, confirmed, cancelled, rejected, completed} (+ payment-adjacent state via `payments`); participant_count; price snapshot; version (CAS); cancelled_by ∈ {attendee, host, system}.
`DOM-005` — **Payment** cluster: payments, payment_attempts (idempotency_key), payment_events, payment_provider_events (provider_event_key), payment_provider_operations (operation_key), refunds.
`DOM-006` — **Booking history / outbox**: booking_history, session_history, event_outbox (durable domain events).
`DOM-007` — **Tutor cluster**: tutor_profiles (+version CAS), tutor_subjects/levels/regions/languages, tutor_availability_slots, tutor_education/experience_entries.
`DOM-008` — **Learner abuse protection**: booking_create_attempts (rate limiter).
`DOM-009` — **Profiles**: `profiles` (id→auth.users, role, name, phone, avatar_url) + `marketplace_listings`.

## 05.2 Statuses (authoritative; do not invent new ones without `DEC-*`)

`DOM-010` Booking: `requested → confirmed → completed`, with `cancelled`/`rejected`/expired; paid state represented via `payments.status` (pending/succeeded/failed/refunded). Do not add `reviewed` unless the DB supports it.
`DOM-011` Session: `scheduled → completed`; `cancelled`.
`DOM-012` Refund: `obligation → pending → succeeded | failed | ambiguous`.

## 05.3 Capacity invariant

`DOM-013` Executable invariant: `confirmed/held participants <= max_capacity` on every session, enforced atomically by the booking RPC (post-insert recount + transaction rollback). Client can never assert capacity alone.

---

# 06. ROUTE REGISTRY (canonical vs legacy vs Alpha)

`API`/route rules: do not invent endpoint names where an existing endpoint already covers the capability. The technical inventory is authoritative for existing endpoint names.

| Canonical Alpha target | Current route(s) | Type now | Alpha? |
|---|---|---|---|
| `/discover` | `/discover` | Native/hybrid | YES |
| `/events-live` (workshop discovery) | `/events-live`, `/workshops` | Real/hybrid; `/workshops` native | YES (final route TBD `DEC-*`) |
| Workshop detail | `/events-live/[slug]` (broken check), `/workshops/[slug]` | Real | YES |
| Workshop creator | `/events/new` / center | localStorage creator (broken) | YES (rewire) |
| Host Center | `/center` | iframe/hybrid | YES (native) |
| Learner bookings | `/bookings` | Real | YES |
| Booking detail | `/bookings/[id]` | **missing/404** | YES |
| Payment return | `/payments/return` | Real | YES |
| Tutor profile | `/tutor/[slug]` | hybrid/fixture | P1 |
| Learn (booking list) | `/learning` (subset) | mock | P1 selective |
| Messages/Communities/Discussions/Articles/Courses/Photobooth | various | mock/localStorage/iframe | NO (Post-Alpha) |

`BLK-001` — `/bookings/[id]` missing. `BLK-002` — workshop TTL not dispatched. `BLK-003` — migration/RPC ambiguity. `BLK-004` — creator not persisting to Offering/Session. `BLK-005` — incomplete payment path. `BLK-006` — live/demo separation. `BLK-007` — prod payment runtime unverified. (Cross-ref v4.0 §53.)

---

# 36. DEFINITION OF DONE

## 36.1 Per page
A page is DONE only when all of: canonical route; direct nav works; refresh works; mobile layout works; every displayed field has a defined data source (`DB`/`API`/fallback); every CTA has defined behavior; every mutation has backend authorization; success state is server-backed; loading/error/empty states exist; no fake persistence in live path; API contract documented; DB contract documented; tests exist for critical behavior; runtime evidence exists. `DOD-001`.

## 36.2 Per feature
A feature is DONE only when each link of the chain is present with evidence:
`PAGE EXISTS + canonical + UI complete + interaction complete + API connected + backend complete + DB complete + auth complete + states complete + tested + runtime verified`. `DOD-002`.

## 36.3 Alpha gate
A feature/loop is Alpha-ready only when the full 5-way ladder (EXISTENCE → FUNCTIONALITY → CONNECTIVITY → RUNTIME → COMPLETENESS) is evidenced. `DOD-003`.

---

# 37. REQUIREMENT TRACEABILITY MATRIX (index)

Every per-surface file ends with an `RTM` table of the form:

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| `WORK-017` | ... | `workshop-detail-page.tsx` | `POST /bookings` / `create_booking` | `WORK-E2E-004` | `AC-WORK-017` | §38 |

## 37.1 ID ownership by file

| File | ID ranges owned |
|---|---|
| `00_auth.md` | AUTH-*, ROLE-* (auth aspects), SEC-auth |
| `01_workshop.md` | WORK-* |
| `02_discover.md` | DISC-* |
| `03_booking.md` | BOOK-* |
| `04_payment.md` | PAY-*, FINW-* |
| `05_host_center.md` | HOST-* |
| `06_learner.md` | LEARN-*, BOOK-detail |
| `07_tutor.md` | TUT-* |
| `08_events_classes_courses.md` | EVT-*, CLS-*, CRS-* |
| `09_social_messaging_notifications.md` | SOC-*, MSG-*, NOTIF-*, LRN-*, REV-*, PROF-*, SCH-* |
| `10_admin_analytics.md` | ADM-*, ANL-* |
| `11_api_contract.md` | API-*, SRV-* |
| `12_backend_service.md` | SRV-*, SRV-* |
| `13_database.md` | DB-*, MIG-* |
| `14_rpc.md` | RPC-*, DB-* |
| `15_security.md` | SEC-*, STG-* |
| `16_payment_contract.md` | PAY-*, SEC-pay |
| `17_worker_async.md` | WORKER-*, EVT2-*, FINW-* |
| `18_events_notifications.md` | EVT2-*, NOTIF-* |
| `19_storage.md` | STG-* |
| `20_search.md` | SCH-* |
| `21_analytics.md` | ANL-* |
| `22_current_state.md` | REAL-*, feature current status |
| `24_gap_spec.md` | GAP-* (derived) |
| `25_impl_requirements.md` | IMP-* |
| `26_dependency_graph.md` | ARCH-*, DEP-* |
| `27_migration_plan.md` | MIG-* |
| `28_test_contract.md` | TEST-*, TST-* (= TEST-U), ITST-* (= TEST-I) |
| `29_e2e_contract.md` | E2E-*, AC-* |
| `30_runtime_verification.md` | RTM2-* |
| `33_product_decisions.md` | DEC-*, TDEC-* |
| `35_phases.md` | PH-* |
| `14_journeys.md` | JRN-*, JRN-AC-* |
| `40_uiux_tutor_profile.md` | TUT-UX-* (field-level tutor profile + 1:1 booking) |
| `41_uiux_workshop_booking.md` | BOOK-UX-* (field-level workshop booking + learner detail) |
| `42_audit_inventory.md` | AUD-* (surface inventory + coverage map; every row LIVE/DEMO/STATIC + VERIFIED/UNVERIFIED) |

### 37.2 Feature PRDs

| PRD | Feature | Status | Spec anchors |
|---|---|---|---|
| `docs/prd/PRD-001-booking-contact-capture.md` | P0 Booking + Learner Contact Capture | DRAFT | `GAP-023`, `DEC-013/014`, `TUT-UX-002/003`, `BOOK-UX-002/003`, `LEARN-002`, `AUD-001/002` |

---

# 38. EVIDENCE REGISTRY

Each accepted evidence item is a keyed entry. Format: `EVID-<NNN>` with scope, command/check, result, environment (SOURCE/TEST/LOCAL DB/PROD DB/DEPLOYED RUNTIME), status. Full registry maintained in `docs/spec-v5/22_current_state.md` and referenced by every `RTM`.

---

# 39. CONTRADICTIONS / UNKNOWNS

(Index; full ledger in `docs/spec-v5/22_current_state.md` and `33_product_decisions.md`.)
- `UNK-001` `events/[slug]` runtime data path — the shared `WorkshopDetailPage` + fixture metadata; runtime behavior to confirm.
- `UNK-002` `session_hard_reserved` per-participant vs 1:1 summation semantics → `PRODUCT DECISION REQUIRED` (`DEC-*`).
- `UNK-003` `20260817160000`/`20260817160001` remote-only migration content unknown.
- `UNK-004` Prod deployment/payment runtime off-limits/UNVERIFIED.
- `UNK-005` `20260819130000` fix migration provenance.

---

# 40. FINAL IMPLEMENTATION CHECKLIST

- [ ] All `IMP-*` requirements implemented in dependency order (`docs/spec-v5/35_phases.md`).
- [ ] All `DEC-*` product decisions resolved before their dependent requirements are implemented; undecided blocked work is marked `PRODUCT DECISION REQUIRED`.
- [ ] Each Alpha journey passes its `E2E-*` + `AC-*` contract (`docs/spec-v5/29_e2e_contract.md`).
- [ ] No `BLK-*` blocker remains for the Alpha loop.
- [ ] Evidence registry (`docs/spec-v5/22_current_state.md` §22.2) current with `RTM2-*` runtime evidence.
- [ ] Every requirement in the per-surface `RTM` tables has a non-empty Impl/Test/Acceptance/Evidence cell or is explicitly `PARTIAL`/`PRODUCT DECISION REQUIRED`.

---

*End of master file. Per-surface contracts live under `docs/spec-v5/`.*
