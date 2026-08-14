---
name: tutoria-product-policy
description: Resolve or classify Tutoria product-policy questions without confusing prototypes, reversible choices, domain invariants, and implementation convenience. Use when engineering is blocked by a genuine business decision.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria product policy

For each disputed behavior:
1. Gather current authoritative evidence.
2. Separate product intent from domain impossibility and implementation mechanics.
3. Compare viable product models and their user/operational consequences.
4. Prefer reversible choices when evidence is insufficient.
5. Mark genuinely unsettled matters `PRODUCT_DECISION_REQUIRED`; do not let an engineer settle them for convenience.
6. When a decision is made, record the rationale, affected invariants, and downstream persistence/API implications.

Prototype copy is evidence of intended UX, not automatically authoritative policy.
