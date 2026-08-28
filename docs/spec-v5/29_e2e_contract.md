# 29 — E2E CONTRACT (E2E / AC)

**Purpose:** end-to-end acceptance journeys for the Alpha loops, with exact acceptance criteria (`AC-*`). Follows `qa_browser` intent: define the contract preflight, verify post-implementation against the same contract, never weaken it silently.

---

## 29.1 Alpha journey 1 — Learner books + pays a Workshop (instant)

```
anonymous → discover → workshop detail (price/capacity visible)
→ sign-in (from CTA, returns to same page with session selected)
→ create_booking (held) → payment → provider success (verified)
→ confirmed booking → /bookings/[id] shows CONFIRMED + receipt
→ cancel → refund obligation (REFUND PENDING → REFUNDED)
```

**AC:**
- AC-WORK-002 (login returns with session selected)
- AC-WORK-003 (sold-out vs open CTA)
- AC-BOOK-001 (confirmed only after payment)
- AC-BOOK-005 (server-authoritative UI)
- AC-PAY-001 (confirmation only on verified success)
- AC-LEARN-001 (lands on /bookings/[id]) — blocks on BLK-001
- AC-LEARN-003/004 (expired/refund states)

## 29.2 Alpha journey 2 — Host creates + publishes a Workshop

```
host → creator → create Offering(draft) → add Session(pricing snapshot)
→ publish → appears in public list → learner can book → host sees booking/earnings
```

**AC:** AC-WORK-004 (real persistence), AC-WORK-006 (ownership guard), AC-HOST-001/002 (see + manage). Blocks on `WORK-003-BUG-1`/`GAP-013`.

## 29.3 Alpha journey 3 — Approval-mode (request) + Tutor loop (P1)

```
learner requests → host confirms/rejects (reject releases capacity)
tutor: pick slot → shared engine (hourly) → pay → confirmed
```

**AC:** AC-HOST-002 (confirm/reject), AC-BOOK-*, AC-TUT-001/002 (public profile + book), AC-TUT-003 (no double-book).

## 29.4 Failure-path E2E

- Concurrent capacity oversell → second fails `AC-BOOK-002`.
- Duplicate webhook replay → single charge `AC-PAY-002`.
- Expired pending payment → capacity released, `PAYMENT EXPIRED` state `AC-BOOK-004`.
- Cross-user detail access → FORBIDDEN `AC-LEARN-002`.
- Provider ambiguity → `ambiguous` surfaced, not dropped `AC-PAYD`.

## 29.5 E2E verification method

- Browser/runtime evidence per `qa_browser`: desktop viewport, mobile viewport, primary path, loading/empty/error states, console errors, network failures, keyboard/focus (`tutoria-browser-qa`).
- Contract changes recorded with reason + authorizer; never silently weakened (`TST/29` rule).

## 29.6 ACCEPTANCE

- `AC-E2E-001` — Journeys 1–3 pass on dev against clean DB.
- `AC-E2E-002` — Failure-path E2E proves safety.
- `AC-E2E-003` — Real-money journey (provider live) is a **separate release gate** (`PAY-060`) with paid smoke test; until then `UNVERIFIED-REAL-MONEY`.
