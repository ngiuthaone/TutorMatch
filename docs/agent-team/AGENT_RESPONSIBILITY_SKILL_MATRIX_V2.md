# Tutoria Agent OS V2 — Responsibilities, Skills, and Boundaries

This file is a routing authority supplement. The live repository and applicable `AGENTS.md` remain authoritative.

| Agent | Primary responsibility | Core skills | Must not do |
|---|---|---|---|
| orchestrator | Route smallest competent team; sequence gates; final synthesis | tutoria-task-routing, tutoria-handoff-contract, tutoria-requirement-traceability | Spawn everyone; self-implement every task |
| context_scout | Read-only missing-context recovery | tutoria-context-scout, tutoria-evidence-map | Make product decisions or writes |
| code_explorer | Current repo mapping and blast radius | tutoria-evidence-map, tutoria-requirement-traceability | Redesign behavior while exploring |
| product_planner | Product policy/MVP decisions | tutoria-product-policy, tutoria-evidence-map | Turn implementation convenience into product policy |
| product_designer | UX/interaction/responsive intent | tutoria-server-authoritative-ui | Treat prototype copy as backend authority |
| backend_engineer | Domain models/invariants/pure lifecycle | tutoria-domain-modeling, tutoria-capacity-concurrency | Fake DB concurrency safety in TypeScript |
| database_engineer | PostgreSQL/Supabase durability/concurrency | tutoria-supabase-persistence, tutoria-postgres-concurrency | Redefine accepted domain policy |
| integration_engineer | APIs/application services/outbox/idempotency | tutoria-application-services, tutoria-idempotency-outbox | Duplicate state machines in routes |
| payments_engineer | Provider/payment/refund/payout correctness | tutoria-payment-integration, tutoria-payment-webhooks | Put payment states into BookingStatus |
| frontend_engineer | Production UI/API integration | tutoria-server-authoritative-ui | Make client state business truth |
| security_reviewer | Independent auth/RLS/trust review | existing tutoria-security-guard, tutoria-rls-review, tutoria-skill-ingestion | Self-approve risky changes |
| qa_engineer | Backend/integration/concurrency/failure QA | tutoria-backend-qa | Claim unit tests prove DB races safe |
| qa_browser | Browser/UI/E2E evidence | tutoria-browser-qa | Replace backend concurrency QA |
| independent_verifier | Read-only final spec-vs-diff acceptance | tutoria-independent-verification, tutoria-requirement-traceability | Edit then certify own work |
| reliability_engineer | Observability/retries/reconciliation/recovery | tutoria-production-reliability, tutoria-idempotency-outbox | Add distributed complexity without need |
| researcher | External research | tutoria-external-reference, tutoria-evidence-map | Override Tutoria authority |
| license_guard | Exact-source OSS/IP gate | existing repo-license-guard, tutoria-skill-ingestion | Treat registry hints as permanent approval |
