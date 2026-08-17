---
name: tutoria-team-observability
description: Record and evaluate actual Tutoria Codex subagent delegation. Use for every substantial orchestrated task so the user can verify which agents were genuinely used, what each did, whether it passed independent review, how much rework it caused, and any observable duration/token/cost data.
---

# Tutoria Team Observability

## Goal

Make multi-agent work auditable without fabricating telemetry.

A custom agent counts as **USED** only when a distinct delegated assignment is recorded before the agent is spawned and its outcome is recorded afterward. Loading its TOML or mentioning its name does not count.

## Storage

- Machine-readable run records: `.codex/team-runs/<run-id>.json`
- Aggregate human report: `.codex/TEAM_PERFORMANCE.md`
- Logger/report generator: `scripts/team-observability.py`

Do not store secrets, private user data, raw credentials, full model transcripts, or unnecessary source-code content in run records.

## Mandatory workflow for substantial tasks

### 1. Start a run

Before delegating meaningful work:

```bash
python3 scripts/team-observability.py start --task "<concise task>" --contract-path "docs/agent-team/qa-contracts/<run-id>-qa-contract.md"
```

Capture the printed run ID. Pass `--contract-path` when QA preflight produced a run-scoped acceptance contract.

### 2. Record each delegation before spawning

Immediately before spawning a specialist:

```bash
python3 scripts/team-observability.py begin-agent \
  --run "<run-id>" \
  --agent code_explorer \
  --reason "Need to identify the production code path before edits" \
  --assignment "Map the files and state flow for tutor profile publishing"
```

Capture the activity ID. Do this for every distinct delegated assignment, including repeated use of the same agent.

### 3. Finish each activity with evidence

After the specialist returns, record the result. Examples:

```bash
python3 scripts/team-observability.py end-agent \
  --run "<run-id>" \
  --activity code_explorer-1 \
  --status completed \
  --acceptance first_pass \
  --useful-findings 4 \
  --invalid-findings 0 \
  --artifact "Mapped discover -> backend tutor publication flow" \
  --check "Paths verified against current repository"
```

For implementation agents, include files changed, checks, rework count, and attributable QA failures. For QA/security/license/research/explorer agents, record valid/useful vs invalid findings where possible.

For `context_scout`, record its readiness state in the separate `--context-readiness READY|READY_WITH_GAPS|INPUT_RECOMMENDED|INPUT_REQUIRED` field (this is distinct from the run outcome status and from the generic `--verdict`, which may carry classification notes such as `PRODUCT_DECISION_REQUIRED`). List surfaced inputs in `--note`/`--artifact` so the final report can show `context_scout: invoked YES/NO` with status and reasons.

`acceptance` meanings:
- `first_pass`: accepted without needing that agent to redo its work.
- `after_rework`: accepted after one or more rework loops; record `--rework-count`.
- `rejected`: output was not usable or was superseded.
- `n_a`: independent acceptance does not sensibly apply; use sparingly.

### 4. Record contract changes when they occur

QA must not silently weaken the acceptance contract. When a criterion legitimately changes after implementation started, record the change before continuing:

```bash
python3 scripts/team-observability.py contract-change \
  --run "<run-id>" \
  --criterion "Original acceptance criterion" \
  --reason "Why it changed" \
  --authorized-by "Who/what approved it" \
  --revised "Revised criterion"
```

The orchestrator approves contract changes; the original criterion and revision remain auditable in the run record.

### 5. Record telemetry only when observable

If Codex actually exposes model/token/cost information, record it with the activity. Otherwise omit it. Never estimate.

Duration is derived automatically from the recorded activity start/end timestamps.

### 6. Finalize the run

After applicable implementation, tests, QA, security, and license gates:

```bash
python3 scripts/team-observability.py finalize \
  --run "<run-id>" \
  --status PASS \
  --summary "<what was accomplished>" \
  --test "<check>: PASS" \
  --qa PASS \
  --security N/A \
  --license N/A
```

Finalization regenerates `.codex/TEAM_PERFORMANCE.md`.

Do not mark PASS while any required gate is unverified or blocked.

## Live status

While Codex is working, inspect the latest run without opening JSON:

```bash
python3 scripts/team-observability.py status
```

Or inspect a specific run:

```bash
python3 scripts/team-observability.py status --run "<run-id>"
```

This shows each recorded specialist as RUNNING/COMPLETED/FAILED, its assignment, acceptance state, and observed elapsed time.

## Final user-facing activity section

For substantial tasks, include a concise section derived from the run record:

```text
Agent activity
- Code Explorer — USED — mapped affected architecture — accepted first pass
- Frontend Engineer — USED — implemented 4 files — accepted after 1 rework
- Browser QA — USED — found 3 valid issues — retest passed
- Security Reviewer — NOT NEEDED
- License Guard — NOT NEEDED

Team assessment
- Overall task result: PASS
- Significant value: Code Explorer, Browser QA
- Caused rework: Frontend Engineer (1 loop)
- Unnecessary invocations: none observed
- Missing specialists: none observed
- Routing recommendation: keep current routing
```

Only say `NOT NEEDED` when routing rules genuinely did not require the specialist. Do not manufacture an activity to make the team look busy.

## Scoring

`.codex/TEAM_PERFORMANCE.md` uses these default weights where evidence exists:
- 40% outcome/task success
- 25% independent reviewer acceptance
- 15% low rework/regression rate
- 10% efficiency
- 10% useful specialist contribution

The report reweights across available evidence. `Efficiency` remains N/A until a concrete normalized telemetry signal exists. Duration/tokens/cost are shown independently and are not converted into a made-up quality score.

Reviewer agents are judged by valid/useful findings and accepted contributions rather than code output.

## Integrity rules

- Never backfill a fake `begin-agent` after the fact just to claim an agent was USED.
- Never estimate tokens, cost, model, findings, acceptance, or QA attribution.
- Do not reward excessive agent invocation.
- One strong activity that prevented a serious bug can be more valuable than many low-value activities.
- Separate the agent that implemented a change from the independent reviewer when the routing policy requires independent review.
