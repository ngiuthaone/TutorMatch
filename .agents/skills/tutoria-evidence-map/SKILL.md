---
name: tutoria-evidence-map
description: Build an authority-ranked evidence map for a Tutoria change. Use before architecture or implementation when multiple specs, tests, prototypes, historical docs, or external references may conflict.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria evidence map

For each meaningful claim, record: source, exact path/symbol/range, what it proves, authority class, and conflicts.

Use these classes where relevant:
- `DOMAIN_INVARIANT`
- `EXISTING_TUTORIA_POLICY`
- `PROTOTYPE_EVIDENCE`
- `REVERSIBLE_DESIGN_CHOICE`
- `PRODUCT_DECISION_REQUIRED`
- `EXTERNAL_SOURCE_ASSUMPTION`

Executable behavior and accepted tests normally outrank stale prototypes. A newer accepted spec may intentionally override older code; surface that explicitly rather than choosing silently. External repositories can inform abstractions but do not become Tutoria authority.
