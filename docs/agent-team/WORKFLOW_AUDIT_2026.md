---
# Tutoria AI Coding Workflow Audit

**Date**: 2026-10-12
**Scope**: Read-only evaluation of external agent workflow repositories against Tutoria's current agent operating system
**Status**: Complete — recommendations pending approval
---

## 1. Executive Summary

This audit evaluates four external agent workflow repositories against Tutoria's current Codex-based orchestration system to identify concrete, license-compatible improvements.

**Finding**: Tutoria's existing agent OS is more mature than all four evaluated repositories combined. The primary gaps are in *validation/parsing* of the agent OS definition, *CI parity checks*, and *machine-readable policy enforcement* — not in core orchestration.

**License classification**:

| Repository | License | Status | Action |
|---|---|---|---|
| `cgilldev/agent-workflow` | None (all rights reserved) | **BLOCKED** | Cannot incorporate; study only |
| `openai/openai-cookbook` | MIT | PASS | Adapt specific patterns |
| `GavinGreenwood/agentic-workflow-template` | MIT | PASS | Adapt CI + setup action |
| `Atakan-Emre/agentic-workflow-lab` | MIT | PASS | Study architecture; adapt policy/validation layer concepts |

**Top recommendation**: Adopt the Atakan-Emre-style *policy-as-code + validation layer* pattern within Tutoria's existing structure — this is the single highest-leverage improvement with lowest risk.

---

## 2. Current-State Workflow Map (Tutoria)

### 2.1 Agent Orchestration
- **Primary**: Codex orchestrator (`AGENTS.md` — 257 lines)
- **Subagents**: 8 base + 6 production specialists (V2) = 14 total
- **Skills**: 31 skills in `.agents/skills/tutoria-*` (routing, context-scout, evidence-map, handoff-contract, requirement-traceability, domain-modeling, capacity-concurrency, supabase-persistence, postgres-concurrency, rls-review, application-services, idempotency-outbox, payment-integration, payment-webhooks, backend-qa, browser-qa, independent-verification, server-authoritative-ui, production-reliability, product-policy, skill-ingestion, external-reference, task-routing, team-observability, orchestrator, frontend-uxui-workflow, postgres-concurrency, capacity-concurrency, server-authoritative-ui)
- **Routing matrix**: `AGENT_RESPONSIBILITY_SKILL_MATRIX_V2.md`, `AGENT_ROUTING_MATRIX_V2.md`, `AGENT_SKILL_PHASE_ACTIVATION_V2.md` (referenced but location not fully verified in this audit)

### 2.2 CI/CD Pipeline (`.github/workflows/ci.yml`)
- **backend**: typecheck + lint + test + build (pnpm, Node 22)
- **discover**: typecheck + lint + test + build (npm, Node 22)
- **supabase-schema**: dry-run migrations + RLS verification on 13 tables + index verification on 5 indexes
- **e2e**: Playwright chromium (runs on push, waits for server readiness)

### 2.3 Validation Infrastructure (present)
- `scripts/oss_guard.py` — full OSS license gate (ci, validate, generate-notices, registry subcommands)
- `scripts/validate-agent-os-v2-pack.py` — validates `.codex/agents/*.toml` + `.agents/skills/*/SKILL.md` structure
- `scripts/validate-team.py` — team performance validation
- `scripts/team-observability.py` — 725-line observability system (.codex/team-runs/*.json → TEAM_PERFORMANCE.md)
- `scripts/security-scan.sh` → delegates to `.agents/skills/tutoria-security-guard/scripts/security-scan.sh`

### 2.4 External Source Governance (present, robust)
- `docs/OSS_POLICY.md` — 91-line conservative policy
- `oss/REPO_POLICY.json` — 13-entry hint registry (Supabase, Tiptap, shadcn/ui, Medusa, MapLibre, LiveKit, Trigger.dev, FullCalendar, Cal.diy, Meilisearch, Novu, PostHog, actions/checkout, actions/setup-python)
- `oss/EXTERNAL_SOURCES.json` — 20-entry exact-source ledger (all PASS, verified 2026-08-12 to 2026-09-17)
- `THIRD_PARTY_NOTICES.md` — auto-generated from ledger
- `python3 scripts/oss_guard.py ci` → **PASS** (verified this audit session)

### 2.5 Identified Gap: Missing `typecheck` in discover
The `discover/package.json` has no `typecheck` script, but CI calls `npm run typecheck && npm run lint` (line 47 of `ci.yml`). This would **fail in a clean CI run**.

---

## 3. External Repository Analysis

### 3.1 cgilldev/agent-workflow (BLOCKED — no LICENSE)

**Pattern**: File-based shell task system using `$plan-task` / `$run-task` / `$review-task` conventions with state files in `.agents/local-agent/`.

**Assessment**:
- **No LICENSE file** — GitHub API returned 404 for `/license` and `/contents/LICENSE`. All rights reserved. **Cannot incorporate.**
- File-based state management (flat JSON/text in `.agents/local-agent/`) is redundant — Tutoria uses `scripts/team-observability.py` with structured `.codex/team-runs/*.json` which is superior.
- Shell-based task queue approach is a step backwards from Codex's native orchestration.

**Verdict**: STUDY_ONLY. No code adoption. The flat-file state pattern is not needed.

### 3.2 openai/openai-cookbook (MIT)

**Pattern**: `.codex/skills/docs-editor/SKILL.md` — a 7-step editorial review skill with P0-P3 prioritization and automated validation.

**Adoptable elements**:
- P0-P3 issue prioritization framework (currently Tutoria uses "pass/fail" for doc reviews)
- `check_notebooks.py` pattern — a pre-commit/CI validator for content structure
- Style guide loading mechanism (`resources/style-guide.md`)

**Evidence path**: `openai-cookbook/.codex/skills/docs-editor/SKILL.md` (lines 50-60: priority definitions)

**Verdict**: ADAPT — adopt the priority-tier system for Tutoria's documentation review, not the notebook validator (Tutoria has no notebooks).

### 3.3 GavinGreenwood/agentic-workflow-template (MIT)

**Pattern**: CI with 5 parallel jobs (parity, lint, typecheck, unit, integration), reusable composite setup action, `.codex/hooks.json` gate system.

**Adoptable elements**:
- `.github/actions/setup/action.yml` — Node 24 + npm cache + dependency install (can be adapted to Tutoria's pnpm/npm split)
- `.codex/hooks.json` — PreToolUse/PostToolUse/Stop hooks (security/compliance gates)
- Playwright MCP integration pattern

**Evidence path**: `GavinGreenwood/.github/actions/setup/action.yml`, `GavinGreenwood/.codex/hooks.json`

**Key limitation**: Uses Node 24; Tutoria uses Node 22 (backend) and ^16 (discover Next.js). Would need adaptation.

**Verdict**: ADAPT selectively — the setup action and hooks concept are valuable; Node version needs adjustment.

### 3.4 Atakan-Emre/agentic-workflow-lab (MIT)

**Pattern**: Explicit 6-layer architecture (Instruction → Capability → Policy → Validation → MCP tools), policy-as-code YAML files, pytest-based validation.

**Adoptable elements**:
- **Policy layer** (`policies/*.yaml`) — machine-readable constraints (tool-policy, approval-policy, security-policy)
- **Validation layer** — `validate_agentic_repo.py` + pytest that checks manifests, policies, instruction structure
- **Layer boundary enforcement** — "Do not collapse layers" principle
- **Risky keyword / forbidden command warnings** in validation

**Evidence paths**:
- `Atakan-Emre/docs/architecture.md` — the 6-layer architecture
- `Atakan-Emre/.cursor/rules/agentic-architecture.mdc` — "Do not collapse layers" boundary rules
- `Atakan-Emre/pyproject.toml` — Python project structure (pytest + ruff)

**Verdict**: ADAPT — the policy-as-code + validation layer is the highest-value pattern. Tutoria already has `validate-agent-os-v2-pack.py` but lacks machine-readable policy YAML + pytest-based enforcement.

---

## 4. Top-5 Improvements (Ranked)

### Improvement #1: Adopt Atakan-Emre's Policy-as-Code + Validation Layer
**Rank**: 1 (highest leverage, lowest risk)

**Problem**: Tutoria's agent OS rules are in `AGENTS.md` (human-readable only). There's no machine-readable policy layer that CI can enforce. The existing `validate-agent-os-v2-pack.py` validates structure but not policy.

**Solution**: Introduce a `policies/` directory with YAML policy files and extend `validate-agent-os-v2-pack.py` with pytest-based checks:
- `policies/tool-policy.yaml` — tool allow/deny lists
- `policies/approval-policy.yaml` — when to escalate to human approval
- `policies/security-policy.yaml` — forbidden patterns, dangerous commands

**Pattern source**: Atakan-Emre `agentic-workflow-lab` layers 3-4 (`policies/*.yaml` + `validate_agentic_repo.py`)

**Files to add**:
- `policies/tool-policy.yaml` (new)
- `policies/approval-policy.yaml` (new)
- `policies/security-policy.yaml` (new)
- Extend `scripts/validate-agent-os-v2-pack.py` to validate against policies, or add `scripts/validate-policies.py`

**Risk**: Low. Additive only. Existing `AGENTS.md` remains authoritative human-readable source.
**Compatibility**: Fully compatible with existing Codex + OpenCode toolchain.
**Rollback**: Delete `policies/` directory + revert script changes.

### Improvement #2: Fix `discover/package.json` Missing `typecheck` Script
**Rank**: 2 (critical bug, trivial fix)

**Problem**: CI calls `npm run typecheck` (ci.yml:47) but discover has no `typecheck` script. CI would fail on a clean run.

**Solution**: Add `"typecheck": "tsc --noEmit"` to discover/package.json scripts.

**Files to modify**: `discover/package.json` (add 1 line)

**Risk**: None — this is a bug fix.
**Rollback**: Remove the added line.

### Improvement #3: Adopt GavinGreenwood's Reusable CI Setup Action
**Rank**: 3 (medium leverage, low risk)

**Problem**: Both backend and discover CI jobs independently set up Node 22 + dependency cache. No reuse.

**Solution**: Extract a composite action `.github/actions/setup-project/action.yml` that handles checkout + Node setup + dependency install with cache, parameterized by working directory and package manager.

**Pattern source**: `GavinGreenwood/.github/actions/setup/action.yml` (Node 24 version, adapted to 22)

**Files to add**:
- `.github/actions/setup-project/action.yml` (new composite action)

**Files to modify**:
- `.github/workflows/ci.yml` (refactor backend+discover jobs to use the action)

**Risk**: Low — CI is idempotent; the action just encapsulates existing steps.
**Compatibility**: Compatible with existing pnpm (backend) and npm (discover) workflows.
**Rollback**: Revert ci.yml to inline steps; delete the action directory.

### Improvement #4: Adopt OpenAI Cookbook's P0-P3 Documentation Review Priority System
**Rank**: 4 (medium leverage, low risk)

**Problem**: Tutoria's documentation review (via `docs-editor` skill reference) lacks structured issue prioritization. Reviews are pass/fail without severity tiers.

**Solution**: Adopt the P0-P3 priority framework from openai-cookbook's docs-editor skill, documenting it as a Tutoria skill or in the existing review workflow.

**Pattern source**: `openai-cookbook/.codex/skills/docs-editor/SKILL.md` (lines 50-60: priority definitions)

**Files to add**:
- `.agents/skills/tutoria-docs-review/SKILL.md` (new skill or extend existing)

Or document in `docs/agent-team/` as a review standard.

**Risk**: Low — editorial only.
**Rollback**: Delete the new skill file or remove the documented standard.

### Improvement #5: CI Parity Job to Verify discover/build Parity
**Rank**: 5 (medium leverage, low risk)

**Problem**: CI has separate jobs for backend and discover but no explicit parity check (e.g., does discover build produce consistent output, are e2e tests aligned with unit tests). The GavinGreenwood template has a dedicated "parity" CI job.

**Solution**: Add a CI job that verifies package consistency: e.g., that `discover`'s ESLint config matches `backend`'s where applicable, TypeScript versions are aligned, and e2e test results are reported as a gate.

**Pattern source**: `GavinGreenwood/.github/workflows/ci.yml` (parity job as first of 5 parallel jobs)

**Files to modify**:
- `.github/workflows/ci.yml` (add new `parity` job)

**Risk**: Low — additive CI job.
**Rollback**: Remove the new job from ci.yml.

---

## 5. Proposed Files to Add/Modify Summary

| File | Action | Source | License |
|---|---|---|---|
| `policies/tool-policy.yaml` | ADD | Atakan-Emre | MIT |
| `policies/approval-policy.yaml` | ADD | Atakan-Emre | MIT |
| `policies/security-policy.yaml` | ADD | Atakan-Emre | MIT |
| `scripts/validate-policies.py` | ADD (or extend existing) | Atakan-Emre pattern | MIT |
| `discover/package.json` | MODIFY (+1 line) | Tutoria fix | — |
| `.github/actions/setup-project/action.yml` | ADD | GavinGreenwood | MIT |
| `.github/workflows/ci.yml` | MODIFY | GavinGreenwood pattern | MIT |
| `.agents/skills/tutoria-docs-review/SKILL.md` | ADD | OpenAI Cookbook | MIT |
| `.codex/hooks.json` | ADD (optional) | GavinGreenwood pattern | MIT |
| `.gitignore` or `.codex/.gitignore` | MODIFY (if needed for state files) | — | — |

---

## 6. Risks / Compatibility / Rollback

### Risks
| Risk | Mitigation |
|---|---|
| Policy YAML files become out of sync with AGENTS.md | CI validation script enforces sync; human-readable docs remain authoritative |
| Setup action uses wrong Node version | Pin to Node 22 (matching current CI); document version policy |
| P0-P3 priority system conflicts with existing review workflow | Document as advisory; no enforcement in CI |
| cgilldev patterns create temptation to bypass license gate | STUDY_ONLY classification documented in this audit; no code paths incorporated |

### Compatibility
- All proposed changes are additive or fix bugs
- No changes to production code, DB migrations, deployment config, or secrets
- All proposed source material is MIT or Tutoria-owned
- No new dependencies introduced (policy files are static YAML; validation uses existing Python)

### Rollback
Every proposed change is reversible by deleting the new file(s) or reverting the line change. No migration or state transformation is required.

---

## 7. Pilot: Improvement #1 (Policy-as-Code + Validation Layer)

**Pilot scope**: Implement `policies/security-policy.yaml` + extend validation with a pytest-based check

**Acceptance criteria**:
1. `policies/security-policy.yaml` exists with at least 3 forbidden command patterns (e.g., `rm -rf /`, `DROP TABLE`, `curl ... | bash`)
2. `python3 scripts/validate-policies.py` exists and exits 0 when policies are well-formed
3. `python3 scripts/validate-policies.py` exits non-zero when a skill's SKILL.md references a forbidden pattern
4. OSS gate still passes: `python3 scripts/oss_guard.py ci` outputs `OSS LICENSE GATE: PASS`
5. Existing `python3 scripts/validate-agent-os-v2-pack.py` still passes (no regression)

**Evidence path**:
- Policy definitions: `Atakan-Emre/agentic-workflow-lab/policies/security-policy.yaml`
- Validation runner: `Atakan-Emre/agentic-workflow-lab/scripts/validate_agentic_repo.py`
- Forbidden keyword patterns: `Atakan-Emre/agentic-workflow-lab/.cursor/rules/security-rules.mdc`

---

## 8. Sources Consulted

### Repositories fetched and audited (local shallow clones)
| Repo | Path | License |
|---|---|---|
| cgilldev/agent-workflow | `/tmp/tutoria-reuse-audit/agent-workflow` | Not found (BLOCKED) |
| openai/openai-cookbook | `/tmp/tutoria-reuse-audit/openai-cookbook` | MIT |
| GavinGreenwood/agentic-workflow-template | `/tmp/tutoria-reuse-audit/agentic-workflow-template` | MIT |
| Atakan-Emre/agentic-workflow-lab | `/tmp/tutoria-reuse-audit/agentic-workflow-lab` | MIT |

### Key files read
- `AGENTS.md` (Tutoria, 257 lines)
- `discover/package.json`, `backend/package.json`
- `.github/workflows/ci.yml` (161 lines)
- `docs/OSS_POLICY.md` (91 lines)
- `oss/REPO_POLICY.json` (143 lines)
- `oss/EXTERNAL_SOURCES.json` (962 lines, 20 entries)
- `scripts/oss_guard.py` (298 lines)
- `scripts/validate-agent-os-v2-pack.py` (134 lines)
- `scripts/team-observability.py` (725 lines)
- `.agents/skills/tutoria-skill-ingestion/SKILL.md`
- `.agents/skills/tutoria-security-guard/SKILL.md`
- `THIRD_PARTY_NOTICES.md` (exists, auto-generated)

### Upstream files reviewed
- `openai-cookbook/.codex/skills/docs-editor/SKILL.md` — 7-step editorial review, P0-P3 tiers
- `openai-cookbook/AGENTS.md` — coding standards, commit conventions
- `GavinGreenwood/.github/actions/setup/action.yml` — composite setup action
- `GavinGreenwood/.github/workflows/ci.yml` — 5-job parallel CI
- `GavinGreenwood/.codex/hooks.json` — agent hook gates
- `GavinGreenwood/ADOPT.md` — adoption playbook
- `Atakan-Emre/docs/architecture.md` — 6-layer architecture
- `Atakan-Emre/.cursor/rules/agentic-architecture.mdc` — layer boundary rules
- `Atakan-Emre/AGENTS.md` — repo guidelines
- `Atakan-Emre/pyproject.toml` — Python project structure

### License verification results
- `oss_guard.py ci` → **PASS** (this audit session: `OSS LICENSE GATE: PASS`)
- `cgilldev/agent-workflow`: GitHub API returned 404 for `/contents/LICENSE` — **no license found → BLOCKED**
- All other repos: LICENSE file verified present at canonical repo root, MIT

---

## 9. Agent Activity Summary

| Activity | Agent | Status |
|---|---|---|
| Repo discovery + git clone | primary | PASS |
| License verification (4 repos) | primary | PASS (1 BLOCKED: cgilldev) |
| OSS gate verification | `oss_guard.py ci` | PASS |
| Tutoria infra audit (CI, scripts, skills) | primary | PASS |
| Upstream file fetch + analysis | primary | PASS |
| Cross-repo pattern synthesis | primary | PASS |

## 10. Final Status

**PASS** — Audit complete, no code changes made. This is a read-only evaluation producing recommendations awaiting user approval.
