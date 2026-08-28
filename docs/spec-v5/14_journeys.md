# 14 — USER JOURNEY SPECIFICATIONS (JRN)

**Purpose:** end-to-end user journeys mapped to surfaces/contracts, with acceptance (`JRN-AC`). These drive E2E (#29) and QA preflight. Rapid-scan; full detail lives in surface files + E2E.

---

## JRN-001 — Discover & book a workshop (Anonymous → Confirmed)
1. Anonymous visits discover → sees live catalog (`DISC-001`).
2. Opens workshop detail, sees price + capacity (`WORK-002`).
3. Taps Book → auth CTA (returns with session selected) (`AUTH-004`, `WORK-002`).
4. create_booking → held (`BOOK-010/011`).
5. Pays (payment intent) (`PAY-010`).
6. Confirmed → `/bookings/[id]` (`LEARN-002`, fixes `BLK-001`).
7. Views receipt/cancel (`LEARN-031`).
- **JRN-AC-001:** each step evidences `AC-WORK/DISC/B00K/PAY/LEARN`.

## JRN-002 — Host creates, publishes, manages a Workshop
1. Learner opts into host (`HOST-030`).
2. Creator persists Offering(draft) + Session (`WORK-003` → real DB).
3. Publishes → appears publicly (`WORK-032`).
4. Learner books; host sees booking + earnings (`HOST-003/005`).
- **JRN-AC-002:** `AC-WORK-004/006`, `AC-HOST-001/002/004`. Blocks on `WORK-003-BUG-1`.

## JRN-003 — Request/approval booking (request mode)
1. Learner requests (`BOOK-013` status=requested).
2. Host confirms → payment → confirm; or rejects → capacity released (`HOST-031`).
- **JRN-AC-003:** `AC-BOOK`, `AC-HOST-002`.

## JRN-004 — Tutor 1:1 booking (P1)
1. Learner views public tutor profile (`TUT-001`).
2. Picks slot; shared engine hourly booking (`TUT-003`/`BOOK`).
3. Pays → confirmed; no double-book (`TUT-031`/`ITST-slot`).
- **JRN-AC-004:** `AC-TUT-001/002/003`.

## JRN-005 — Failure/edge journeys
- Oversell concurrency → second fails (`AC-BOOK-002`).
- Webhook replay → single charge (`AC-PAY-002`).
- Expired payment → capacity release + `PAYMENT EXPIRED` (`AC-BOOK-004`, `LEARN-003`).
- Cross-user detail → FORBIDDEN (`AC-LEARN-002`).
- Provider ambiguity → `ambiguous` surfaced (`AC-PAYD`).

## JRN-006 — Demo mode (non-live)
- Demo shell shows read-only UI with `DEMO` labels; never a live transaction (`AUTH-003`/`AC-SEC-005`).

---

## 14 RTM

| JRN | Surfaces | Primary ACs | E2E |
|---|---|---|---|
| JRN-001 | DISC/WORK/B00K/PAY/LEARN | JRN-AC-001 | 29.1 |
| JRN-002 | WORK/HOST | JRN-AC-002 | 29.2 |
| JRN-003 | BOOK/HOST | JRN-AC-003 | 29.3 |
| JRN-004 | TUT/BOOK | JRN-AC-004 | 29.3 |
| JRN-005 | all safety | JRN-AC-005 | 29.4 |
| JRN-006 | AUTH demo | JRN-AC-006 | — |
