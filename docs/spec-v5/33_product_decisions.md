# 33 — PRODUCT DECISIONS (DEC) & TECHNICAL DECISIONS (TDEC)

**Purpose:** register open product/technical decisions that must be resolved before their dependent requirements are implemented. `DEC-*` = owner/product decision; `TDEC-*` = technical decision (architect/owner). Open items are `PRODUCT DECISION REQUIRED`; nothing depends on them is guessed.

---

## 33.1 Open PRODUCT DECISIONS (`PRODUCT DECISION REQUIRED`)

| DEC-0xx | Decision | Affects | Status |
|---|---|---|---|
| DEC-001 | Final canonical route(s) for workshop listing/detail/creator (today `/events-live`, `/workshops`, `/events/new`) | WORK-001/002/003 | OPEN |
| DEC-002 | Booking session selection UX: created `/bookings/new?offering=&session=` route vs inline dialog on detail | WORK-030 | OPEN |
| DEC-003 | `session_hard_reserved` semantics: per-participant vs 1:1 summation for capacity (UNK-002) | BOOK-011/DOM-013 | OPEN |
| DEC-004 | Cancellation/refund policy: TTL window, attendee vs host cancel rights, refund % rules | BOOK-040/LEARN-031/PAY-030 | OPEN |
| DEC-005 | Approval vs instant default booking_mode for workshops | BOOK-013 | OPEN |
| DEC-006 | In-app realtime notifications at Alpha vs event-driven/email only | NOTIF-011 | OPEN |
| DEC-007 | Reviews at Alpha or Post-Alpha (draft = Post-Alpha) | REV-010 | OPEN |
| DEC-008 | Storage strategy: Supabase buckets vs CDN (avatar/thumbnail) | STG-020 | OPEN |
| DEC-009 | Events (kind=event) promoted to shared engine at Alpha or Post-Alpha | EVT-010 | OPEN (default Post-Alpha) |
| DEC-010 | Home/landing route: `/landing` vs `/discover` default for signed-out | DISC | OPEN |
| DEC-011 | Host Center native refactor extent at Alpha | HOST-001/GAP-018 | OPEN |
| DEC-012 | Currency/pricing display locale & minor-unit convention confirmation (VND) | PAY-002 | OPEN |
| DEC-013 | **Phone capture at booking:** persist learner phone on the booking row (`bookings.learner_phone`, host-visible) vs reuse `profiles.phone` only. HEADLINE — current flow collects NO phone. | TUT-UX-002/003, BOOK-UX-002 | **RESOLVED (28 Aug 2026) — `bookings.learner_phone`.** Snapshot at booking time, survives profile edits, RLS to host-of-session only for privacy-by-default. |
| DEC-014 | Booking form presentation: inline sheet/modal on detail page vs a dedicated `/bookings/new` route | TUT-UX-003, BOOK-UX-002, DEC-002 | **RESOLVED (28 Aug 2026) — inline sheet/modal on the detail page.** Matches existing CTA pattern (book without losing context), mobile-friendly, no navigation/state-lift cost. (See also DEC-002 for the workshop entry point.) |
| DEC-015 | **Promote direct host↔learner messaging to Alpha?** Default is Post-Alpha (`SCOPE-004`, `MSG-001`, `SCOPE-003` PURPLE). Promote only the booking-context direct (1:1) host↔learner message core (`MSG-010`/`MSG-002`): server-authoritative conversation + membership + RLS, idempotent send, moderation hooks. NOT in scope: groups/communities, file/attachment storage, polls/tasks/announcements, realtime push (WebSocket/SSE — stays deferred per `AC-EVT2-003`/`NOTIF-011`) | MSG-001/010, SCOPE-004, 09_social, 18_events | **RESOLVED (31 Aug 2026) — promote.** Direct host↔learner 1:1 booking-context messaging ships in Alpha. Realtime stays deferred; no client-fabricated membership; moderation hooks required. DEC-106 list retained for the not-promoted surfaces (groups/communities/files/realtime). |

## 33.2 Open TECHNICAL DECISIONS

| TDEC-0xx | Decision | Affects | Status |
|---|---|---|---|
| TDEC-001 | Migration parity handling for remote-only `20260817160000/01` (UNK-003): re-extract vs documented divergence | MIG-011 | OPEN (ops-gated) |
| TDEC-002 | Search: Postgres FTS now vs defer full-text to Post-Alpha (default defer) | SCH-020 | OPEN |
| TDEC-003 | Product-analytics SDK choice (license_guard before incorporation) | ANL-020 | OPEN/Post-Alpha |
| TDEC-004 | VNPay adapter versioning/upstream pin + secret management tooling | PAY/16 | OPEN |
| TDEC-005 | Worker deployment topology (always-on job vs scheduled) | WORKER | OPEN/ops |

## 33.3 RECORDED / adopted (not open)

| DEC-0xx | Resolution |
|---|---|
| DEC-100 | Preserve shared booking engine; no parallel models (`ARCH-002`) |
| DEC-101 | `flat_per_participant_v1` authoritative; `fixed_v1` dead (`REAL-005`) |
| DEC-102 | Server-authoritative money/eligibility; no fake persistence for transactional state (`ARCH-004/005`) |
| DEC-103 | Private Alpha = Host→Workshop + Tutor money loops (`SCOPE-002`) |
| DEC-104 | Payment/refund/payout separate domain, never in BookingStatus (`DOM-010`) |
| DEC-105 | Demo mode never authorizes live transactions (`AUTH-003`/`SEC-031`) |
| DEC-106 | Post-Alpha defaults: messaging/communities/articles/courses-LMS/reviews/photobooth (`SCOPE-004`) |
