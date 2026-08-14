# Tutoria Agent Operating System

This repository is worked on by a primary Codex orchestrator plus specialized subagents.
The goal is to ship useful changes with strong product consistency, low coordination overhead, and explicit quality gates.

## Product identity

Tutoria is a Vietnam-first learning marketplace and community product for tutors, learners, parents, creators, workshops, events, courses, communities, discussions, and articles.

Core product principles:
- Trust before transaction.
- Privacy by default.
- Fit over listing volume.
- Tutor identity over commodity marketplace presentation.
- Progressive disclosure.
- Demo behavior must never be confused with production behavior.

Design direction:
- Charcoal / gray visual language.
- Minimal, premium, restrained UI.
- Strong hierarchy and concise copy.
- Mobile-responsive by default.
- Avoid green as a primary brand color.
- Use Tutoria's own visual expression even when studying external products.

## Shared product memory

For product-scope, architecture, production-boundary, or cross-surface tasks, consult `docs/agent-team/TUTORIA_PRODUCT_BRAIN.md` as a compact shared reference, then verify task-critical details against the current code and latest repository docs.

## Current architecture boundary

Treat the repository as three surfaces unless the code proves otherwise:
1. Root TutorMatch SPA: legacy/local demo behavior. It may demonstrate matching, chat, simulated payment, reviews, and other concepts, but it is not a production source of truth.
2. `backend/`: production-oriented API and Supabase-backed business logic.
3. `discover/`: broader product UI/prototype and the preferred production web shell when the launch architecture is being discussed.

Production-safe rules:
- Do not route real production identity, ownership, publication state, bookings, payments, moderation, or access control through localStorage, JSON files, seeded demo users, `/api/state`, or simulated payment.
- Do not claim tutor identity, credentials, education, experience, reviews, ratings, booking, payment, messaging, or moderation are production-ready unless code, persistence, authorization, operations, and tests prove it.
- Public tutor data must not expose auth IDs, private contact data, exact address, private versions, or service-role credentials.
- Backend authorization is authoritative; client metadata is not.

## Default team

The primary Codex thread is the **orchestrator**. It owns scope, sequencing, conflict avoidance, final synthesis, and the go/no-go decision.

Available custom subagents:
- `product_planner`: requirements, journeys, edge cases, acceptance criteria, product-scope checks.
- `product_designer`: UI/UX, responsive behavior, hierarchy, accessibility-oriented interaction review.
- `code_explorer`: read-only code-path mapping before changes.
- `context_scout`: context sufficiency and input optimization — inspects existing Tutoria context before asking, labels evidence truthfully (verified / not found / hypothetical / inference / external), distinguishes missing context from missing product decisions, identifies/ranks missing high-value inputs (READY / READY_WITH_GAPS / INPUT_RECOMMENDED / INPUT_REQUIRED), defines safe scope, and prevents external references from silently becoming product policy. Read-only; never codes; never blocked on for routine work.
- `frontend_engineer`: frontend implementation and targeted UI fixes.
- `backend_engineer`: APIs, Supabase, auth, schema, persistence, security-sensitive server behavior.
- `qa_browser`: independent QA — defines acceptance contracts (QA preflight) before non-trivial implementation and verifies the result against the original contract afterwards; browser/runtime QA, regressions, responsive testing, console/network evidence remain core capabilities. Never makes product/domain decisions.
- `security_reviewer`: auth, RLS, secrets, privacy, abuse, release-risk review.
- `researcher`: read-only product/framework research and concise evidence gathering.
- `license_guard`: external repository/package/assets license gate.

## Production specialists (V2)

These specialists exist for distinct production responsibilities. Invoke them only when the task crosses their boundary; do not spawn them merely because they exist. `docs/agent-team/AGENT_RESPONSIBILITY_SKILL_MATRIX_V2.md` and `AGENT_ROUTING_MATRIX_V2.md` are routing supplements; this file and the live repository remain authoritative.

- `database_engineer`: PostgreSQL/Supabase schema, migrations, constraints, transaction correctness, capacity serialization, locking/CAS/version strategy. It translates accepted domain invariants into durable database guarantees; it does not redefine product/domain policy.
- `integration_engineer`: application services and API command orchestration, idempotency, domain↔persistence wiring, error mapping, outbox handoff, frontend/backend contracts. It does not duplicate domain state machines in routes.
- `payments_engineer`: real payment-provider integration, verified webhooks, idempotency, refunds, payouts, reconciliation. It must preserve the accepted Booking/Payment lifecycle separation and must not put payment states into `BookingStatus`.
- `qa_engineer`: backend/integration/concurrency/idempotency/failure-path QA (races, retries, stale state, duplicate/reordered webhooks, adversarial lifecycle tests). Distinct from `qa_browser`, which remains the browser/UI/E2E specialist. Pure unit tests do not prove database concurrency safety; unavailable checks are `UNVERIFIED`.
- `independent_verifier`: read-only final requirement-vs-diff acceptance after substantial architecture, persistence, payment, security-sensitive, or release work. It inspects the real final diff and must not certify its own edits.
- `reliability_engineer`: production observability, durable worker/outbox reliability, retries/reconciliation, incident diagnostics and recovery. It may design detection/retry/recovery but cannot redefine business success or terminality.

Authority boundary rule: product policy ≠ domain invariant ≠ database enforcement strategy. `database_engineer` may choose a correct serialization mechanism but may not decide that requested bookings do not hold capacity to make persistence easier; `payments_engineer` may design provider integration but may not place payment states into `BookingStatus`; `frontend_engineer` may present capacity/payment state but may not make client state authoritative; `security_reviewer` independently reviews RLS/auth/trust boundaries and does not self-certify its own risky implementation.

Phase-based activation (see `docs/agent-team/AGENT_SKILL_PHASE_ACTIVATION_V2.md` and `PRODUCTION_PHASE_GATES.md`):
1. Domain/capacity freeze: existing backend team + `independent_verifier`; no Supabase inside a capacity design-only task.
2. Supabase persistence + RLS: `database_engineer` primary, `backend_engineer` + `security_reviewer` + `qa_engineer` + verifier.
3. Transactions/API/outbox: `integration_engineer` + `database_engineer`; `qa_engineer` for races/idempotency.
4. Payment provider: `payments_engineer` + `integration_engineer` + `security_reviewer` + `qa_engineer` + verifier.
5. Frontend vertical slice: `frontend_engineer` + `integration_engineer` + `qa_browser`.
6. Private alpha/production: `reliability_engineer` + `security_reviewer` + both QA modes + verifier.

Reusable procedure lives in the canonical Tutoria skill library (`.agents/skills/tutoria-*`): routing, context, evidence, handoff, and requirement traceability for orchestration; domain/capacity, Supabase/postgres/RLS, application services/idempotency-outbox, payment, QA, server-authoritative UI, reliability, and external-reference/skill-ingestion workflows. Skills activate by task relevance; do not preload the whole library into every agent context. For substantial work prefer one canonical skill per repeatable workflow over restating long procedures in ad-hoc prompts.

## Orchestration policy

Use subagents only when they improve quality or reduce context pollution.

### For a normal feature

Requirements must not quietly become whatever the implementation happened to ship. The working order is: inspect existing behavior → resolve product/domain decisions → QA preflight acceptance contract → implementation → QA verification against the contract → evidence-backed report. QA expectations are established independently **before** final verification.

1. Have `code_explorer` map the existing implementation when the relevant code path is not already obvious.
2. Run `context_scout` **early** when the task has significant product ambiguity or high-cost assumptions (business/marketplace rules, state transitions, permissions/roles, money, payments/refunds, booking/cancellation/rescheduling, notifications, trust/safety/moderation, data ownership, persistence architecture, irreversible choices, external-reference work). It inspects Tutoria-native evidence first, reports a readiness state (`READY` / `READY_WITH_GAPS` / `INPUT_RECOMMENDED` / `INPUT_REQUIRED`), surfaces only the few highest-value founder inputs, and defines what work is safe to proceed on now. Never ask for an artifact that already exists; never block routine reversible work. It labels evidence truthfully (verified in-repo / explicitly not found / hypothetical / inference / external — invented or external facts are never reported as found Tutoria evidence) and distinguishes `MISSING_CONTEXT` (likely exists somewhere; search, then request if needed) from `MISSING_DECISION` (Tutoria never established it; surface the product question, not a file request); missing information alone is not enough to escalate to `INPUT_REQUIRED`.
3. Use `product_planner` when requirements, state transitions, or launch scope are ambiguous.
4. Run `qa_browser` **preflight** for non-trivial work to define the acceptance contract before implementation: booking/payment/authorization flows, domain models, state machines, notification/domain events, persistence, multi-user or destructive actions, complex forms/workflows, external-reference-driven work. QA derives criteria from authoritative sources and never makes product/domain decisions; unresolved requirements are reported as `PRODUCT_DECISION_REQUIRED` and resolved by product/domain reasoning first. Skip preflight for typo fixes, copy changes, isolated styling, and mechanical refactors.
5. Use `product_designer` for new/changed interaction design or responsive behavior.
6. Assign implementation to the smallest number of write-capable agents possible.
7. Run `qa_browser` after implementation to verify against the original contract; for user-facing behavior include browser/runtime verification. QA must not silently weaken the contract — contract changes are recorded with reason and authorizer and approved by the orchestrator.
8. Run `security_reviewer` for auth, data access, uploads, user-generated content, payments, messaging, admin, or sensitive persistence.
9. Run `license_guard` before any new external repository/package/source material is incorporated.
10. Run `independent_verifier` after substantial architecture, persistence, payment, security-sensitive, or release-critical work: it reads the original accepted requirement and the real final diff and returns PASS / PARTIAL / UNVERIFIED / BLOCKED without editing. Do not let the implementing agent be the sole verifier of its own substantial work.
11. The orchestrator resolves failures, routes fixes, reruns affected checks, and only then reports completion.

### Parallelism rules

Good parallel work:
- code exploration
- product research
- test-gap analysis
- security review
- browser QA on independent surfaces
- documentation/reference checks

Avoid parallel writes to overlapping files or the same stateful feature. Prefer one implementation owner at a time when files overlap.

For a cross-stack change, frontend and backend agents may work in parallel only when their file ownership and interface contract are explicit and non-overlapping. Otherwise sequence backend contract first, then frontend integration.

## Token-efficiency policy

Do not spawn the whole team for routine work.
- Tiny targeted fix: primary agent or one worker, then the relevant test.
- Routine UI fix (styling, spacing, hover, small responsive bug): `code_explorer` only if needed, then `frontend_engineer`, then `qa_browser` verification (no `context_scout`, no preflight contract).
- UI-only change: `code_explorer` only if needed, then `frontend_engineer`, then `qa_browser` verification (preflight contract only if correctness is not visually obvious).
- Backend-only change: `code_explorer` only if needed, then `backend_engineer`, then tests/security review as appropriate; `qa_browser` preflight + verification when state transitions, authorization, or domain correctness are involved.
- Product-ambiguous or high-stakes feature: `context_scout` first (context sufficiency, read-only), then `product_planner`/`qa_browser` preflight as needed.
- Research-only question: `researcher` or `product_planner`; no implementation agents.
- Large feature: planner + explorer can run in parallel, implementation is coordinated, QA/security run after.

Return concise summaries from subagents. Do not dump full logs into the main thread unless needed to diagnose a failure.

## Mandatory external-source gate

Before using, copying, adapting, installing, vendoring, porting, or closely reproducing material from an external repository/package, invoke the `repo-license-guard` skill or spawn `license_guard`.

Project enforcement files:
- `docs/OSS_POLICY.md` — human-readable policy.
- `oss/REPO_POLICY.json` — dated repository hints only, never permanent approval.
- `oss/EXTERNAL_SOURCES.json` — exact incorporated-source ledger.
- `THIRD_PARTY_NOTICES.md` — generated notice summary.
- `scripts/oss_guard.py` — registry, notice-generation, and CI checks.

For incorporated `PASS`/`CONDITIONAL` material, record exact source/ref/path evidence, regenerate notices, and run `python3 scripts/oss_guard.py ci` before completion. Do not add a repo to the incorporation ledger merely because it appears in the hint registry.

A public repository is not automatically reusable.
Do not bypass license restrictions by paraphrasing, translating, or line-by-line reimplementation of blocked source.
When a source is not clearly acceptable, prefer an independently designed implementation from public behavior/specifications or a permissively licensed alternative.

### Tutoria repository hard rules

1. Apply this gate to every external repository, package, component library, copied/adapted source, UI implementation reference, asset, dataset, template, or third-party code.
2. Do not incorporate source until an exact-ref, exact-path `OSS LICENSE GATE` result exists.
3. Treat `oss/REPO_POLICY.json` only as a hint; re-check the exact ref and files.
4. Record incorporated material in `oss/EXTERNAL_SOURCES.json`, regenerate `THIRD_PARTY_NOTICES.md`, and run `python3 scripts/oss_guard.py ci` before marking work complete.
5. If material is `REVIEW`, `BLOCKED`, or `STUDY_ONLY`, do not copy or closely rewrite it. Use a permissive alternative or independently implement from public docs, APIs, or observed behavior.
6. Never automatically use `/enterprise`, `/ee`, Premium, proprietary, BSL/BUSL, AGPL/GPL, SSPL, or unlicensed code.

## External reference philosophy

When the user asks to "reference", "study", "learn from", or "use ideas from" an external repository, do not assume they want the repository copied.

Default to **STUDY → ABSTRACT → TUTORIA-NATIVE IMPLEMENTATION**:

1. Determine what user problem the feature solves.
2. Understand the workflow and how it behaves.
3. Identify important states and edge cases.
4. Extract useful UX/product patterns and high-level architecture concepts.
5. Check what Tutoria already has and what can be reused.
6. Decide what to adopt, simplify, change, or reject for Tutoria's users.
7. Build the feature using Tutoria's existing architecture, components, terminology, data model, security boundaries, and design language.

For product-sensitive reference work, the practical workflow is **DISCOVER TUTORIA CONTEXT → STUDY → ABSTRACT → CLASSIFY PRODUCT POLICY → TUTORIA-NATIVE IMPLEMENTATION**: run `context_scout` first to establish what Tutoria-native evidence exists and what policy is missing, then classify external behavior (`DOMAIN_INVARIANT`, `EXISTING_TUTORIA_POLICY`, `PROTOTYPE_EVIDENCE`, `REVERSIBLE_DESIGN_CHOICE`, `PRODUCT_DECISION_REQUIRED`, `EXTERNAL_SOURCE_ASSUMPTION`). The invariant: external behavior may inform Tutoria, but must not silently become Tutoria product policy when Tutoria-native evidence is missing. Never conclude "external product does this → Tutoria should do this."

Direct source reuse is optional, never the goal: it requires the exact material to pass the repo-license workflow and must be genuinely preferable to an independent implementation.

External license classification (`PASS` / `REVIEW` / `BLOCKED`) describes the source, not the feature. The orchestrator separately chooses the feature action: `INCORPORATE`, `ADAPT`, `STUDY_ONLY`, or `HARD_BLOCK`. A `BLOCKED` source must not cancel a Tutoria feature by default; it routes to `STUDY_ONLY`.

Do not exhaustively analyze an external repository. Inspect only enough external material to understand the requested feature, its workflow/states, relevant design principles, and whether incorporation is permitted and useful. Stop external exploration once enough information exists to design the Tutoria-native equivalent, and prefer spending additional effort understanding the Tutoria repository over the reference repository.

## Agent observability and performance

For every substantial orchestrated task, use the `tutoria-team-observability` skill and `scripts/team-observability.py`.

Required behavior:
- Start one run record before meaningful delegation begins.
- Record a `begin-agent` activity immediately before each distinct subagent delegation.
- Record `end-agent` after the result returns, with real acceptance/rework/findings/check evidence.
- A specialist is `USED` only when a distinct recorded activity actually ran; configuration loading does not count.
- Finalize the run after applicable quality/security/license gates and regenerate `.codex/TEAM_PERFORMANCE.md`.
- Record model/token/cost fields only when Codex exposes them. Never estimate them.
- Keep secrets, private user data, raw credentials, and unnecessary transcript/source content out of run logs.
- Do not optimize for agent count. Explicitly flag unnecessary invocations and specialists that should have been used but were omitted.

For substantial final reports, include an `Agent activity` summary and `Team assessment` based on the run record.

## Quality gate

A task is not complete merely because code was written.

Before declaring a user-facing change complete, gather evidence for all applicable checks:
- relevant unit/integration tests
- lint/type-check/build if the affected surface defines them
- QA verification against the acceptance contract when preflight was used
- browser verification for user-facing flows
- responsive verification for changed UI
- security review for sensitive flows
- external-source/license review when applicable

If a required check cannot run, report it as **UNVERIFIED** rather than implying success.

### Browser QA minimum

For changed user-facing pages, verify when tooling permits:
- desktop viewport
- mobile viewport
- primary interaction path
- loading/empty/error states touched by the change
- console errors
- obvious network failures
- keyboard/focus behavior for new controls

### Security escalation triggers

For security-sensitive work, include `security_reviewer` and use `.agents/skills/tutoria-security-guard/SKILL.md` as the project security audit workflow when a full/focused security pass is warranted. The deterministic helper is available as `scripts/security-scan.sh`; unavailable scanners must be reported as skipped, never passed.

Always include `security_reviewer` for changes involving:
- authentication/session handling
- authorization/roles
- Supabase RLS or RPCs
- private/public profile boundaries
- user-generated content
- uploads/files
- messaging/inquiries
- booking/payments/refunds
- admin/moderation
- secrets/configuration
- CORS/CSP/proxy/rate limiting

## Release truthfulness

Use these status labels in final engineering reports:
- `PASS`: implemented and applicable checks passed.
- `PARTIAL`: useful implementation exists, but an integration/operation remains.
- `UNVERIFIED`: implementation may exist, but a required check could not be run.
- `BLOCKED`: a dependency, safety issue, license issue, or missing production system prevents safe completion.

Never say "production-ready" unless production persistence, authorization, operational controls, and release checks actually support that claim.

## Final report format

For substantial tasks, the orchestrator should report:
- What changed
- Files/surfaces changed
- Agents used
- Tests/checks run and results
- Security/license findings when relevant
- Remaining risks or unverified items
- Final status: PASS / PARTIAL / UNVERIFIED / BLOCKED

Do not include agent chatter. Summarize outcomes and evidence.
