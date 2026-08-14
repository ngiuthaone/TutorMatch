# Tutoria Agent Team Observability

This layer answers two questions:

1. **Did Codex actually delegate to the specialist?**
2. **Was the specialist useful over time?**

## Proof of delegation

A specialist is counted as `USED` only if its activity is opened in the run log **before delegation** and closed afterward with an outcome. Merely loading `.codex/agents/*.toml` does not count.

Each substantial task receives a JSON record in `.codex/team-runs/` containing:
- run ID and task
- run-scoped QA acceptance contract path (when QA preflight was used) and any approved contract changes
- every delegated activity
- selection reason and assignment
- model only when observable
- start/end timestamps and measured elapsed time
- artifacts/files/checks
- first-pass/rework/rejected status
- attributable QA failures
- useful and invalid findings
- QA/security/license verdicts
- token/cost telemetry only when exposed by Codex

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

## Performance dashboard

`.codex/TEAM_PERFORMANCE.md` is generated from all run JSON files. It reports per agent:
- assignments and completions
- first-pass acceptance
- rework
- attributable QA failures
- useful/invalid findings
- average observed time
- observed tokens and cost
- effectiveness score
- trend

The report deliberately leaves missing telemetry as `N/A`.

## Commands

Initialize:

```bash
python3 scripts/team-observability.py init
```

Start a task (add `--contract-path` when QA preflight produced a run-scoped acceptance contract):

```bash
RUN_ID=$(python3 scripts/team-observability.py start --task "Audit tutor profile route ownership")
```

Record delegation:

```bash
ACTIVITY_ID=$(python3 scripts/team-observability.py begin-agent \
  --run "$RUN_ID" \
  --agent code_explorer \
  --reason "Need a read-only architecture map" \
  --assignment "Map tutor profile routes and identify production vs prototype paths")
```

Finish the activity:

```bash
python3 scripts/team-observability.py end-agent \
  --run "$RUN_ID" \
  --activity "$ACTIVITY_ID" \
  --status completed \
  --acceptance first_pass \
  --useful-findings 3 \
  --invalid-findings 0 \
  --check "Repository paths verified"
```

Record an approved change to the acceptance contract (never silently weaken the contract):

```bash
python3 scripts/team-observability.py contract-change \
  --run "$RUN_ID" \
  --criterion "Original criterion" \
  --reason "Why it changed" \
  --authorized-by "Who/what approved it" \
  --revised "Revised criterion"
```

Finalize:

```bash
python3 scripts/team-observability.py finalize \
  --run "$RUN_ID" \
  --status PASS \
  --summary "Read-only route ownership audit completed" \
  --qa N/A --security N/A --license N/A
```

Regenerate the report at any time:

```bash
python3 scripts/team-observability.py report
```

## What a healthy team looks like

Do not optimize for agent count. A healthy Tutoria team should gradually show:
- high task PASS rate
- high first-pass acceptance for implementers
- low regressions and rework
- high valid-finding ratio for QA/security/research/license reviewers
- fewer unnecessary specialists on small tasks
- observable token/time reductions when lower-cost read agents are sufficient

An agent that rarely runs can still be valuable if it is only needed for high-risk work.
