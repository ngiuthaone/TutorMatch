# Tutoria Agent Handoff Contracts V2

## Common handoff envelope

Every specialist should return:

```text
TASK
SCOPE OWNED
EVIDENCE INSPECTED
DECISIONS / FINDINGS
FILES CHANGED (or NONE)
INVARIANTS AFFECTED
TESTS / CHECKS
UNVERIFIED ITEMS
PRODUCT DECISIONS REQUIRED
NEXT OWNER
STATUS: PASS | PARTIAL | UNVERIFIED | BLOCKED
```

## backend_engineer → database_engineer

Must provide accepted domain invariants, state transitions, canonical entities/facts, and unresolved product choices. Must not prescribe SQL unless already accepted.

Database engineer returns persistence representation, conceptual constraints, serialization boundary, migrations/tests, and any contradiction discovered.

## database_engineer → integration_engineer

Must provide transaction entry point, required locks/CAS/version semantics, constraint error meanings, and which mutations/events must be atomic locally.

Integration engineer returns command orchestration, idempotency, error mapping, actor/auth handoff, and outbox boundary.

## integration_engineer → payments_engineer

Must provide accepted booking/payment orchestration point without redefining provider semantics.

Payments engineer returns provider mapping, webhook/idempotency rules, ambiguous-outcome handling, and reconciliation needs.

## implementer → qa_engineer

Provide only the required behavior, known boundary, and test entry points—not a persuasive summary of why the code is correct. QA should independently attack it.

## implementer → independent_verifier

Verifier receives the original accepted task plus final diff. Implementer conclusions are context, not authority.

## reliability_engineer handoff

Receives durable business/event semantics from domain/integration/database owners. It may design detection/retry/recovery, but cannot redefine business success or terminality.

## context_scout handoff

Returns VERIFIED_EVIDENCE, HYPOTHESIS, MISSING_CONTEXT, MISSING_DECISION, readiness state, and smallest recommended next owner. It does not produce implementation plans that outrun the evidence.
