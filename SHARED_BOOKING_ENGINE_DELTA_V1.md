# Shared Booking Engine Delta V1

**Baseline:** SHA `8b64738` · Branch `codex/core-1to1-integrated`
**Date:** 2026-08-19 · **Read-only delta analysis**
**Class:** PARTIAL — implementable with documented delta PLUS hidden couplings
**Target:** Non-tutor offerings — Workshop, Class, Event

---

## 1. Executive Summary

The Tutor V1 booking engine uses **session-based** tables and RPCs that are mechanically generic but architecturally coupled to tutor-specific concepts at three critical points: session creation role gate, read-model `tutor_profiles` joins, and frontend type hardcoding.

**23 of 43 acceptance requirements are READY as-is.** 17 need work. 3 are unverified. Zero are blocked at the schema level — all blockers are in RPCs, routes, and frontend types.

**Verdict: PARTIAL** — the write path is closer to READY than audits suggest; the read path and session creation are further from READY.

---

## 2. What Is Genuinely Reusable (Ship-Ready Today)

### 2.1 Write-Path RPCs (All Offering-Agnostic)

| RPC | File:Line | Why It Works |
|-----|-----------|-------------|
| `create_booking` | 0005:163-187 | Operates on `session_id` → `bookings`; `s.host_id = uid` self-booking guard; capacity check; uniqueness constraint |
| `confirm_booking` | 0005:189-206 | `s.host_id = uid` host check |
| `reject_booking` | 0005:208-224 | Same host pattern |
| `cancel_booking` | 0005:226-252 | `s.host_id = uid` host path; `cancelled_by` is `('attendee','host')` not tutor-specific |
| `approve_booking_for_payment` | 0008:148-163 | `s.host_id <> uid` — generic host, not tutor |
| `record_attendance` | 0005:276-299 | `s.host_id = uid` |
| `cancel_session` | 0005:128-145 | `assert_host_of_session(sid)` — generic |
| `reschedule_session` | 0005:100-126 | `assert_host_of_session` |
| `complete_session` | 0005:147-160 | `assert_host_of_session` |
| All reschedule RPCs | 0005:304-414 | `('attendee','host')` actors; no tutor references |

### 2.2 Schema Tables (All Offering-Agnostic)

| Table | File:Line | Why It Works |
|-------|-----------|-------------|
| `sessions` | 0004:7-21 | `host_id` refs `profiles(id)` not `tutor_profiles`; `offering_id` nullable; capacity fields generic |
| `bookings` | 0004:23-36 | `learner_id`, `session_id`, `participant_count`, `status` — no offering columns |
| `booking_history` | 0004:47-59 | `actor` is `('attendee','host')` — no tutor references |
| `reschedule_requests` | 0004:63-75 | `from_session_id`/`to_session_id`; `requested_by` is `('attendee','host')` |
| `session_capacity_reservations` | 0004:56-71 | Capacity tracking, no offering references |
| `attendance_facts` | 0004:81-92 | `outcome` is `('attended','learner_no_show','host_no_show')` — generic |
| `event_outbox` | 0006 | Entity types are `text`; event names reference `BOOKING`/`SESSION`/`PAYMENT` — no tutor coupling |

### 2.3 Authorization Model (Write Path)

| Guard | File:Line | Why It Works |
|-------|-----------|-------------|
| `assert_host_of_session()` | 0005:27-35 | Checks `sessions.host_id = uid` — role-agnostic |
| `assert_attendee_caller()` | 0005:17-24 | Checks `profiles(id)` exists — no role check |
| `approve_booking_for_payment` host check | 0008:155 | `s.host_id <> uid` — generic |

### 2.4 Backend Routes (Write Path)

| Route | File:Line | Why It Works |
|-------|-----------|-------------|
| `POST /api/v1/bookings` | booking.ts:61-67 | Body: `{ sessionId, participantCount }` — generic |
| `POST /api/v1/sessions/:id/cancel` | booking.ts:161-168 | Calls generic `cancelSession` |
| `POST /api/v1/sessions/:id/reschedule` | booking.ts:170-177 | Calls generic `rescheduleSession` |

### 2.5 Event Outbox (All Generic)

All domain events key on `session_id`/`booking_id`/`paymentId`. Event names (`BOOKING_REQUESTED`, `SESSION_CANCELLED`, `PAYMENT_RECEIVED`) contain no tutor references. Event entity types (`'session'`, `'booking'`, `'payment'`) are offering-agnostic.

---

## 3. What Needs Work (17 Requirements)

### 3.1 Schema Layer — 2 Requirements

| ID | Requirement | What Exists | What's Needed | Effort |
|----|------------|-------------|---------------|--------|
| SCH-003 | `offering_id` FK + NOT-NULL for non-tutor | Nullable uuid, no FK (0004:9) | FK to `workshops(id)`/`events(id)` or polymorphic `offerings(id)` table; NOT-NULL for non-tutor sessions; NULL allowed for legacy tutor 1:1 | Medium |
| SCH-004 | `offering_type` discriminator | No such column | Either explicit `offering_type text` column or FK target disambiguation; query layer needs to know which offering domain to join | Medium |

### 3.2 RPC Layer — 4 Requirements

| ID | Requirement | What Exists | What's Needed | Effort |
|----|------------|-------------|---------------|--------|
| RPC-002 | `create_session` accepts non-tutor hosts | `host_role not in ('tutor','admin')` → raises `insufficient_privilege` (0005:73-74) | Relax role gate to allow `organizer`/`instructor`/`host` roles; OR remove role check entirely (authorization already via `assert_host_of_session`) | Small |
| RPC-003 | `list_bookable_sessions` returns non-tutor sessions | Hard `JOIN tutor_profiles tp ON tp.user_id = s.host_id AND tp.publication_status = 'published'` (20260814073312_core:69) | LEFT JOIN or alternative join that works for non-tutor hosts; possibly separate listing functions per offering type | Medium |
| RPC-004 | `get_bookable_session` returns non-tutor sessions | Same `tutor_profiles` join (20260814073312_core:84) | Same fix as RPC-003 | Medium |
| RPC-006 | `get_my_tutor_bookings` generalized for any host | `assert_tutor_caller()` requires `role='tutor'` (20260814153000:84) | Rename to `get_my_host_bookings`; replace `assert_tutor_caller()` with `assert_host_of_session` or role-agnostic check | Small |

### 3.3 API Route Layer — 3 Requirements

| ID | Requirement | What Exists | What's Needed | Effort |
|----|------------|-------------|---------------|--------|
| API-001 | `GET /api/v1/sessions` accepts generic filter | Only `tutorProfileId` query param (booking.ts:46-48) | Add `offeringType`, `offeringId`, or `hostId` filter | Small |
| API-003 | `GET /api/v1/me/tutor-bookings` generalized | Calls `listTutorBookings` → `get_my_tutor_bookings` RPC (booking.ts:75-79) | Rename route; update service method; update RPC | Small |
| API-005 | Host cancel routes accessible for non-tutor | Path contains `/tutor/` (booking.ts:113-120) | Generalize URL or add parallel `/host/` routes | Small |

### 3.4 Frontend Layer — 5 Requirements

| ID | Requirement | What Exists | What's Needed | Effort |
|----|------------|-------------|---------------|--------|
| FE-001 | `BookableSession` type has `tutorProfileId` required | `tutorProfileId: string` — required field (booking-api.ts:18) | Rename to `hostProfileId` or make optional; add `offeringType` field | Small |
| FE-002 | `BookingRecord.tutor` is required | `tutor: { id, displayName }` — required non-null (booking-api.ts:50-53) | Make optional or add generic `host` field | Small |
| FE-003 | `listBookableSessions()` takes `tutorProfileId` only | `listBookableSessions(tutorProfileId: string)` (booking-api.ts:144) | Generalize to accept `offeringType`/`offeringId`/`hostId` | Small |
| FE-005 | `tutor-booking-api.ts` functions blocked by `assert_tutor_caller` | `listTutorBookings()` calls `/api/v1/me/tutor-bookings` (tutor-booking-api.ts:95-117) | Update after API-003 is done | Small |
| FE-008 | `bookingFrom()` hard-asserts tutor | `!booking.tutor \|\| typeof booking.tutor.id !== "string"` → throws (booking-api.ts:118) | Make tutor check optional; add host fallback | Small |

### 3.5 Authorization Layer — 3 Requirements

| ID | Requirement | What Exists | What's Needed | Effort |
|----|------------|-------------|---------------|--------|
| AUTH-002 | `assert_tutor_caller()` blocks non-tutor hosts from read RPCs | Checks `role='tutor'` (0002:33) | Replace with role-agnostic `assert_host_of_session` or new `assert_host_caller` | Small |
| AUTH-003 | `create_session` role gate allows non-tutor | `host_role not in ('tutor','admin')` → rejects (0005:73-74) | Relax or remove role check | Small |
| AUTH-004 | `list_bookable_sessions` visibility not gated by tutor_profiles join | Implicit gate via hard JOIN (20260814073312:59-88) | Fix as part of RPC-003/RPC-004 | Medium |

---

## 4. Hidden Couplings (Audits Understated)

### 4.1 `create_session` Role Gate Is the Primary Write-Path Blocker

The audits noted "tutor-specific logic in SQL RPCs" but did not emphasize that `create_session` (0005:74) **hard-gates session creation to `tutor` or `admin` role**. Without a `host`/`organizer` role in the `user_role` enum, non-tutor offering hosts cannot enter the system at all. This is not a read-model fix — it is a write-path prerequisite.

### 4.2 `booking_read_json` Is the Single Point of Failure for Learner Booking Views

The `tutor` field in booking read output is produced by `JOIN tutor_profiles` (20260814153000:58). For a non-tutor host, this join returns nothing. The frontend `bookingFrom()` (booking-api.ts:118) **throws** if `booking.tutor` is missing. Every learner booking view for a Workshop/Class/Event will fail at parse time.

### 4.3 `list_bookable_sessions` and `get_bookable_session` Silently Exclude Non-Tutor Sessions

Both join `tutor_profiles` with `publication_status = 'published'` (20260814073312_core:69,84). A session created by a non-tutor host is structurally valid but invisible to discovery. The session exists in the database but cannot be booked through the public API.

### 4.4 `user_role` Enum Has No Host/Organizer Value

The `user_role` enum is `('student','tutor','admin')` (0001:3). There is no role for Workshop organizers, Class instructors, or Event hosts who are not tutors. This blocks `create_session` and `get_my_tutor_bookings`.

### 4.5 `offering_id` Dual-State Risk

Existing tutor sessions have `offering_id = NULL` (0004:9). Making it non-null with FK requires either backfilling all existing sessions with a tutor-offering reference, or keeping a dual-state (NULL for legacy tutor, non-NULL for new offerings). The dual-state approach leaks into every query that needs to filter by offering type.

---

## 5. Minimum Change Set

### 5.1 Schema (New Migration)

```
1. Expand user_role enum: add 'organizer' (or 'host')
2. Create offerings table (id, type, title, host_id, ...)
3. Add offering_type column to sessions
4. Add FK from sessions.offering_id to offerings.id
5. Backfill existing tutor sessions with default offering reference
6. Make sessions.offering_id NOT NULL after backfill
```

### 5.2 RPC Layer (Modify Existing)

```
1. create_session: relax role gate (remove or expand to allow organizer)
2. list_bookable_sessions: LEFT JOIN or separate function for non-tutor hosts
3. get_bookable_session: same fix
4. get_my_tutor_bookings → get_my_host_bookings: replace assert_tutor_caller()
5. booking_read_json: add generic host field alongside tutor field
```

### 5.3 API Routes (Minor Changes)

```
1. GET /api/v1/sessions: add offeringType/offeringId/hostId query params
2. GET /api/v1/me/tutor-bookings → /api/v1/me/host-bookings: rename
3. POST /api/v1/tutor/bookings/:id/cancel → /api/v1/host/bookings/:id/cancel: rename
```

### 5.4 Frontend Types (Naming + Optionality)

```
1. BookableSession: tutorProfileId → hostProfileId (or optional); add offeringType
2. BookingRecord: tutor → optional; add host field
3. listBookableSessions(): generalize params
4. bookingFrom(): make tutor assertion optional
5. tutor-booking-api.ts: rename functions after API rename
```

### 5.5 Estimated Effort

| Layer | Changes | Effort |
|-------|---------|--------|
| Schema + Migration | 6 items | Medium-Large |
| RPC Layer | 5 items | Medium |
| API Routes | 3 items | Small |
| Frontend Types | 5 items | Small |
| Frontend Components | Conditional rendering | Small |
| **Total** | **~20 items** | **Medium** |

---

## 6. Risk Assessment

### Risk 1: Read Model Refactor Has Larger Blast Radius Than Write Path

`booking_read_json` is called by `get_my_bookings`, `get_booking`, `get_my_tutor_bookings`, and surfaces in every `BookingRecord` on the frontend. Changing it requires coordinated migration + frontend type + component updates. A partial refactor (e.g., adding `host` without removing `tutor`) risks a two-field schism where some bookings have `tutor` and others have `host`, and the frontend must handle both.

**Mitigation:** Add `host` field alongside `tutor` (don't remove `tutor` yet). Deprecate `tutor` in a future release. Use feature flag for frontend rendering.

### Risk 2: `assert_tutor_caller()` Is Wrong Authorization Primitive for Host Actions

`get_my_tutor_bookings` (20260814153000:84) and `save_my_tutor_cv` (0002:33) use `assert_tutor_caller()` which checks `role = 'tutor'`. If the team adds a `host` role, every RPC using `assert_tutor_caller()` must be audited and potentially replaced with `assert_host_of_session()`. The write RPCs already use the generic pattern; the read RPCs do not.

**Mitigation:** Audit all `assert_tutor_caller()` usages. Replace with `assert_host_of_session()` where applicable. Keep `assert_tutor_caller()` only for genuinely tutor-specific operations (CV management, tutor listing).

### Risk 3: `offering_id` Dual-State Is Data Integrity Debt

Existing tutor sessions have `offering_id = NULL`. Making it non-null with FK requires either backfilling all existing sessions with a tutor-offering reference, or keeping a dual-state (NULL for legacy tutor, non-NULL for new offerings). The dual-state approach leaks into every query that needs to filter by offering type.

**Mitigation:** Create a default `tutor-offering` type in the offerings table. Backfill all existing tutor sessions with this default offering. Make `offering_id` NOT NULL after backfill. This is a one-time data migration.

---

## 7. Acceptance Matrix Summary

| Layer | READY | NEEDS_WORK | BLOCKED | N/A / UNVERIFIED |
|-------|-------|------------|---------|-------------------|
| Schema (8) | 5 | 2 | 0 | 1 |
| RPC (10) | 6 | 4 | 0 | 0 |
| API Route (7) | 4 | 3 | 0 | 0 |
| Frontend (8) | 2 | 5 | 0 | 1 |
| Authorization (6) | 3 | 3 | 0 | 0 |
| Event Outbox (4) | 3 | 0 | 0 | 1 |
| **Total (43)** | **23** | **17** | **0** | **3** |

---

## 8. Classification

**PARTIAL** — implementable with documented delta PLUS the hidden couplings identified in §4. The write path is closer to READY than audits suggest; the read path and session creation are further from READY.

**Prerequisite:** User decision on offering type taxonomy (Workshop vs Class vs Event), pricing model (flat-fee vs per-seat vs tiered), and whether to expand `user_role` enum or use a separate host identity model.

---

*End of SHARED_BOOKING_ENGINE_DELTA_V1*
