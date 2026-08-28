# 07/06 — LEARNER CENTER / BOOKINGS CONTRACT (LEARN)

**Surface:** learner's booking list + booking detail, invoices/receipts, learning entry points.
**Alpha status:** ALPHA CORE — the learner must be able to see and act on their bookings after purchase.
**Primary evidence:** `discover/src/app/bookings/` (no `[id]`), `workshop-detail-page.tsx:214` redirect to `/bookings/[id]`, `discover/src/lib/booking-api.ts`.

---

## 06.1 PAGES

### LEARN-001 — Bookings list (`/bookings`)
- **Existence:** exists.
- **Data source:** `get_my_bookings` RPC (auth.uid()).
- **Contents:** each booking: course/session title, date, price, status (requested/confirmed/cancelled/completed + payment state), CTA → detail.
- **Tabs/filter (Alpha):** Upcoming / Past / Cancelled / Requests.
- **States:** `INITIAL` (loading), `EMPTY` (no bookings yet + CTA to discover), `ERROR`, `AUTH REQUIRED`, `NOT_FOUND` n/a.
- **Mobile:** card list, status badge, primary action button.

### LEARN-002 — Booking detail (`/bookings/[id]`) — **BLK-001 / missing**
- **Existence:** **MISSING (404)** — this is `BLK-001`. `workshop-detail-page.tsx:214` redirects the learner here after booking, so it must exist.
- **Route:** `discover/src/app/bookings/[id]/page.tsx` (Next.js).
- **Data source:** `get_booking_detail(id)` RPC, auth.uid() filter — a user can only read their own (or host involved).
- **Contents:** offering/session summary, participant count & price snapshot, payment status (pending/succeeded/refunded), booking status, host contact (per contact policy `SEC-*`), actions: Pay now (if pending), Cancel (per policy), Download receipt/invoice, Session join info (at time of session, if applicable).
- **States:** `INITIAL`, `LOADING`, `CONFIRMED` (+payment state), `PENDING PAYMENT`, `PAYMENT EXPIRED`, `AUTH REQUIRED`, `CANCELLED` (+ `HOST CANCELLED` / `REFUND PENDING` / `REFUNDED`), `COMPLETED`, `ERROR`, `NOT_FOUND` (404 with friendly message), `FORBIDDEN`.
- **Mobile:** summary card top, actions as full-width buttons.

## 06.2 COMPONENTS

| LEARN-0xx | Component | States | Data |
|---|---|---|---|
| LEARN-010 | BookingCard | status badge + cta | booking row |
| LEARN-011 | BookingStatusBadge | requested/confirmed/completed/cancelled/rejected + payment | status |
| LEARN-012 | BookingPaymentSection | pending/expired/succeeded/refunded | payment status |
| LEARN-013 | CancelButton | enabled/disabled/confirm | policy |
| LEARN-014 | ReceiptView | generated request | receipt doc |

## 06.3 INTERACTIONS

- `LEARN-030` — Post-purchase redirect lands on `/bookings/[id]` (`BLK-001` fixed); page reflects confirmed state.
- `LEARN-031` — Cancel flow: confirm dialog → `cancel` (domain policy `DEC-*`) → if paid → refund obligation created (see `04_payment.md`), state reflects `REFUND PENDING` → `REFUNDED`.
- `LEARN-032` — Pay-again: if payment expired/pending, re-initiate checkout (idempotent; never a second charge for same booking unless new attempt).
- `LEARN-033` — Only the owner (or host of the session) reads this detail; others get `FORBIDDEN`.

## 06.4 API / RPC / DB (owner refs)

| Req | Contract owner | Notes |
|---|---|---|
| `LEARN-040` | `GET /bookings` → list | `get_my_bookings` |
| `LEARN-041` | `GET /bookings/[id]` → detail | `get_booking_detail`; 403/404 handling |
| `LEARN-042` | `POST /bookings/[id]/cancel` | cancel RPC |
| `LEARN-043` | `POST /bookings/[id]/pay` | re-init checkout |

## 06.5 ACCEPTANCE CRITERIA

- `AC-LEARN-001` — A logged-in learner lands on `/bookings/[id]` after payment and sees their confirmed booking (fixes `BLK-001`).
- `AC-LEARN-002` — A user cannot read another user's booking detail (`FORBIDDEN`).
- `AC-LEARN-003` — A pending-payment booking with expired TTL shows `PAYMENT EXPIRED` and can be re-initiated.
- `AC-LEARN-004` — Cancel of a paid booking creates a refund obligation and reflects `REFUND PENDING → REFUNDED` on refresh (server truth).
- `AC-LEARN-005` — Empty state shows valid CTA to first discover workshops.

---

## 07/06 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| LEARN-001 | Bookings list | `app/bookings/page.tsx` | `get_my_bookings` | `E2E-learn-list` | `AC-LEARN-005` | exists |
| LEARN-002 | Booking detail `[id]` | `app/bookings/[id]/page.tsx` (new) | `get_booking_detail` | `TST-learn-detail` | `AC-LEARN-001` | BLK-001 |
| LEARN-031 | Cancel→refund obligation | detail + pay | cancel,refunds | `ITST-cancel` | `AC-LEARN-004` | §04/§16 |
| LEARN-032 | Re-init checkout | detail | checkout | `E2E-pay` | `AC-LEARN-003` | — |
| LEARN-033 | Ownership guard | detail api | RLS | `TST-learn-acl` | `AC-LEARN-002` | §15 |
