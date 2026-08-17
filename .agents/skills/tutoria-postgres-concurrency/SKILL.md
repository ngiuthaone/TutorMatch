---
name: tutoria-postgres-concurrency
description: Convert accepted Tutoria race/invariant requirements into PostgreSQL transaction, locking, conditional-update, or optimistic-CAS strategies. Use for capacity acquisition, reschedule movement, lifecycle races, and stale-state protection.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria PostgreSQL concurrency

## Procedure
1. Name the invariant being protected.
2. List every command that can race against it.
3. Identify the authoritative rows/facts.
4. Choose one serialization boundary per contested resource.
5. Compare row locking, atomic conditional update, isolation, CAS/versioning, uniqueness, or another minimal mechanism.
6. Define the winning and losing outcomes deterministically.
7. Ensure rollback leaves the original canonical state intact.
8. Add real transaction/concurrency tests when the environment supports them.

## Tutoria-critical properties
- All hard capacity acquisitions for one Session serialize against the same authoritative concurrency boundary.
- Reschedule acceptance never releases old capacity unless target acquisition and Booking move can commit together.
- A terminal Booking transition cannot later be overwritten by a stale command.
- Session cancellation and acquisition into that Session must serialize to a valid history.
- Duplicate commands cannot double-consume or double-release capacity.

Do not select a particular SQL technique before stating the correctness property.
