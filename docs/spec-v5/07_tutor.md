# 07/07 — TUTOR SYSTEM CONTRACT (TUT)

**Surface:** tutor profile, CV/identity, availability, tutor booking loop (1:1 sessions, hourly), tutor discoverability, earnings.
**Alpha status:** ALPHA CORE (second money loop: a real Tutor + real Learner complete the tutor booking loop). Full tutoring marketplace Post-Alpha.
**Primary evidence:** `discover/src/lib/tutor-booking-api.ts`, `discover/src/lib/tutor-cv-api.ts`, `tutor_profiles`/`tutor_availability_slots`/`tutor_education|experience_entries` (CAS versioned), root `tutor-v1` fixtures.

---

## 07.1 PAGES

### TUT-001 — Tutor profile (`/tutor/[slug]`)
- **Existence:** hybrid/fixture. Target: server-backed public profile.
- **Data source:** public tutor profile RPC (public fields only — never auth id, private contact, exact address).
- **Sections:** header (name, headline, avatar), bio/about, CV/teaching areas (from tutor_cv*), availability calendar, price (hourly_v1), booking CTA.
- **States:** `INITIAL`, `LOADED`, `NOT_FOUND`, `FORBIDDEN` n/a (public), `EMPTY` (no profile yet = "tutor profile not published").
- **Mobile:** stack; sticky booking CTA.

### TUT-002 — Tutor CV / profile editor (host side)
- **Data source:** `tutors.user_id` filter; CAS version column prevents clobber.
- **Sections:** identity/bio, education entries, experience entries, subjects/levels/regions/languages, availability slots, price, publish.
- **States:** per section server-saved/error/validation; `DRAFT`↔`PUBLISHED`.

### TUT-003 — Tutor booking (1:1, hourly)
- Uses the **shared booking engine** (`03_booking.md`) with `hourly_v1` pricing and a session as the bookable unit.
- **States:** same as BOOK + per-slot `AVAILABLE`/`BOOKED`/`UNAVAILABLE`/`PAST`.

### TUT-004 — Tutor availability
- Availability slots persisted server-side; conflicts rejected; CAS to avoid double-book.

## 07.2 COMPONENTS

| TUT-0xx | Component | States | Data |
|---|---|---|---|
| TUT-010 | TutorProfileHeader | loading/loaded/404/empty | public profile |
| TUT-011 | TutorCVSection | loaded/empty | tutor_cv* |
| TUT-012 | AvailabilityCalendar | per-slot states | availability |
| TUT-013 | TutorBookingCTA | BOOK/SOLD/BUSY/UNAVAILABLE/AUTH | eligibility |
| TUT-014 | PriceBadge | loaded | price hourly |

## 07.3 INTERACTIONS

- `TUT-030` — Booking: pick available slot → shared `create_booking` (hourly) → payment → confirm.
- `TUT-031` — Double-booking a slot rejected atomically (CAS + availability check in transaction).
- `TUT-032` — Publish CV/profile swings public visibility; private fields never exposed.

## 07.4 API / RPC / DB (owner refs)

| Req | Contract owner | Notes |
|---|---|---|
| `TUT-040` | `GET /tutor/[slug]` | public tutor profile RPC |
| `TUT-041` | `POST/PUT tutorCv` | tutor CV CAS update |
| `TUT-042` | `PUT availability` | slot crud; conflict-safe |
| `TUT-043` | booking | shared `create_booking` |

## 07.5 ACCEPTANCE CRITERIA

- `AC-TUT-001` — Public tutor profile shows only public fields (`REAL` privacy rule).
- `AC-TUT-002` — A learner can book an available 1:1 slot through the shared engine and pay.
- `AC-TUT-003` — Concurrent booking of the same slot cannot double-book.
- `AC-TUT-004` — Tutor can publish/unpublish CV; unpublished not publicly visible.
- `AC-TUT-005` — CAS prevents clobber of a newer CV edit.

---

## 07/07 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| TUT-001 | Public tutor profile | `app/tutor/[slug]` | public profile RPC | `E2E-tut` | `AC-TUT-001` | privacy rule |
| TUT-002 | CV editor (CAS) | `tutor-cv-api.ts` | tutor_cv* | `TST-cv-cas` | `AC-TUT-005` | — |
| TUT-003 | 1:1 booking (shared) | `tutor-booking-api.ts` | create_booking hourly | `E2E-tut-book` | `AC-TUT-002` | §03 |
| TUT-031 | Slot double-book reject | booking engine | RPCCAS | `ITST-slot` | `AC-TUT-003` | §03 |
| TUT-032 | Publish toggle | CV editor | publication | `TST-tut-pub` | `AC-TUT-004` | — |
