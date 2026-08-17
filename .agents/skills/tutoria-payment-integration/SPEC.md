# tutoria-payment-integration — Maintenance Spec

## Intent
Provide a repeatable Tutoria-specific workflow for the behavior described in `SKILL.md`.

## Primary owners
- payments_engineer

## Source / authority model
- Live Tutoria repository and applicable `AGENTS.md` are authoritative.
- Accepted domain/product decisions outrank prototypes.
- External sources inform patterns only through Tutoria's external-reference and license/security gates.

## Non-goal
No payment states in BookingStatus and no assumption that provider success bypasses booking/capacity rules.

## Evaluation prompts / acceptance scenarios
- Provider success maps to payment fact and still goes through normal booking/capacity eligibility.

## Maintenance rule
When the workflow changes materially, update `SKILL.md`, this `SPEC.md`, the agent-skill binding matrix, and the relevant routing smoke test together. Do not copy mutable external skill text into this file without provenance and license approval.
