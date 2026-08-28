# Tutoria Codex Agent Team

This pack configures a Codex-native team for the Tutoria/TutorMatch repository.

## Team

| Agent | Main job | Default behavior |
|---|---|---|
| Primary Codex thread | Orchestrator | Scope, delegate, merge, quality gate |
| `product_planner` | Product spec | Read-only |
| `product_designer` | UX/UI | Read-only |
| `code_explorer` | Code mapping | Read-only, low-cost |
| `context_scout` | Context sufficiency; founder input requests | Read-only |
| `frontend_engineer` | Frontend changes | Workspace write |
| `backend_engineer` | Backend/Supabase changes | Workspace write |
| `qa_browser` | Independent QA: preflight acceptance contracts + post-implementation verification | Browser/runtime evidence; no app-code edits |
| `security_reviewer` | Security/privacy | Read-only |
| `researcher` | Current research | Read-only, efficient |
| `license_guard` | OSS/IP gate | Read-only |

## How it works

Codex reads the root `AGENTS.md` automatically. The file tells the primary thread when to delegate and when not to.
Project-scoped custom agents are defined under `.codex/agents/`.
Reusable workflows live under `.agents/skills/`.

The system deliberately does **not** spawn every agent for every task. It uses cheap read-only subagents for exploration/research, stronger models for implementation/security, and an independent QA pass after user-facing changes.

## Example prompts

### End-to-end feature

> Build the tutor booking UI prototype end to end. Use the Tutoria agent team, keep prototype vs production boundaries explicit, and do not report completion until QA finishes.

### Production-safe auth work

> Fix the tutor onboarding auth flow. Use code_explorer, backend_engineer/frontend_engineer as needed, security_reviewer, and QA. Wait for all gates before summarizing.

### UI regression

> Fix this mobile layout bug. Use the smallest relevant team and have qa_browser independently retest desktop and mobile after the fix.

### External repository

> Use this repo to help implement X. Run the repo-license-guard first; if it fails, use a safe alternative and continue.

## Team rules worth keeping

- Read-heavy subagents may run in parallel.
- Avoid overlapping parallel code writes.
- Browser QA is independent of the implementation agent.
- Context Scout runs early for product-ambiguous or high-cost-assumption work; it searches Tutoria context first and never interrupts routine reversible work.
- QA preflight (acceptance contract) runs before implementation for non-trivial work; QA never makes product/domain decisions.
- Security review is mandatory for sensitive flows.
- External code/assets must pass the license gate before incorporation.
- Demo/localStorage/JSON-file behavior must never be silently promoted to production truth.

## Observability

For substantial work, the orchestrator records each real delegation in `.codex/team-runs/` and updates `.codex/TEAM_PERFORMANCE.md`.

An agent is only counted as `USED` when a distinct assignment was logged before delegation and closed with an outcome afterward. The dashboard tracks first-pass acceptance, rework, QA failures, useful/invalid findings, duration, and real Codex-exposed token/cost data when available.

See `docs/agent-team/OBSERVABILITY.md` for the workflow and commands.
