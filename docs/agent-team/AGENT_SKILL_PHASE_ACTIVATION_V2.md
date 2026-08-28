# Tutoria Agent + Skill Activation by Product Phase

## Phase 0 — Capacity/Domain Freeze (current)
Primary: backend_engineer, code_explorer, product_planner only when policy is unresolved, independent_verifier.
Skills: tutoria-domain-modeling, tutoria-capacity-concurrency, tutoria-evidence-map, tutoria-requirement-traceability.
**Gate:** do not begin Supabase inside a capacity design-only task.

## Phase 1 — Supabase Persistence + RLS
Primary: database_engineer. Supporting: backend_engineer, security_reviewer, qa_engineer, verifier.
Skills: tutoria-supabase-persistence, tutoria-postgres-concurrency, tutoria-rls-review, tutoria-backend-qa.

## Phase 2 — Transaction/API/Outbox
Primary: integration_engineer + database_engineer.
Skills: tutoria-application-services, tutoria-idempotency-outbox, tutoria-postgres-concurrency.

## Phase 3 — Payment Provider
Primary: payments_engineer. Supporting: integration, database, security, QA, verifier.
Skills: tutoria-payment-integration, tutoria-payment-webhooks, tutoria-idempotency-outbox.

## Phase 4 — Production Frontend Vertical Slice
Primary: frontend_engineer + integration_engineer. QA: qa_browser + qa_engineer.
Skills: tutoria-server-authoritative-ui, tutoria-browser-qa.

## Phase 5 — Production Reliability / Private Alpha
Primary: reliability_engineer + security + QA.
Skills: tutoria-production-reliability, tutoria-idempotency-outbox, tutoria-independent-verification.

Future trust/safety, search/recommendation, or analytics specialists should be added only after those surfaces become real production systems.
