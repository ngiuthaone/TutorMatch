---
name: tutoria-independent-verification
description: Independently verify a Tutoria change against the exact accepted requirements and real final diff. Use after meaningful architecture or implementation; verifier remains read-only and cannot certify its own edits.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria independent verification

1. Read the exact task and applicable project instructions.
2. Inspect the final diff and all materially affected files.
3. Trace execution paths rather than relying on implementer summaries.
4. Use the requirement-traceability ledger if available.
5. Confirm tests/checks actually exercise the claimed boundary.
6. Flag any accepted architecture silently reopened.
7. Classify each requirement as `PASS`, `PARTIAL`, `UNVERIFIED`, or `BLOCKED`.

Do not call pure domain checks production concurrency-safe. Do not infer RLS/payment/build/browser results that were not checked. Report precise evidence and residual risk before final acceptance.
