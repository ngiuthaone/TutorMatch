# tutoria-task-routing — Maintenance Spec

## Intent
Provide a repeatable Tutoria-specific workflow for the behavior described in `SKILL.md`.

## Primary owners
- orchestrator

## Source / authority model
- Live Tutoria repository and applicable `AGENTS.md` are authoritative.
- Accepted domain/product decisions outrank prototypes.
- External sources inform patterns only through Tutoria's external-reference and license/security gates.

## Non-goal
Not a replacement for specialist expertise; does not require using all available agents.

## Evaluation prompts / acceptance scenarios
- Small UI spacing bug does not spawn DB/payment/reliability agents.
- Payment webhook task routes payment+integration+security+QA.

## Maintenance rule
When the workflow changes materially, update `SKILL.md`, this `SPEC.md`, the agent-skill binding matrix, and the relevant routing smoke test together. Do not copy mutable external skill text into this file without provenance and license approval.
