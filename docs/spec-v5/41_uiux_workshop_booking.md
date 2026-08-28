# 41 — UI/UX DETAIL: WORKSHOP BOOKING FLOW + LEARNER BOOKING DETAIL (BOOK-UX)

**Status:** DETAILED FIELD-LEVEL CONTRACT — grounded in current code (verified 28 Aug 2026).
**Current reality (verified):** the workshop booking CTA is a shell button (`discover/src/components/shared/booking-cta.tsx` — desktop CTA + `MobileBookingBar` bottom bar with price/session label + "You won't be charged yet"). Quantity/price presentational components exist (`participant-quantity.tsx`, `price-summary.tsx`) but are **not wired into a phone/contact step**. `createWorkshopBooking(sessionId, participantCount)` takes **only session + count — no phone, no contact**. `/bookings/[id]` route is missing (`BLK-001`).

**Headline gaps (BOOK-UX-000):** (1) no phone/contact capture in the workshop booking flow; (2) the multi-step booking sheet/flow that should hold the form isn't implemented as a coherent native flow; (3) post-booking route is a 404.

---

## BOOK-UX-001 — Workshop detail → booking entry

**CTA layer (reuses `booking-cta.tsx`):**
- Desktop: primary `Book workshop` button in the price/action card; mobile: `MobileBookingBar` bottom bar (price + session + button).
- CTA states: `OPEN` (has free seats + session open) · `SOLD OUT` (disabled) · `AUTH REQUIRED` (→ sign-in, return with session preselected) · `SELF (host)` → manage link · `PAYMENT EXPIRED` (re-initate). 
- Reassurance copy ("You won't be charged yet") retained.

## BOOK-UX-002 — Booking sheet/modal steps (the main missing form)

A native sheet/modal (or `/bookings/new` route per `DEC-002`) with explicit steps:

### Step 1 — Session & quantity
- Session picker: `AVAILABLE` / `SOLD OUT` / `CANCELLED` / `PAST`.
- Quantity stepper (`participant-quantity.tsx`): min = session min, max = session max (hard cap 100), server-checked.
- **Price preview:** `price-summary.tsx` — subtotal only when multi-participant; **server total** from `resolve_booking_pricing`; `UNSET` state must show "price on confirmation", never fake-zero.

### Step 2 — Contact details (REQUIRED — currently missing)
| Field | Type | Req | Validation | Persist |
|---|---|---|---|---|
| Full name | text | ✅ | 2–80 | `profiles.name` |
| **Phone number** | tel (VN) | ✅ | `^(\+84|0)\d{9}$` → normalize `+84…`; server-validate | booking (new) |
| Email | email | ✅ | format | account + booking |
| Attendee note (optional) | text | ⬜ | ≤ 500 | booking (new) |

- **Host visibility:** phone/email shown only to the host of that session (`SEC-010`, RLS); never public.
- **Data-model impact:** extend the booking with a contact field — `createWorkshopBooking` must pass it. **RESOLVED via `DEC-013` (28 Aug 2026): phone on the booking row `bookings.learner_phone`, host-of-session-only RLS.**

### Step 3 — Payment
- Server price snapshot → payment intent/VNPay (`PAY-010`); amount immutable, server-authoritative.

### Step 4 — Confirm
- On success → **`/bookings/[id]`** (`LEARN-002`, fixes `BLK-001`).

## BOOK-UX-003 — Learner booking detail (`/bookings/[id]`, new route)

A genuinely detailed receipt/manage page (states `CONFIRMED`/`PENDING PAYMENT`/`PAYMENT EXPIRED`/`CANCELLED`+reason/`COMPLETED`):

- **Summary card** — offering title, session date/time (GMT+7), participant count, per-unit + subtotal + **server total**, payment status badge, booking id/ref.
- **Contact reminder** — the phone/name captured at booking, shown back to the learner (editable pre-payment).
- **Actions** — Pay now (pending/expired), Cancel (version-guarded, `cancelLearnerBooking(bookingId, expectedVersion, reason)` → refund obligation), Download receipt (when paid), Session join info (at session time).
- **States** — `INITIAL` / `FORBIDDEN` (non-owner/host) / `NOT_FOUND` (friendly 404) / `ERROR`.

## Per-state enums

`BOOK-UX-010` — Sheet step: `SELECT` / `CONTACT` / `PAY` / `CONFIRMED` / `PAYMENT EXPIRED` / `ERROR`.
`BOOK-UX-011` — Contact step: `INITIAL` / `VALIDATION` / `SAVING` / `SERVER ERROR`.
`BOOK-UX-012` — Price: `UNSET` / `LOADING` / `RESOLVED` (server) .
`BOOK-UX-013` — CTA: `OPEN` / `SOLD OUT` / `CANCELLED` / `AUTH REQUIRED` / `SELF`.

---

## BOOK-UX ACCEPTANCE

- `AC-BOOK-UX-001` — Workshop booking CTA clearly shows open/sold-out and price.
- `AC-BOOK-UX-002` — Flow collects **required phone + name + email** before payment, validated VN-format server-side.
- `AC-BOOK-UX-003` — Quantity-limited to session capacity; server total shown before commit.
- `AC-BOOK-UX-004` — Post-payment lands on `/bookings/[id]` (fixes `BLK-001`).
- `AC-BOOK-UX-005` — Phone/contact visible only to the host of that session (RLS), never public.

## BOOK-UX RTM

| Req ID | Req | Impl (verified) | DB/RPC | Test | Acceptance |
|---|---|---|---|---|---|
| BOOK-UX-001 | CTA + mobile bar states | `booking-cta.tsx` | session/capacity | `E2E` | `AC-BOOK-UX-001` |
| BOOK-UX-002 step2 | phone+name+email required | sheet (new) | `create_booking` + contact | `TST-contact` | `AC-BOOK-UX-002` |
| BOOK-UX-002 step1/3 | qty + server total | `participant-quantity.tsx`,`price-summary.tsx` | `resolve_booking_pricing` | `TST-price` | `AC-BOOK-UX-003` |
| BOOK-UX-003 | detail route + actions | `app/bookings/[id]` (new) | `booking_read_json`, cancel RPC | `TST-learn-detail` | `AC-BOOK-UX-004` |
| BOOK-UX | contact privacy | RLS | policy | `TST-leak` | `AC-BOOK-UX-005` |

**Decision:** `DEC-013` **RESOLVED** — persist `bookings.learner_phone`, host-of-session-only RLS. `DEC-014` **RESOLVED** — booking form is an **inline sheet/modal** on the workshop detail page (not a `/bookings/new` route).
