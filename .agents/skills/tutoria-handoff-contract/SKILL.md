---
name: tutoria-handoff-contract
description: Standardize substantial Tutoria agent handoffs so downstream agents receive evidence, decisions, unresolved items, invariants, files, checks, and production gaps instead of vague “done” summaries.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria handoff contract

Every substantial handoff should contain:

1. **TASK** — bounded request completed.
2. **AUTHORITY READ** — exact code/spec/tests used.
3. **DECISIONS** — what was actually settled.
4. **UNRESOLVED** — what remains intentionally open.
5. **INVARIANTS** — rules downstream work must preserve.
6. **FILES / SYMBOLS** — changed or materially inspected surfaces.
7. **TESTS / CHECKS** — exact commands and results; skipped is `UNVERIFIED`.
8. **PRODUCTION GAP** — what pure tests or local mocks cannot prove.
9. **NEXT OWNER** — smallest specialist needed next.
10. **STATUS** — `PASS`, `PARTIAL`, `UNVERIFIED`, or `BLOCKED`.

Never claim production safety from design-only or pure-domain work.
