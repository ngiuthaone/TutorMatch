---
name: tutoria-context-scout
description: Gather the smallest missing Tutoria context before planning or implementation. Use when current code ownership, accepted decisions, product authority, or repository evidence is unclear. Remain read-only and distinguish missing evidence from missing product decisions.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria context scout

## Evidence priority
1. Applicable `AGENTS.md` and Agent OS instructions.
2. Current executable code and tests.
3. Accepted Tutoria domain/product docs.
4. Current schema, migrations, RLS, APIs, and deployment configuration.
5. Prototypes only as `PROTOTYPE_EVIDENCE`.
6. External sources only through the external-reference workflow.

## Output classification
- `VERIFIED_EVIDENCE` — directly supported by current repo evidence.
- `HYPOTHESIS` — plausible but not verified.
- `MISSING_CONTEXT` — likely evidence exists but was not found.
- `MISSING_DECISION` — evidence exists but product authority has not settled the choice.

## Readiness
Return `READY`, `READY_WITH_GAPS`, `INPUT_RECOMMENDED`, or rarely `INPUT_REQUIRED`. Never ask the founder to repeat information already available in the repository or task.

## Handoff
Return concise paths/symbols, authoritative facts, contradictions, readiness, and the smallest next specialist. Do not implement.
