---
name: tutoria-requirement-traceability
description: Trace a Tutoria task from requirements to implementation and tests. Use when a long architecture prompt has many explicit clauses or when final acceptance must prove that no requirement was silently dropped.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria requirement traceability

Create a compact requirement ledger before or during implementation:

`requirement -> authority -> owner -> implementation surface -> test/evidence -> status`.

Rules:
- Split compound requirements when they can fail independently.
- Mark deliberate non-goals and stop rules.
- Preserve unresolved product decisions as unresolved; do not convert them to defaults.
- When implementation changes a requirement, require an explicit contradiction/decision record.
- Final verifier must inspect the real diff and map each material requirement to evidence.
