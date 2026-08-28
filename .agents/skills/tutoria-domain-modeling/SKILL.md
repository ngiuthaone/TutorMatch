---
name: tutoria-domain-modeling
description: Design or change Tutoria pure-domain lifecycle logic while keeping product policy, domain invariants, and production enforcement separate. Use for Booking, Session, Attendance, Capacity, Payment-domain, and related state-machine work before persistence.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria domain modeling

## Process
1. Inspect existing domain code/tests first.
2. Identify authoritative entities and stable identities.
3. Enumerate allowed states/transitions, actors, timing guards, and terminality.
4. Classify every meaningful rule as product policy, invariant, reversible choice, or unresolved decision.
5. Prefer immutable/history facts and derived helpers over duplicated state.
6. Implement only the smallest pure-domain changes justified by accepted behavior.
7. Add focused tests for transitions and invalid states.
8. Explicitly list production properties pure code cannot guarantee.

## Boundaries
Do not introduce database locks, Supabase clients, payment-provider calls, notification side effects, or frontend state into pure domain modules. Do not reopen stable Booking identity, reschedule, cancellation, attendance, or payment separation without direct contradiction evidence.
