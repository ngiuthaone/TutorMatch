# tutoria-context-scout — Maintenance Spec

## Intent
Provide a repeatable Tutoria-specific workflow for the behavior described in `SKILL.md`.

## Primary owners
- context_scout

## Source / authority model
- Live Tutoria repository and applicable `AGENTS.md` are authoritative.
- Accepted domain/product decisions outrank prototypes.
- External sources inform patterns only through Tutoria's external-reference and license/security gates.

## Non-goal
No writes, implementation, or silent product decisions.

## Evaluation prompts / acceptance scenarios
- Missing historical policy returns evidence/readiness without edits.
- Existing repo evidence prevents an unnecessary founder question.

## Maintenance rule
When the workflow changes materially, update `SKILL.md`, this `SPEC.md`, the agent-skill binding matrix, and the relevant routing smoke test together. Do not copy mutable external skill text into this file without provenance and license approval.
