---
name: tutoria-orchestrator
description: Coordinate substantial Tutoria engineering/product tasks with specialized Codex subagents. Use for multi-step features, cross-stack changes, audits, production-readiness work, or requests to build/test/fix an area end to end. Avoid for trivial one-file edits that one agent can safely finish and verify.
---

# Tutoria Orchestrator

## Objective

Complete the user's Tutoria task with the fewest agents necessary while keeping product context, implementation noise, and verification work separated.

## Workflow

1. Read the applicable `AGENTS.md` and inspect the requested surface.
2. Classify the task:
   - trivial targeted fix
   - UI feature
   - backend/data feature
   - cross-stack feature
   - audit/review
   - external-source integration
3. Resolve necessary product/domain decisions before implementation starts (user instructions, `product_planner`, or product brain).
4. For product-ambiguous or high-cost-assumption tasks, run `context_scout` context-sufficiency check before product planning and QA preflight (see Context Scout).
5. Run QA preflight (`qa_browser` acceptance contract) before the primary implementation agent for non-trivial work; skip it for trivial tasks (see QA preflight).
6. Spawn only the relevant specialists.
7. Prefer read-only work in parallel; coordinate write-capable agents to avoid overlapping edits.
8. Require independent verification against the acceptance contract after implementation.
9. Route failures back to the implementation owner and rerun the failed gate.
10. Return a concise evidence-based report.

## Context Scout (context sufficiency)

Run `context_scout` **early** — before product planning and QA preflight — when the task has significant product ambiguity or high-cost assumptions. It answers "do we have enough Tutoria-native context, and if not, what should we ask the founder for?" It inspects Tutoria evidence first, reports a readiness state, ranks the few highest-value missing inputs, and defines what work is safe to proceed on now.

- Readiness states: `READY` (proceed, no interruption) / `READY_WITH_GAPS` (proceed within bounded scope; decisions stay open) / `INPUT_RECOMMENDED` (input would materially help; proceed and surface it early) / `INPUT_REQUIRED` (correctness/security/irreversible architecture/core behavior at stake; do not silently decide).
- Missing information alone never triggers `INPUT_REQUIRED`; prefer `READY_WITH_GAPS` / `INPUT_RECOMMENDED` unless proceeding would risk authorization/ownership errors, irreversible data design, financial loss, destructive migration, security/privacy issues, or binding external behavior into core policy.
- Scout output distinguishes `MISSING_CONTEXT` (artifact/spec likely exists; search first, request only if needed) from `MISSING_DECISION` (Tutoria never established the policy; surface the product question, do not ask for more files) and labels evidence `VERIFIED_TUTORIA_EVIDENCE` / `NOT_FOUND` / `HYPOTHETICAL_EXAMPLE` / `INFERENCE` / `EXTERNAL_EVIDENCE` — invented or external evidence must never be reported as found Tutoria evidence.
- Invoke when business/marketplace rules, state transitions, permissions/roles, money/payments/refunds, booking/cancellation/rescheduling, notifications, trust/safety/moderation, data ownership, persistence architecture, irreversible choices, or external-reference work are involved.
- Skip for routine, reversible, or visually obvious work (styling, spacing, typography, hover, small responsive fixes, obvious bug fixes, straightforward refactors, isolated reversible implementation).
- Never ask the user for an artifact that already exists in the repository. On `INPUT_REQUIRED`, ask only for the smallest necessary input and wait; on `INPUT_RECOMMENDED`, continue bounded work while surfacing the recommendation early.
- For product-sensitive external-reference work, use the DISCOVER TUTORIA CONTEXT → STUDY → ABSTRACT → CLASSIFY PRODUCT POLICY → TUTORIA-NATIVE IMPLEMENTATION flow and the classification labels in the External section; Tutoria evidence outranks external behavior.
- Record it in the run like any reviewer: `begin-agent` before delegation, `end-agent` with `--context-readiness <readiness state>` (separate from run outcome) and `--artifact <report path or evidence list>`; include `context_scout: invoked YES/NO` in the final report so invocation is auditable.

## QA preflight (acceptance contract)

For non-trivial work, QA expectations must be established **before** implementation: requirements → acceptance contract → implementation → verification against the contract. Product/domain reasoning decides **what Tutoria should do**; QA independently defines **how we will know it is correct**.

Triggers preflight (at least): booking/payment/authorization flows, domain models, state machines, notification/domain-event behavior, persistence behavior, multi-user or destructive actions, complex forms/workflows, and external-reference-driven feature work.

Skipped (no formal contract): typo fixes, simple copy changes, tiny isolated styling adjustments, mechanical refactors with unchanged behavior.

How to run it:
- Resolve product/domain decisions first. If QA reports `PRODUCT_DECISION_REQUIRED`, resolve it with product/domain reasoning (`product_planner` or user), then have QA convert the decision into acceptance criteria.
- QA writes the run-scoped contract at `docs/agent-team/qa-contracts/<run-id>-qa-contract.md` and it is recorded in the run via `--contract-path`.
- The contract exists before the primary implementation agent starts; QA verification later runs against the ORIGINAL contract.
- Contract changes are recorded (original criterion, reason, authorizer, revised criterion) with `contract-change`; the orchestrator approves them. Never let implementation limitations silently weaken criteria.
- QA derives criteria by authority order: explicit user instructions; Tutoria product policy/product brain; established production behavior and domain architecture; approved architecture decisions in the current run; prototypes and external references only as supporting evidence.
- Browser testing is one QA capability, not the whole definition. Backend/domain-only work may be verified without browser testing.

## Recommended routing

### UI feature
- `code_explorer` if ownership is unclear
- `product_designer` when interaction/layout changes are meaningful
- `frontend_engineer` to implement
- `qa_browser` to verify
- `security_reviewer` only if sensitive data/auth/UGC/access control is involved

### Backend/data feature
- `context_scout` when state transitions, permissions, money, persistence, or product-policy gaps are in play
- `code_explorer` if ownership is unclear
- `product_planner` for state/requirements ambiguity
- `qa_browser` preflight acceptance contract when state transitions, authorization, persistence, or domain correctness are involved
- `backend_engineer` to implement
- `security_reviewer` for auth/data/persistence-sensitive changes
- targeted automated checks
- `qa_browser` verification against the contract

### Cross-stack feature
- `code_explorer` + `product_planner` may run in parallel
- establish the acceptance contract (QA preflight) before implementation begins
- coordinate `backend_engineer` and `frontend_engineer`; do not let them overwrite overlapping files
- run `qa_browser` verification and `security_reviewer` after integration

### External repo/package/reference

Default is STUDY → ABSTRACT → TUTORIA-NATIVE IMPLEMENTATION. Run `repo-license-guard` / `license_guard` triage early, before deep implementation inspection. For product-sensitive reference features, run `context_scout` first: DISCOVER TUTORIA CONTEXT → STUDY → ABSTRACT → CLASSIFY PRODUCT POLICY → TUTORIA-NATIVE IMPLEMENTATION, classifying external behavior as `DOMAIN_INVARIANT` / `EXISTING_TUTORIA_POLICY` / `PROTOTYPE_EVIDENCE` / `REVERSIBLE_DESIGN_CHOICE` / `PRODUCT_DECISION_REQUIRED` / `EXTERNAL_SOURCE_ASSUMPTION`. External behavior may inform Tutoria but must not silently become product policy when Tutoria-native evidence is missing.

1. Route provenance/license triage first: `researcher` + `license_guard` (or `license_guard` alone when the source is a known dependency already under the gate).
2. Read the gate result's feature action and route by mode:
   - `INCORPORATE` — reuse the existing dependency/library; `code_explorer` maps the integration point, the relevant engineer implements, targeted tests run.
   - `ADAPT` — exact permissive paths only; assign the engineer, record provenance/notices, run targeted tests.
   - `STUDY_ONLY` — `researcher` produces an implementation-neutral Tutoria feature spec (requirements, behavior, states, UX principles, public interface expectations; no restricted source details); `product_planner` only when translation into Tutoria needs meaningful product decisions; the relevant engineer implements from the spec and the Tutoria repository.
   - `HARD_BLOCK` — stop and report, but only when an independent blocker exists (legal/contractual, patent, security, privacy, product).
3. Never equate a `BLOCKED` external source with a `BLOCKED` Tutoria feature; default to `STUDY_ONLY` instead.
4. Enforce the external-research budget: stop external exploration once enough exists to design the Tutoria-native equivalent, and prefer deeper `code_explorer` work on the Tutoria repository.
5. Do not summon `qa_browser` or `security_reviewer` merely because an external repo was mentioned; route them on the feature's own risk basis.
6. For non-trivial reference-driven features, QA preflight writes the acceptance contract against the Tutoria-native spec (not reference parity). QA verifies Tutoria outcomes, not that the external product was reproduced.

Minimal team examples:
- Simple UI reference: license/research triage → `code_explorer` → `frontend_engineer` → targeted QA if needed.
- Existing safe dependency: `license_guard` → `code_explorer` → relevant engineer → targeted tests.
- Complex booking architecture: `context_scout` → `researcher` + `license_guard` → `product_planner` → `qa_browser` preflight acceptance contract → `code_explorer` → frontend/backend → `security_reviewer` if auth/data boundaries are involved → `qa_browser` verification.

### Production specialists (V2)

Classify the task by failure surface before delegation; see `docs/agent-team/AGENT_ROUTING_MATRIX_V2.md` and `AGENT_RESPONSIBILITY_SKILL_MATRIX_V2.md` for the full map.

- Missing evidence/context → `context_scout` only if materially needed.
- Domain legality/state transitions → existing `backend_engineer`.
- PostgreSQL/Supabase durability, constraints, transactions, capacity serialization → `database_engineer` (translates accepted domain invariants; may not redefine domain policy).
- Auth/RLS/private data/financial attack surface → existing `security_reviewer` under existing mandatory triggers.
- API/application orchestration, idempotency, domain↔DB↔outbox wiring → `integration_engineer` (never duplicates state machines in routes).
- Real provider money/webhooks/refunds/payouts → `payments_engineer` (never puts payment states into `BookingStatus`).
- Backend races/retries/idempotency/failure paths → `qa_engineer` (distinct from browser `qa_browser`).
- Browser/UI behavior → existing `qa_browser`.
- Production observability/recovery/durable workers → `reliability_engineer`.
- Final substantial acceptance → `independent_verifier` (read-only, inspects the real final diff, must not certify its own edits).

No-bureaucracy rule: agent count is not a quality metric. Spawn only roles with a distinct information need, write boundary, or independent verification purpose.

### Review/audit
Run read-only specialists in parallel when useful, then merge findings by severity and deduplicate them.

## Skill-first procedure

For a substantial task, after selecting the smallest competent team, identify the smallest relevant canonical skill set from `.agents/skills/tutoria-*` (routing, context, evidence, handoff, requirement traceability, domain/capacity, Supabase/postgres/RLS, application services/idempotency-outbox, payment, QA, server-authoritative UI, reliability, external-reference, skill-ingestion). Prefer one canonical project skill per repeatable workflow over restating its full procedure in ad-hoc prompts, and require the standard handoff contract (see `tutoria-handoff-contract`) plus requirement traceability for large acceptance prompts. Do not preload the whole library into every agent context.

External skills/plugins are special: discovery must route through `tutoria-skill-ingestion` plus the existing researcher/license/security controls before installation or adaptation.

## Observability

For every substantial task routed through this skill, also follow `tutoria-team-observability`:

1. Start a run before delegating.
2. Open an activity immediately before each subagent spawn.
3. Close the activity with evidence after the subagent returns.
4. Finalize the run only after applicable quality gates.
5. Include agent activity and team-assessment summaries in the final response.

Do not claim an agent was used unless its distinct delegated activity is present in the run record.

## Completion gate

Do not declare completion until every applicable gate is PASS or explicitly UNVERIFIED/BLOCKED:
- implementation
- focused tests
- type/lint/build checks applicable to changed scope
- QA verification against the acceptance contract when preflight was used (browser QA for user-facing changes)
- security/privacy review for sensitive changes
- license gate for external material

## Reporting

Return:
- scope completed
- files/surfaces changed
- agents used
- `context_scout: invoked YES/NO` with readiness state and any surfaced inputs when applicable
- verification performed
- unresolved issues
- final status: PASS / PARTIAL / UNVERIFIED / BLOCKED
