# PRD-001 — Booking + Learner Contact Capture (P0)

**Status:** DRAFT v0.1 — requests review before implementation.
**Feature alignment:** P0 release-blocker. Resolves `GAP-023` / `AUD-001` / `AUD-002`. Depends on resolved decisions `DEC-013` (phone on `bookings.learner_phone`, host-of-session-only RLS) and `DEC-014` (inline sheet/modal on the detail page).
**Spec anchors:** `40_uiux_tutor_profile.md`, `41_uiux_workshop_booking.md`, `06_learner.md`, `03_booking.md`, `13_database.md`, `14_rpc.md`, `15_security.md`, `11_api_contract.md`, `28_test_contract.md`.

---

## 1. Problem

**Today the booking flow collects NO customer contact.** Verified:
- `bookings` table has no phone/contact column (`0004_create_sessions_and_bookings.sql:23-35`); `phone` exists only on `profiles` (`0001:11`) and is never collected at booking.
- `create_booking(session_id, participant_count, p_idempotency_key)` has no contact param (`20260820100001_workshop_booking_v1_rpcs.sql:9-13`).
- Frontend `createBooking/`createWorkshopBooking` send only `(sessionId, participantCount)`.
- The tutor-booking UI is an iframe `postMessage` bridge, and price falls back to `hourlyRateVnd || 0` (`tutor-profile-frame.tsx:121`) — learners can see a fake "free" price.

**Consequence (product impact):** a host/tutor cannot reach the learner after booking to confirm, coordinate, or deliver. A Vietnam-first tutoring marketplace **cannot be production-ready** until booking captures reachable contact. This is the top release blocker.

## 2. Goals / Non-goals

**Goals**
- Capture **required** learner contact (name, phone, email) at booking time, once, in a single inline sheet/modal.
- Persist it server-side as a booking-time **snapshot** (survives later profile edits).
- Expose it only to the **host/tutor of that session**; never public (RLS).
- Show a **server-authoritative price** (never `0`/free fallback) before the learner commits.
- Apply equally to **1:1 (hourly) and workshop (flat_per_participant)** bookings via the shared engine.

**Non-goals (this PRD)**
- Real-time messaging between learner and host.
- Editing phone after payment lock (see §7 future).
- Notifications / email delivery of contact (deferred `GAP-027`).
- The auth required to reach booking (covered by existing auth).

## 3. User stories

- **US-1 (Learner, paid 1:1):** As a learner I choose a tutor slot, am shown the server-total price, enter my name/phone/email in a sheet, pay, and land on a confirmed `/bookings/[id]` where my contact is shown back to me.
- **US-2 (Learner, workshop):** same flow with participant count + per-head price.
- **US-3 (Host/tutor):** As the host I see the learner's phone/name/email on my booking (and nowhere else) so I can coordinate delivery.
- **US-4 (Privacy):** As a learner I know my phone is visible only to that host.

## 4. Requirements (functional)

### 4.1 Booking request
| ID | Requirement |
|---|---|
| FR-1 | Booking form gathers **full name** (2–80 chars), **phone** (VN format, required), **email** (required, prefilled from account), optional **note** (≤500). |
| FR-2 | Phone validated **server-side**: normalize `^(\+84\|0)\d{9}$` → `+84…`; reject otherwise with a clear field error. |
| FR-3 | Contact is persisted on the booking row as `bookings.learner_phone` (+ names note/email) at booking creation time (snapshot). |
| FR-4 | Email defaults from the authenticated profile; learner may change it on the form.
| FR-5 | Same flow applies to 1:1 and workshop bookings (shared engine `create_booking`). |

### 4.2 Price integrity
| ID | Requirement |
|---|---|
| FR-6 | The pre-commit price is the **server-total** from `resolve_booking_pricing(session_id, participant_count)`. Never `hourlyRateVnd || 0`. |
| FR-7 | If the server cannot resolve a price, show `UNSET` → "price on confirmation" (or block booking), **never** a zero/free value. |
| FR-8 | Price is immutable for the created booking; payment uses the resolved `amount_vnd` snapshot. |

### 4.3 Authorization & privacy (RLS)
| ID | Requirement |
|---|---|
| FR-9 | `bookings.learner_phone` is readable **only by the booking's learner (owner) and the session's host**. Not public, not searchable, not on any discovery surface. |
| FR-10 | The RPC that sets contact and the column write are covered by RLS; the read-model (`get_booking_detail`) returns contact only to owner/host, else `FORBIDDEN`. |
| FR-11 | No contact is ever emitted in public listing/profiles/search payloads. |

### 4.4 Form/UX (inline sheet/modal, `DEC-014`)
| ID | Requirement |
|---|---|
| FR-12 | Booking CTA opens an **inline sheet/modal** on the detail page (not a `/bookings/new` route). Steps: (1) session & qty → (2) contact → (3) pay → (4) confirmed. |
| FR-13 | Step 2 shows required fields with inline validation and clear errors; disabled submit until valid. |
| FR-14 | Step 2 persists contact only on submit together with booking creation (single atomic write). |
| FR-15 | Confirmation lands on `/bookings/[id]` (fixes `BLK-001`); contact shown back + editable only pre-payment. |

## 5. Acceptance criteria (AC)

| ID | Criterion |
|---|---|
| AC-1 | Booking with valid VN phone persists `learner_phone` on the booking row and appears on the host's booking detail. |
| AC-2 | Booking with an invalid phone (e.g. `123`) is rejected server-side with a field error; nothing creates. |
| AC-3 | A learner sees the server-total and it equals the charged `amount_vnd`; no `0`/free fallback ever renders. |
| AC-4 | Non-owner, non-host attempting to read a booking's contact gets `FORBIDDEN`; contact is absent from all public payloads. |
| AC-5 | 1:1 and workshop bookings both collect contact through the same sheet. |
| AC-6 | After payment, learner lands on `/bookings/[id]` and sees their contact; edit disabled post-payment. |

## 6. Data & RPC changes (implementation spec)

- **Migration:** `ALTER TABLE bookings ADD COLUMN learner_phone text NULL; ADD learner_name text; ADD learner_email text; ADD learner_note text NULL;` + constraint `learner_phone_valid` (null or normalized VN), len bounds. (Historically preserves invariant via constraint, not application logic only.)
- **RPC:** extend canonical `create_booking(session_id, participant_count, p_idempotency_key, p_learner_name text, p_learner_phone text, p_learner_email text, p_learner_note text)` — validate phone server-side, write columns, return booking + resolved price.
- **RLS:** policy on `bookings` — `learner_id = auth.uid() OR session.host_id = auth.uid()` for the contact columns.
- **Frontend:** booking sheet component + `create_booking` call updated to send contact; `price-summary` uses server total.
- **Detail route:** `/bookings/[id]` shows contact to owner/host.

## 7. Open questions / risks

| Item | Note |
|---|---|
| OQ-1 | Should phone be editable by the learner post-payment on the detail page? Draft: no (snapshot). Decide via owner if needs change. |
| OQ-2 | Email is used for confirmation delivery only once `GAP-027` (notifications) is built; until then stored, not sent. |
| RISK | Adds PII on bookings — ensure `TST-leak` asserts no contact in public paths; RLS review (`tutoria-rls-review`). |

## 8. Traceability

| PRD req | Spec anchor | Audit | Status |
|---|---|---|---|
| FR-1..5 | `TUT-UX-002/003`, `BOOK-UX-002`, `LEARN-002` | `AUD-001`, `GAP-023` | P0 |
| FR-6..8 | `TUT-UX-003`, `BOOK-UX-003` | `AUD-002` | P0 |
| FR-9..11 | `15_security`, `TST-leak` | `AUD-001` | P0 |
| FR-12..15 | `DEC-014`, `LEARN-030` | `BLK-001` | P0 |

**Definition of done:** AC-1..6 pass; `TST-contact`, `TST-price`, `ITST-*`; `qa_browser` preflight executed; RLS reviewed; no contact in public payloads.
