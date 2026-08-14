# tutoria-skill-ingestion — Maintenance Spec

## Intent
Provide a repeatable Tutoria-specific workflow for the behavior described in `SKILL.md`.

## Primary owners
- license_guard
- security_reviewer
- researcher

## Source / authority model
- Live Tutoria repository and applicable `AGENTS.md` are authoritative.
- Accepted domain/product decisions outrank prototypes.
- External sources inform patterns only through Tutoria's external-reference and license/security gates.

## Non-goal
No blind install from catalogs or mutable branches without exact-source review.

## Evaluation prompts / acceptance scenarios
- Unknown skill from awesome list is blocked from install until exact ref/license/security/semantic gates pass.

## Maintenance rule
When the workflow changes materially, update `SKILL.md`, this `SPEC.md`, the agent-skill binding matrix, and the relevant routing smoke test together. Do not copy mutable external skill text into this file without provenance and license approval.
