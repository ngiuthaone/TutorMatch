# 07/01 — WORKSHOP CONTRACT (WORK)

**Surface:** Workshop discovery, detail, creator/editor, host listing management (Workshop = Alpha core money loop).
**Alpha status:** ALPHA CORE. Real Host + real Learner must complete the workshop money loop end-to-end with authoritative state.
**Primary evidence:** `discover/src/components/workshop/*`, `workshop-detail-page.tsx:214`, `discover/src/lib/workshop-booking-api.ts`, `events-live/[slug]/page.tsx:30` (detail kind-comparison bug — `!== "event"` on a workshop surface), `published-event-store.ts` (localStorage creator).

---

## 01.1 PAGES

### WORK-001 — Workshop listing (`/events-live` or final route TBD `DEC-*`)
- **Existence:** Base listing exists. Target: live server-rendered list from real offerings+workshops.
- **Data source:** `get_public_offering_metadata` / public listings RPC. No auth required.
- **Fields shown:** thumbnail, title, live/upcoming, host name, price, start date, capacity state.
- **Filter/sort:** category, date, price, upcoming (see `SCH-*`). Default "Upcoming & bookable".
- **States:** `INITIAL` (loading skeleton), `EMPTY` (no workshops), `ERROR` (server/RPC), `AUTH REQUIREMENT` n/a (public).
- **Mobile:** card grid → single-column on <640px; thumbnail-first.

### WORK-002 — Workshop detail (`/workshops/[slug]` canonical; `/events-live/[slug]` broken)
- **Bug gate:** fix `discover/src/app/events-live/[slug]/page.tsx:30` — it checks `offeringData.offeringType !== "event"`, but the `events-live` surface serves **workshop** offerings (`offeringType === "workshop"`), so workshop detail always shows "Event not found". The `offeringType` field is real; only the comparison kind is wrong for this surface. `WORK-002-BUG-1` (`REAL-009`).
- **Data source:** public offering+session detail RPC `get_offering_detail` (pricing resolved, capacity current, host public profile).
- **Sections:** hero (title, thumbnail, live, price), schedule (sessions), capacity (available/limit + `SOLD OUT`), host card (link to tutor profile), booking CTA, prerequisites/materials, reviews (Post-Alpha).
- **Booking CTA behavior:**
  - Logged-in eligible & session open → `BOOK` (route to `/bookings/new?offering=...&session=...` or inline dialog per `DEC-*`).
  - Not logged in → CTA routes to sign-in, then returns to this detail with session preselected.
  - Session full → `SOLD OUT` (disabled, no fake inline ledger).
  - Request-only booking mode → custom CTA (`Request to join`), not `BOOK` seat.
  - Host = self → show manage link, not `BOOK`.
- **States per session tile:** `INITIAL`, `LOADING` (capacity fetch), `OPEN` (available), `SOLD OUT` (full), `CANCELLED` (session cancelled), `PAST` (ended), `AUTH REQUIRED` (CTA needs login), `UNAVAILABLE` (booking disabled pre-launch).
- **Mobile:** accordion schedule; CTA sticky bottom on mobile.

### WORK-003 — Workshop creator/editor (Host)
- **Bug gate:** current persists via `published-event-store.ts` (localStorage), not `create_offering`/`create_session`. `WORK-003-BUG-1` (`REAL` host-write gap). Alpha requirement: creator writes real `offerings` + `sessions` rows (`offering_kind='workshop'`), persisted server-side, host-owned.
- **Steps (Alpha scope):** basics (title, kind=workshop, thumbnail, description), schedule (start/end, capacity, min participants, public start), pricing model selection (`flat_per_participant_v1`; per-session price snapshot), publishing (publication_status → draft/published; `publication_policy` respects it), review.
- **States:** `INITIAL`, `DRAFT` (unpublished), `PUBLISHED`, `SERVER SAVED`, `SERVER ERROR`, `VALIDATION`, `AUTH REQUIRED` (not host), `OWNERSHIP` (not creator).
- **Permission:** only the creating host (`creator_id`, `offering_hosts` membership) may edit. RLS enforces.
- **Naming/route:** canonical to be finalized `DEC-*`; today `/events/new` (broken). Alpha canonical suggestion `/host/workshops/new` (`DEC-*`).

### WORK-004 — Host workshop management list
- For host's own workshops: list + per course state (draft/published/live), capacity, earnings, edit/manage, "view public".
- Owned via Host Center (`05_host_center.md`); `WORK-004` is the workshop-specific subset view.

---

## 01.2 COMPONENTS

| WORK-0xx | Component | States | Data |
|---|---|---|---|
| WORK-010 | WorkshopCard | live/upcoming/sold-out/past | public listing row |
| WORK-011 | WorkshopScheduleList | per-session states (above) | sessions + capacity |
| WORK-012 | WorkshopBookingCTA | BOOK / REQUEST / SOLD OUT / AUTH REQUIRED / SELF | eligibility |
| WORK-013 | HostCard | present | host public profile |
| WORK-014 | WorkshopDetailHero | loading/loaded | offering + thumbnail |
| WORK-015 | WorkshopCreateForm | draft/saved/error/validation | create_offering/create_session |
| WORK-016 | CapacityBadge | open/low/full | capacity RPC |

## 01.3 INTERACTIONS

- `WORK-030` — Booking from detail: select session → reserve/pay → confirm. Multi-step state machine shared with `BOOK-*`. (See `03_booking.md`.)
- `WORK-031` — Capacity refresh: re-fetch capacity on selection; never show stale seat availability that contradicts server.
- `WORK-032` — Publish: draft↔published; only published appears in public listing.
- `WORK-033` — Edit ownership guard: non-owner edit attempt → 403 + read-only view.

## 01.4 API / RPC / DB (owner refs; full contracts in 11–14)

| Req | Contract owner | Notes |
|---|---|---|
| `WORK-040` | `GET workshopPublic(slug)` | public detail; pricing resolved server-side |
| `WORK-041` | `POST createOffering` / `create_offering` | host mutation; drafts allowed; session child |
| `WORK-042` | `PUT updateOffering` / RPC | host ownership enforced |
| `WORK-043` | `POST publishOffering` | publication_status update; validates pre-publish |
| `WORK-044` | `DELETE offering` | soft/Audit state transition per `DEC-*` |

## 01.5 ACCEPTANCE CRITERIA

- `AC-WORK-001` — A not-logged-in user sees workshop detail + capacity + price.
- `AC-WORK-002` — Logging in from a workshop CTA returns the user to the same workshop with session preselected.
- `AC-WORK-003` — A full workshop shows `SOLD OUT`; a free seat in a non-full workshop shows an enabled book CTA backed by the server capacity.
- `AC-WORK-004` — Host can persist a workshop to real `offerings`+`sessions` and publish it so it appears in the public list (replaces localStorage creator).
- `AC-WORK-005` — `events-live/[slug]` detail bug fixed (compares to `"event"` while serving `workshop`); detail never shows false "Event not found" (`REAL-009`).
- `AC-WORK-006` — Non-owner cannot edit/publish another host's workshop (RLS + backend 403).

---

## 07/01 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| WORK-001 | Workshop listing (public, server-backed) | workspace listing page | `get_public_offering_metadata` | `TST-work-list` | `AC-WORK-001` | §22 |
| WORK-002 | Workshop detail + capacity/price | `workshop-detail-page.tsx` | `get_offering_detail` | `WORK-E2E` | `AC-WORK-003` | `REAL-008/009` |
| WORK-002-BUG-1 | Fix detail kind comparison (`!== "event"` on a workshop surface) | `events-live/[slug]/page.tsx:30` | — | `TST-work-bug` | `AC-WORK-005` | `REAL-009` |
| WORK-003 | Creator persists real Offering/Session | creator route | `create_offering`,`create_session` | `TST-work-create` | `AC-WORK-004` | `REAL` gap |
| WORK-004 | Host workshop management | host center | list RPC | `TST-host-*` | `AC-WORK-004` | — |
| WORK-030 | Booking flow integration | booking lib | `create_booking` | `E2E-*` | `AC-WORK-003` | §03 |
| WORK-033 | Edit ownership guard | creator | RLS | `TST-work-acl` | `AC-WORK-006` | §15 |
