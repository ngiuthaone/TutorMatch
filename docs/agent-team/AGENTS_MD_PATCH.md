# Semantic patch for root AGENTS.md — Agent Team V2

**Do not replace the live AGENTS.md with this file.** Codex must merge these rules into the existing team/orchestrator section only where compatible.

## Production specialist routing

The existing Tutoria Agent OS remains authoritative. Add these specialists when the task crosses their boundary:

- `database_engineer`: PostgreSQL/Supabase schema, migrations, constraints, transaction correctness, capacity serialization, locking/CAS/version strategy. It translates accepted domain invariants; it does not redefine product policy.
- `integration_engineer`: application services/API command orchestration, idempotency, domain↔persistence wiring, error mapping, outbox handoff, frontend/backend contracts.
- `payments_engineer`: real payment provider integration, verified webhooks, idempotency, refunds, payouts, reconciliation. It must preserve Booking/Payment lifecycle separation.
- `qa_engineer`: backend/integration/concurrency/idempotency/failure-path QA. `qa_browser` remains the browser/UI specialist.
- `independent_verifier`: read-only final requirement-vs-diff verification after substantial changes. It must not certify its own edits.
- `reliability_engineer`: production observability, durable worker/outbox reliability, retries/reconciliation, incident diagnostics/recovery.
- `context_scout`: optional read-only bounded context recovery when evidence is materially missing; do not invoke when current context is already sufficient.

### Routing principles

- Use the smallest competent team; do not spawn every agent.
- Preserve the current subagent concurrency cap unless live evidence justifies changing it.
- Parallelize read-heavy independent work; serialize overlapping writes with explicit file ownership.
- Accepted Tutoria domain architecture is a contract for persistence/integration agents. Reopen it only on a demonstrated contradiction.
- Security review remains mandatory under existing triggers. New specialists do not replace `security_reviewer` or the Tutoria security guard.
- External-source behavior remains under the existing researcher/license workflow and STUDY → ABSTRACT → TUTORIA-NATIVE IMPLEMENTATION philosophy.
- For claims involving database concurrency, retries, stale state, cross-system delivery, or payment idempotency, use `qa_engineer` where practical and do not call unit-only evidence production-safe.
- For substantial architecture/persistence/payment/release work, use `independent_verifier` after implementation.

### Phase routing

1. Domain V1: existing backend team; verifier as needed.
2. Supabase: database engineer + security review for RLS/auth.
3. Transactions/API: integration + database/backend; backend QA for races/idempotency.
4. Payments: payments + integration + security + backend QA.
5. User-facing integration: frontend + integration + browser QA.
6. Pre-launch: reliability + security + both QA modes + verifier as relevant.

## Skill-routing additions

For substantial work, route repeatable procedure through the canonical Tutoria skill library rather than restating long instructions in every prompt. Use `docs/agent-team/AGENT_SKILL_BINDINGS_PATCH.md` as the merge map. Important shared skills include:

- orchestration: `tutoria-task-routing`, `tutoria-handoff-contract`, `tutoria-requirement-traceability`;
- domain: `tutoria-domain-modeling`, `tutoria-capacity-concurrency`;
- persistence: `tutoria-supabase-persistence`, `tutoria-postgres-concurrency`;
- security: existing security guard + `tutoria-rls-review`;
- integration: `tutoria-application-services`, `tutoria-idempotency-outbox`;
- payments: `tutoria-payment-integration`, `tutoria-payment-webhooks`;
- QA: `tutoria-backend-qa`, `tutoria-browser-qa`;
- final verification: `tutoria-independent-verification`;
- reliability: `tutoria-production-reliability`;
- external skills/repos: `tutoria-skill-ingestion`, `tutoria-external-reference`.

Skills should activate by task relevance. Do not preload the whole library into every agent context.
