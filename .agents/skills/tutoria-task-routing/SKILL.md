---
name: tutoria-task-routing
description: Choose the smallest competent Tutoria agent team for a task. Use when the orchestrator must decide which specialists should inspect, implement, review, or verify work, especially across domain, Supabase, payments, security, QA, frontend, or production reliability.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria task routing

## Goal
Route work to the fewest agents that can complete it correctly. Do not spawn the whole team by default.

## Routing procedure
1. Classify the task surface: PRODUCT, DOMAIN, DATABASE, INTEGRATION, PAYMENT, FRONTEND, SECURITY, QA, RELIABILITY, EXTERNAL_REFERENCE.
2. Identify whether the work is READ-HEAVY, WRITE-HEAVY, or REVIEW-ONLY.
3. Select one primary owner. Add specialists only for distinct expertise or independent review.
4. Keep overlapping writes serialized. Parallelize independent reads and adversarial reviews when safe.
5. Respect the repository concurrency cap. Never reduce quality merely to fill available agent slots.
6. Require `independent_verifier` after substantial architecture, persistence, security-sensitive, or cross-layer implementation.

## Default routes
- Pure domain lifecycle: `code_explorer` + `backend_engineer` + `independent_verifier`.
- Unsettled product policy: add `product_planner`.
- Supabase/schema/concurrency: `database_engineer` primary; add `backend_engineer`, `security_reviewer`, `qa_engineer`, verifier as needed.
- Application API/orchestration: `integration_engineer` primary; add database/backend specialists according to touched invariants.
- Real payments: `payments_engineer` primary + integration + security + QA + verifier.
- User-facing frontend: `frontend_engineer` primary + integration as needed + `qa_browser`.
- Production failure/retry/observability: `reliability_engineer` primary + affected subsystem owner.
- External repo/skill: `researcher` + `license_guard`; never bypass `tutoria-skill-ingestion`.

## Anti-patterns
Do not add separate agents merely for Booking, Session, Capacity, Tutor, Workshop, or Event when an existing engineering discipline already owns the problem. Do not use a reviewer as the sole implementer and then let it self-certify.
