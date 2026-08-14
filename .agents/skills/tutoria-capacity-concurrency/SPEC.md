# tutoria-capacity-concurrency — Maintenance Spec

## Intent
Provide a repeatable Tutoria-specific workflow for the behavior described in `SKILL.md`.

## Primary owners
- backend_engineer
- database_engineer after persistence begins

## Source / authority model
- Live Tutoria repository and applicable `AGENTS.md` are authoritative.
- Accepted domain/product decisions outrank prototypes.
- External sources inform patterns only through Tutoria's external-reference and license/security gates.

## Non-goal
No SQL/Supabase implementation during design-only capacity work.

## Evaluation prompts / acceptance scenarios
- Last-seat race is marked as production transaction requirement, not solved by read-then-write TypeScript.

## Maintenance rule
When the workflow changes materially, update `SKILL.md`, this `SPEC.md`, the agent-skill binding matrix, and the relevant routing smoke test together. Do not copy mutable external skill text into this file without provenance and license approval.
