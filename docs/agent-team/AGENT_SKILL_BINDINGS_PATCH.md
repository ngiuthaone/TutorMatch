# Existing Agent Definitions — Skill Binding Semantic Patch

Codex must inspect the live `.codex/agents/*.toml` files and merge these responsibilities without replacing newer/correct instructions.

- **orchestrator / root AGENTS.md**: require `tutoria-task-routing`, `tutoria-handoff-contract`, and `tutoria-requirement-traceability` for substantial orchestrated work.
- **context_scout**: `tutoria-context-scout`, `tutoria-evidence-map`.
- **code_explorer**: `tutoria-evidence-map`, `tutoria-requirement-traceability`.
- **product_planner**: `tutoria-product-policy`, `tutoria-evidence-map`.
- **product_designer**: `tutoria-server-authoritative-ui` when production behavior is involved.
- **backend_engineer**: `tutoria-domain-modeling`; add `tutoria-capacity-concurrency` for Session/capacity work.
- **database_engineer**: `tutoria-supabase-persistence`, `tutoria-postgres-concurrency`.
- **integration_engineer**: `tutoria-application-services`, `tutoria-idempotency-outbox`.
- **payments_engineer**: `tutoria-payment-integration`, `tutoria-payment-webhooks`.
- **frontend_engineer**: `tutoria-server-authoritative-ui`.
- **security_reviewer**: preserve existing `tutoria-security-guard`; add `tutoria-rls-review` and `tutoria-skill-ingestion` when applicable.
- **qa_engineer**: `tutoria-backend-qa`.
- **qa_browser**: `tutoria-browser-qa`.
- **independent_verifier**: `tutoria-independent-verification`, `tutoria-requirement-traceability`.
- **reliability_engineer**: `tutoria-production-reliability`, `tutoria-idempotency-outbox`.
- **researcher**: `tutoria-external-reference`; external skills also require `tutoria-skill-ingestion`.
- **license_guard**: preserve existing `repo-license-guard`; external skills also route through `tutoria-skill-ingestion`.

Do not duplicate a skill if a live equivalent already exists with stronger/current Tutoria instructions. Prefer semantic merge and one canonical skill per repeatable workflow.
