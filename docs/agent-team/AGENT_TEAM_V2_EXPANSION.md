# Tutoria Agent Team V2 — Production Expansion

## Purpose

Extend the existing Tutoria Agent OS without replacing its current orchestrator, product/design, exploration, frontend/backend, browser-QA, security, research, license, observability, OSS, or security-guard systems.

This pack adds production-specialist roles only where the existing team has a durable responsibility gap.

## New roles

| Agent | Primary ownership | Explicit non-ownership |
|---|---|---|
| `database_engineer` | PostgreSQL/Supabase schema, constraints, migrations, transaction correctness, locking/CAS strategy | Product/domain policy; security self-certification |
| `integration_engineer` | application services, API orchestration, idempotency, domain/persistence/event wiring | redefining domain lifecycles |
| `payments_engineer` | provider integration, webhooks, refunds, payouts, reconciliation | BookingStatus/payment conflation; capacity policy |
| `qa_engineer` | backend/integration/concurrency/idempotency/failure-path QA | browser/UI QA owned by `qa_browser` |
| `independent_verifier` | read-only final acceptance against the exact task and diff | implementation |
| `reliability_engineer` | observability, outbox workers, retries, reconciliation, production recovery | product policy; speculative distributed systems |
| `context_scout` | bounded read-only evidence gathering when context is genuinely missing | implementation, product decisions, broad research |

## Existing roles preserved

The live repository is expected to already contain some or all of:

`product_planner`, `product_designer`, `code_explorer`, `frontend_engineer`, `backend_engineer`, `qa_browser`, `security_reviewer`, `researcher`, `license_guard`, plus the orchestrator skill and related guards.

Do not duplicate or rename them merely to make this pack symmetrical.

## Team design principles

1. **Smallest competent team.** Do not spawn every specialist.
2. **Read-heavy parallelism, serialized writes.** Parallel exploration/review is useful; overlapping implementation writes require explicit ownership.
3. **Accepted domain architecture is a contract.** Persistence/integration engineers must not casually reopen it.
4. **Independent review remains independent.** The verifier does not edit the work it accepts.
5. **Security remains independent.** Engineers may draft RLS/webhook/auth changes; `security_reviewer` attacks them.
6. **External-source policy is unchanged.** `license_guard` + repo-license-guard still govern incorporation, while external references default to STUDY → ABSTRACT → TUTORIA-NATIVE IMPLEMENTATION when appropriate.
7. **Evidence-based completion.** PASS/PARTIAL/UNVERIFIED/BLOCKED only.
8. **No production theater.** Unit tests do not prove database serialization; UI mock state does not prove persistence; provider stubs do not prove money flow.

## Recommended phase activation

- Domain work: existing orchestrator + `code_explorer` + `backend_engineer` + `independent_verifier` when useful.
- Supabase persistence: add `database_engineer`; mandatory `security_reviewer` for RLS/auth.
- Transaction/API integration: add `integration_engineer`; add `qa_engineer` for concurrency/idempotency.
- Payment provider: add `payments_engineer`; security + QA mandatory.
- User-facing vertical slice: existing `frontend_engineer` + `qa_browser`, with integration specialist when server contracts change.
- Pre-production/launch: add `reliability_engineer` and independent verifier.
- Missing-context tasks: use `context_scout` only when evidence is materially incomplete.
