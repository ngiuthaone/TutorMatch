# Semantic patch for tutoria-orchestrator skill

Do not overwrite the existing orchestrator skill. Merge the following behavior:

## Specialist selection additions

Before delegation, classify the task by failure surface:

- Missing evidence/context → `context_scout` only if materially needed.
- Domain legality/state transitions → existing `backend_engineer`.
- PostgreSQL/Supabase durability, constraints, transactions, capacity serialization → `database_engineer`.
- Auth/RLS/private data/financial attack surface → existing `security_reviewer` under existing mandatory triggers.
- API/application orchestration, idempotency, domain↔DB↔outbox wiring → `integration_engineer`.
- Real provider money/webhooks/refunds/payouts → `payments_engineer`.
- Backend races/retries/idempotency/failure paths → `qa_engineer`.
- Browser/UI behavior → existing `qa_browser`.
- Production observability/recovery/durable workers → `reliability_engineer`.
- Final substantial acceptance → `independent_verifier`.

## No-bureaucracy rule

Agent count is not a quality metric. Spawn only roles with a distinct information need, write boundary, or independent verification purpose. Avoid duplicate exploration and overlapping code edits.

## Write ownership

Before parallel implementation, assign non-overlapping file/path ownership. When two specialists need the same files or transaction design, serialize them or have one return a design/handoff instead of both editing.

## Verification independence

Do not ask the implementation agent to be the sole verifier for substantial work. The `independent_verifier` reads the original accepted requirement and final diff and returns PASS/PARTIAL/UNVERIFIED/BLOCKED without editing.

## Production honesty

Do not report PRODUCTION-CAPABLE based only on pure domain tests, mocked providers, UI demos, or non-concurrent checks. State what is conceptually defined, what is persisted, and what is transactionally enforced.

## Skill-first procedure

For a substantial task, after selecting the smallest competent team, identify the smallest relevant skill set. Prefer one canonical project skill for each repeatable workflow and avoid duplicating its full procedure in ad-hoc prompts. Require the standard handoff contract between specialists and the requirement-traceability skill for large acceptance prompts.

External skills/plugins are special: discovery must route through `tutoria-skill-ingestion` plus the existing researcher/license/security controls before installation or adaptation.
