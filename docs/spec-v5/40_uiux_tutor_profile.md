# 40 — UI/UX DETAIL: TUTOR PROFILE + 1:1 BOOKING FLOW (TUT-UX)

**Status:** DETAILED FIELD-LEVEL CONTRACT — grounded in current code (verified 28 Aug 2026).
**Current reality (verified):** the live tutor profile page (`discover/src/app/tutor/[name]/page.tsx` → `discover/src/components/discover/tutor-profile-frame.tsx`) renders an **iframe** (`/tutor-profile-exact.html`) and books through a **`postMessage` bridge** that calls `createBooking(sessionId, participantCount)` / `listBookableSessions`. `price: detail.hourlyRateVnd || 0` (falls back to 0 = "free" when rate missing). **Phone number is captured nowhere** in booking (RPC `create_booking(session_id, count, idempotency_key)` has no phone param; phone only exists as a profile field in `0001_create_profiles.sql`).

**Headline gap (TUT-UX-000):** the booking flow does **not collect the learner's phone number**, does not show a confirmable price before continuing, and the whole profile+booking surface is an unmaintainable iframe, not a native component.

---

## TUT-UX-001 — Tutor profile page (native target, replaces iframe)

Goal: server-backed public profile with a visible, honest Book CTA and a confirmable price.

**Sections (top→bottom)**
1. **Header block** — avatar, full name, verified/`Tutor` badge, headline, location/region + language tags, short intro.
2. **Price card (sticky on desktop side; card on mobile)** — shows **per-hour price** from `hourly_v1` (never `0` from a missing rate — if unset, show "Contact for rate", not "Free"). Sub-elements:
   - `unit price (VND/hour)` — server-resolved.
   - `per-session estimate` = hourly × estimated minutes, server-side, disclosed as estimate.
   - Availability hint (e.g. "2 slots this week").
3. **About / bio**.
4. **Education & experience** (from `tutor_cv*` entries).
5. **Subjects / levels / regions / languages** (chips).
6. **Availability calendar** — selectable future slots (from `list_bookable_sessions`), each slot shows `AVAILABLE` / `BOOKED` / `PAST` / `UNAVAILABLE`.
7. **Reviews** — Post-Alpha by default (`REV-010`); show placeholder only if promoted via `DEC-007`.

**Booking CTA (TUT-UX-002)**
- Desktop: `Book a session` button in the price card.
- Mobile: sticky bottom bar (reuse `MobileBookingBar` pattern) with price label + `Book a session`.
- Disabled states: no available slots (`No availability`), not-published (`Unavailable`), logged-out → button routes to sign-in and **returns to this profile with the chosen slot preselected** (`WORK`-style return).
- **Price visibility rule:** the CTA must show the resolved price and a `Session starts at HH:MM (GMT+7)` line before the user commits — never a blank/0 price.

---

## TUT-UX-003 — Booking flow (slot → contact → price → confirm)

A **callout box / modal / bottom-sheet** (choose `DEC-002`-style pattern) with these steps, in order:

### Step 1 — Confirm session
- Selected date + time (from availability), timezone `Asia/Ho_Chi_Minh` (GMT+7).
- **Price disclosure:** unit price, quantity=1, subtotal, `server total` (must come from server `resolve_booking_pricing`, **not** `hourlyRateVnd || 0`).
- "You won't be charged yet" reassurance (reuse `booking-cta.tsx` copy).

### Step 2 — Contact details (REQUIRED FIELDS)
> This is the step that is **currently missing**. It captures the learner's contact so the host/tutor can reach them (a hard requirement for a Vietnam tutoring booking).

| Field | Type | Required | Validation | Persist to |
|---|---|---|---|---|
| Full name | text | ✅ | 2–80 chars | `profiles.name` |
| **Phone number** | tel (VN format) | ✅ | `VN` regex `^(\+84|0)\d{9}$` (normalize to `+84…`); must be server-validated | `bookings.phone`/`learner_phone` (new) **or** `profiles.phone` |
| Email (prefill from account) | email | ✅ | valid format | account + `bookings` |
| Note to tutor (optional) | textarea | ⬜ | ≤ 500 chars | `bookings.note` (new) |

- **Data model impact:** add **`bookings.learner_phone`** (single contact snapshot at booking time, host-of-session-only RLS). `RPC create_booking` must gain a contact param (e.g. `p_learner_phone`), or a separate `set_booking_contact` RPC. **RESOLVED via `DEC-013` (28 Aug 2026): phone on the booking row, RLS host-of-session only.**
- **Privacy:** phone is shown to **host/tutor of that booking only** (never public, never in discovery), enforced by RLS (`SEC-010`).

### Step 3 — Payment
- `hourly` price snapshot → `createBooking`/payment intent → VNPay redirect (reuse `PAY-010`).
- **Price stays server-authoritative** client never edits.

### Step 4 — Confirm + receipt
- Booking `confirmed` (or `requested`/`held` per mode) → `/bookings/[id]` (`LEARN-002`).

## Per-state enums (booking form)

`TUT-UX-010` — Session slot: `AVAILABLE` / `BOOKED` / `PAST` / `UNAVAILABLE` / `LOADING`.
`TUT-UX-011` — Contact step: `INITIAL` / `VALIDATION` / `SAVING` / `SERVER ERROR` / `SAVED`.
`TUT-UX-012` — Price line: `UNSET` (→ show "Contact for rate", never "Free") / `LOADING` / `RESOLVED` (server total).
`TUT-UX-013` — CTA: `OPEN` / `NO AVAILABILITY` / `AUTH REQUIRED` / `SELF (host)` / `PAYMENT EXPIRED`.

---

## TUT-UX ACCEPTANCE

- `AC-TUT-UX-001` — Tutor profile shows a server-resolved per-hour price and a `Book a session` CTA (native, not iframe).
- `AC-TUT-UX-002` — Booking form collects **required phone number** (VN format) + name + email before payment, and it reaches the host securely.
- `AC-TUT-UX-003` — Price shown to the learner before commit is the **server total**, never a `|| 0` free fallback.
- `AC-TUT-UX-004` — Phone is visible only to the booking's host/tutor (RLS), never public.
- `AC-TUT-UX-005` — Logged-out user is returned to the profile with slot preselected after sign-in.

## TUT-UX RTM

| Req ID | Req | Impl (verified) | DB/RPC | Test | Acceptance |
|---|---|---|---|---|---|
| TUT-UX-001 | native profile + price card | `tutor-profile-frame.tsx` (replace iframe) | `get_offering`/`hourly_v1` | `TST-tut-*` | `AC-TUT-UX-001` |
| TUT-UX-002 | Book CTA + return-with-slot | `booking-cta.tsx` pattern | — | `RTM2-mobile` | `AC-TUT-UX-005` |
| TUT-UX-003 step2 | **phone + name + email required** | booking form (new) | `create_booking` + phone param | `TST-contact` | `AC-TUT-UX-002` |
| TUT-UX-003 step1/3 | server price + pay | `price-summary.tsx`, pay | `resolve_booking_pricing` | `TST-price` | `AC-TUT-UX-003` |
| TUT-UX-004 | phone privacy (host-only) | RLS | RLS policy | `TST-leak` | `AC-TUT-UX-004` |

**Decision:** `DEC-013` **RESOLVED** — persist phone on the booking row `bookings.learner_phone`, host-of-session-only RLS, snapshot at booking time. `DEC-014` **RESOLVED** — booking form is an **inline sheet/modal** on the tutor profile page (not a separate `/bookings/new` route).
