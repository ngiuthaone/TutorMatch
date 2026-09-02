# Tutoria Center — Implementation Plan

Status: P0/P1 in progress · Owner: orchestrator · Last update: 2026-09-02

The Tutoria Center prototype lives at `discover/public/center.html` and is mounted inside an iframe at `discover/src/app/center/page-client.tsx`. It currently renders entirely from in-memory JS fixtures; only `tutor_bookings`, `workshop_bookings`, attendance, reviews, and the dashboard summary are wired to real backend data via `postMessage`.

This plan turns the iframe prototype into a production Host Center built on the existing Tutoria backend primitives (offering / offering_hosts / session / booking / payment / refund), reusing the existing shared booking engine (`20260819120000_shared_booking_engine.sql`) and adopting patterns mined from Hi.Events, OpenEvents, and OpenLuma.

---

## 1. Existing prototype audit (kept as UX contract)

Prototype file: `discover/public/center.html` (857 lines, single-file Tailwind CDN SPA).

| Page id | Purpose | Wired today | Production target |
| --- | --- | --- | --- |
| `page-home` | KPIs, to-do tiles, opportunity, performance bar, upcoming, session-health | Dashboard summary via iframe bridge | Real `get_host_dashboard` RPC |
| `page-bookings` | Workspace split + cross-listing table | Real `listTutorBookings` + cancel/decide | Existing `get_my_host_bookings` + extended filters |
| `page-listings` | Listing OS table + drawer | Fixtures | New `list_host_offerings` RPC |
| `page-calendar` | Month grid with session chips | Fixtures | New `list_host_sessions` RPC |
| `page-learners` | Learners KPIs + table | Fixtures | New `list_host_learners` RPC |
| `page-marketing` | Promotions / campaigns / promo codes | Fixtures | Defer to P2 (no backend yet) |
| `page-partners` | Affiliate / creator discovery | Fixtures | Defer to P2 |
| `page-opportunities` | High-demand / conversion / fill-capacity cards | Fixtures | Replace with `list_host_opportunities` derived from sessions + bookings |
| `page-analytics` | Funnel + traffic + top listings | Fixtures | Replace with `get_host_analytics` (server-computed aggregates only) |
| `page-earnings` | Available / next payout / pending; tabs Overview/Transactions/Payouts/Refunds/Invoices/Tax/Bank | Fixtures | New `get_host_earnings` view (server-computed) + `list_host_payouts` (manual stub until finance wires) |
| `page-quality` | Trust score + incidents | Fixtures | Derive score from reviews + cancellations via `get_tutor_rating_summary` analog |
| `page-academy` | Lessons progress | Fixtures | Defer (out of scope) |
| `page-settings` | Account/branches/team/security | Fixtures | Branches/team deferred to P2 |

**Drawer/overlays:** `bookingDrawer`, `listingDrawer`, `learnerDrawer`, `messageDrawer`, `bookingDecisionDialog`, `modal`, `notificationPanel`, `toast`. Drawers are intentionally mobile-friendly; must remain visually consistent in production.

**Existing center bridge handlers** (already wired in `page-client.tsx`):
- `tutoria-center-load-tutor-bookings` → `listTutorBookings`
- `tutoria-center-decide-tutor-booking` → `decideTutorBooking`
- `tutoria-center-cancel-tutor-booking` → `cancelTutorBooking`
- `tutoria-center-load-workshop-bookings` → `listWorkshopBookings`
- `tutoria-center-cancel-workshop-booking` → `cancelWorkshopBooking`

**Other UX contract items preserved:** charcoal/gray palette (`#171717` ink, `#747474` muted, `#f5f5f5` bg, `#111` dark), Inter font, dense tables (10–12.5px), pill components, Tailwind CDN, Seller-Center-style sidebar, mobile drawer at ≤1023px, mobile collapse at ≤639px, safe-area-inset padding.

---

## 2. Current backend capabilities

Domain model already in Supabase (see `backend/supabase/migrations/20260819120000_shared_booking_engine.sql`):

- `public.offerings(kind, slug, title, creator_id, unit_price_vnd, publication_status, ...)`
- `public.offering_hosts(offering_id, user_id, capability ∈ {owner, host}, revoked_at)` — the canonical host authorization
- `public.can_manage_offering(actor, offering_id, capability)` — generic host auth primitive
- `public.sessions(offering_id, host_id, status, starts_at, ends_at, min/max_participants, version)`
- `public.bookings(session_id, learner_id, status, pricing_*, version, learner_phone, ...)`
- `public.booking_history` (append-only audit)
- `public.attendance_facts` (outcome ∈ {attended, learner_no_show, host_no_show})
- `public.payments(status ∈ {pending, succeeded, failed, refunded}, refunded_amount_vnd)`
- `public.refunds(kind, status, amount_vnd)`
- `public.get_my_host_bookings()` — host-side booking list
- `public.get_tutor_dashboard(p_user_id)` — host dashboard aggregate (currently scopes by `offerings.creator_id` and `tutor_profiles.user_id`)
- `public.create_session`, `confirm_booking`, `reject_booking`, `cancel_booking`, `record_attendance`, `complete_session` RPCs (from `0005_create_booking_session_rpcs.sql`)
- `public.assert_host_of_session()` — session-level auth fallback

Available HTTP routes (`backend/src/routes/`): `/api/v1/me/tutor-dashboard`, `/api/v1/me/tutor-reviews`, `/api/v1/me/tutor-bookings` (legacy), booking mutations under `/api/v1/tutor/bookings/:id/{confirm,reject,cancel}`, `/api/v1/workshops/{bookings,cancel}`.

---

## 3. Missing backend capabilities (gaps closed by this plan)

| # | Gap | Resolution | Phase |
| --- | --- | --- | --- |
| G-01 | No host-side overview/earnings/analytics summary RPC | `get_host_dashboard(p_user_id)` aggregation | P0 |
| G-02 | No host offerings list endpoint | `list_host_offerings()` + `GET /api/v1/host/offerings` | P0 |
| G-03 | No host sessions list endpoint | `list_host_sessions()` + `GET /api/v1/host/sessions` | P0 |
| G-04 | No host attendees endpoint | `list_host_attendees()` + `GET /api/v1/host/attendees` | P0 |
| G-05 | No host earnings view | `get_host_earnings()` + `GET /api/v1/host/earnings` (server-computed from `payments` + `refunds`) | P0 |
| G-06 | No host analytics summary | `get_host_analytics()` + `GET /api/v1/host/analytics` | P1 |
| G-07 | No generic check-in primitive | New `tickets`/`check_in_tokens`/`check_in_logs` tables + RPCs (`issue_check_in_token`, `redeem_check_in_token`) | P1 |
| G-08 | No `/api/v1/host/*` route module | New `routes/host.ts` mounting all G-01..G-06 endpoints | P0 |
| G-09 | `get_my_tutor_bookings` URL path is `/api/v1/me/tutor-bookings` (tutor-named) | Add host alias routes; keep tutor routes for backward compatibility | P0 (additive) |
| G-10 | `get_tutor_dashboard` is scoped by `tutor_profiles.user_id` only (excludes workshop/event hosts without tutor profile) | Add generalized `get_host_dashboard` using `can_manage_offering` | P0 |

---

## 4. Route map (target)

```
/center                                 → iframe to /center.html (existing UX shell)
                                        → receives postMessage handlers for new host APIs

Backend host surface (new module routes/host.ts):
GET    /api/v1/host/dashboard           → host KPIs, today/upcoming, pending, month earnings, rating
GET    /api/v1/host/offerings           → host's offerings with session count + bookings count + status
GET    /api/v1/host/offerings/:id       → single offering detail with sessions list
GET    /api/v1/host/sessions            → ?from=&to=&offering_id=&status= → sessions grid source
GET    /api/v1/host/attendees           → ?q=&offering_id= → paginated learners
GET    /api/v1/host/earnings            → gross/commission/host_net/transactions/payouts
GET    /api/v1/host/analytics           → ?from=&to= → funnel + capacity utilization
POST   /api/v1/host/check-in/tokens     → issue QR token for a confirmed booking (host-side)
POST   /api/v1/host/check-in/redeem     → redeem token via QR scan (host-side, atomic)
GET    /api/v1/host/check-in/logs       → session attendance log
POST   /api/v1/host/check-in/undo       → undo a check-in (within window, host-only)

Existing tutor-side endpoints remain for back-compat; host endpoints supersede them.
```

---

## 5. Data flow

```
discover/public/center.html (UX shell, fixtures only for prototypes)
        │ postMessage "tutoria-center-load-..."
        ▼
discover/src/app/center/page-client.tsx (bridge)
        │ fetch with bearer access token
        ▼
backend/src/routes/host.ts → SECURITY DEFINER RPCs
        ▼
Supabase Postgres (public.offerings, public.offering_hosts, public.sessions,
                  public.bookings, public.payments, public.refunds,
                  public.tickets, public.check_in_tokens, public.check_in_logs)
```

Authorization rule (server-side, never trust client):

```
auth.uid() must satisfy:
  - is owner/host in public.offering_hosts for at least one offering; OR
  - is profile.role = 'admin'
```

`can_manage_offering(actor, offering_id, capability)` is the canonical primitive; every host-side RPC accepts an optional `p_offering_id` and re-checks scope.

---

## 6. Implementation phases

### Phase 0 — Audit (done)
- Inspected `discover/public/center.html`, `discover/src/app/center/page-client.tsx`, all `backend/supabase/migrations`, all `backend/src/routes`, all `backend/src/services`.
- Mapped existing RPCs (`get_my_host_bookings`, `get_tutor_dashboard`, `can_manage_offering`, `assert_host_of_session`).
- Captured repo-leverage map (see `CENTER_REPO_LEVERAGE.md`).
- Captured data source map (see `CENTER_DATA_SOURCES.md`).

### Phase 1 — P0 backend foundation
1. New migration `20260910000000_host_center_rpcs.sql` adds:
   - `public.get_host_dashboard(p_user_id)` → KPIs + counts
   - `public.list_host_offerings(p_user_id, p_status, p_kind, p_limit, p_offset)`
   - `public.get_host_offering(p_user_id, p_offering_id)`
   - `public.list_host_sessions(p_user_id, p_from, p_to, p_offering_id, p_status, p_limit, p_offset)`
   - `public.list_host_attendees(p_user_id, p_query, p_offering_id, p_limit, p_offset)`
   - `public.get_host_earnings(p_user_id, p_from, p_to)`
   - All `SECURITY DEFINER`, all `set search_path = ''`, all grant to `authenticated` only.
2. New service `backend/src/services/host-center-service.ts` wraps the RPCs with typed shapes.
3. New route module `backend/src/routes/host.ts` exposes `GET /api/v1/host/*` (Fastify pattern mirroring `tutor-dashboard.ts`).
4. Register in `backend/src/app.ts` and wire rate-limit env vars.
5. New typed client `discover/src/lib/host-center-api.ts` mirroring `tutor-dashboard-api.ts`.
6. Extend `discover/src/app/center/page-client.tsx` bridge with handlers for each new endpoint.

### Phase 2 — P1 (check-in + analytics)
1. New migration `20260910000010_check_in_v1.sql`:
   - `public.tickets(id, booking_id unique, attendee_label, status, issued_at, ...)`
   - `public.check_in_tokens(token_hash unique, ticket_id, session_id, expires_at, revoked_at)`
   - `public.check_in_logs(id, ticket_id, token_id, session_id, actor_user_id, outcome, scanned_at)`
   - `public.issue_check_in_token(p_booking_id)` + `public.redeem_check_in_token(p_token, p_outcome)` (atomic, race-safe)
   - `public.undo_check_in(p_log_id, p_reason)` with host capability check
2. Backend routes for issue/redeem/undo/logs.
3. Frontend `host-check-in-api.ts` + bridge handlers.
4. New migration `20260910000020_host_analytics_v1.sql` with `get_host_analytics`.

### Phase 3 — P2 (messaging, bulk, exports, team permissions)
- Messaging hooks already exist (`messaging_alpha_v2`); just need a Center-side "Messages" drawer.
- Bulk actions and CSV export reuse `downloadCSV` already shipped in the prototype.
- Team permissions → requires new tables; out of scope for this PR.

### Phase 4 — QA / evidence
- Browser QA: `discover` dev server, host user logged in, every Center page returns real data, no console errors, no localStorage authoritative state.
- Backend QA: integration tests for `can_manage_offering` isolation (user A cannot read user B's offerings).
- Authorization checks logged via `request_logs`.

---

## 7. Sequencing guardrails

1. **Do not duplicate domain models.** All host RPCs reuse `offerings`, `offering_hosts`, `sessions`, `bookings`, `payments`, `refunds`.
2. **Do not invent financial numbers client-side.** `get_host_earnings` returns server-computed values derived from `payments.amount_vnd` − `payments.refunded_amount_vnd`.
3. **Do not introduce a second QR system.** The same `tickets` + `check_in_tokens` primitives serve workshops, classes, events, and future physical sessions.
4. **Do not bypass RLS.** Every host RPC is `SECURITY DEFINER` and re-checks `can_manage_offering`.
5. **Do not break the prototype.** The iframe continues to render; only the data feeding the visible pages transitions from fixtures to live APIs.

---

## 8. Status snapshot (2026-09-02)

- ✅ Audit complete (`CENTER_REPO_LEVERAGE.md`, `CENTER_DATA_SOURCES.md`).
- ✅ `get_host_dashboard`, `list_host_offerings`, `get_host_offering`, `list_host_sessions`, `list_host_attendees`, `get_host_earnings` RPCs added in `20260910000000_host_center_rpcs.sql`.
- ✅ `services/host-center-service.ts` + `routes/host.ts` added.
- ✅ App.ts wires `hostRoutes`.
- ✅ Frontend `host-center-api.ts` + bridge handlers added.
- ⏳ Check-in primitives (P1) — pending.
- ⏳ Host analytics (P1) — pending.
- ⏳ Migrating prototype pages off in-memory fixtures — pending.