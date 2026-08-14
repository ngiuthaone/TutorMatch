# Tutoria Agent Routing Matrix V2

Use the smallest set that covers the actual failure modes.

| Task shape | Required / likely agents | Usually not needed |
|---|---|---|
| Pure domain lifecycle | orchestrator, code_explorer, backend_engineer, independent_verifier | database, payments, reliability, security unless authority surface changes |
| Supabase schema/migration | database_engineer, code_explorer, independent_verifier | frontend, payments unless coupled |
| RLS/auth/private data | database_engineer or backend/integration owner + security_reviewer + independent_verifier | full team |
| Capacity transaction | database_engineer + backend_engineer + qa_engineer + independent_verifier | product designer |
| Production API command | integration_engineer + backend_engineer; database_engineer if transaction changes; verifier | researcher unless external docs needed |
| Payment provider/webhook | payments_engineer + integration_engineer + security_reviewer + qa_engineer + verifier | product designer unless UX policy changes |
| Frontend hookup to real API | frontend_engineer + integration_engineer + qa_browser; security if auth/private data | payments unless money flow touched |
| Browser regression | qa_browser + relevant implementer | database unless failure traces there |
| Backend race/idempotency regression | qa_engineer + relevant backend/database/integration owner | qa_browser unless user flow also affected |
| Event outbox worker | integration_engineer + reliability_engineer + database_engineer when schema changes + qa_engineer | product planner unless behavior policy unresolved |
| Launch observability/recovery | reliability_engineer + security_reviewer for sensitive telemetry + verifier | product designer |
| External repo/package study | researcher/code_explorer + license_guard per existing policy | production specialists until Tutoria-native implementation stage |
| Missing project context | context_scout first, then route smallest specialist set | all other agents until scout returns readiness |

## Mandatory escalation triggers

Security review remains mandatory when work touches auth, RLS, private data, uploads, UGC, messaging, bookings with authorization, payments, admin/moderation, secrets, webhook verification, CORS/CSP, or rate limiting.

`qa_engineer` should be included when a change claims correctness under retries, concurrency, idempotency, stale state, or cross-system failure.

`independent_verifier` should be included after substantial architecture, persistence, transaction, payment, security-sensitive, or release-critical work.

## Parallelism

Preserve the repository's existing concurrency cap unless live evidence justifies changing it. Six concurrent subagents is already enough for normal Tutoria work. Prefer 2–4 specialists on most substantial tasks.

Never run overlapping writes merely because thread capacity exists.
