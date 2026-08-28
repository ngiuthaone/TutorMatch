---
name: tutoria-capacity-concurrency
description: Define Tutoria capacity units, acquisition/release semantics, minimum-participant calculations, race scenarios, and future serialization requirements without pretending pure TypeScript can enforce database concurrency.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria capacity and concurrency

Keep three layers explicit:
- **PRODUCT POLICY** — what counts or holds seats.
- **DOMAIN INVARIANT** — impossible states such as committed participant quantity exceeding a configured hard maximum.
- **PRODUCTION ENFORCEMENT** — transaction/serialization/CAS requirements.

## Required analysis
- Determine whether capacity is booking-count, participant-count, or type-specific.
- Preserve authoritative participant quantity on the Booking when multi-seat booking exists.
- Define which booking states are active commitments versus pending demand.
- Distinguish historical usage from future reservable capacity.
- Reschedule acceptance must logically move capacity old->target without stranding or double-counting.
- Cancellation/rejection release only the capacity they actually held.
- Payment success never bypasses capacity.
- `remainingCapacity` and `fullyBooked` are derived unless a later measured performance requirement justifies denormalization.

## Race catalogue
Specify last-seat, multi-seat, competing reschedules, confirm-vs-cancel, cancel-vs-reschedule, session-cancel-vs-confirm/reschedule, participant-increase-vs-booking, and max-decrease-vs-acquisition. Mark them `REQUIRES_PRODUCTION_TRANSACTION_ENFORCEMENT` until tested against the real persistence boundary.
