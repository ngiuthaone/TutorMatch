# Tutoria Agent Team Performance

Generated from `.codex/team-runs/*.json`. This report only uses recorded evidence; unavailable telemetry remains `N/A`.

## Team summary

- Recorded runs: **2**
- Completed runs: **2**
- PASS runs: **0** (0%)
- Average distinct agents per completed run: **1.0**

## Per-agent scorecard

| Agent | Assigned | Completed | First-pass | Rework | QA failures | Useful/invalid findings | Unnecessary | Avg time | Tokens | Cost | Effectiveness | Confidence | Trend |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| product_planner | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| product_designer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| code_explorer | 1 | 1 | 100% | 0 | 0 | 6/0 | 0 | 7s | N/A | N/A | 100/100 | Very low | Insufficient data |
| context_scout | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| frontend_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| backend_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| qa_browser | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| security_reviewer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| researcher | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| license_guard | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| database_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| integration_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| payments_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| qa_engineer | 1 | 1 | 0% | 2 | 0 | 7/0 | 0 | 1s | N/A | N/A | 83/100 | Very low | Insufficient data |
| independent_verifier | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| reliability_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |

### Effectiveness formula

Default weights: 40% outcome/task success, 25% independent reviewer acceptance, 15% low rework/regression, 10% efficiency, 10% useful specialist contribution.

`Efficiency` is intentionally `N/A` until there is a concrete normalized telemetry signal. Observable duration, tokens, and cost are displayed separately and are never turned into a fabricated quality score. When a component is unavailable, the overall score is reweighted across the components that have real evidence.

Reviewer agents (QA, security, license, research, explorer) are evaluated using valid/useful findings and accepted contributions rather than lines of code.

## Agent details

### `product_planner`

No recorded delegated work yet.

### `product_designer`

No recorded delegated work yet.

### `code_explorer`

- Overall effectiveness: **100/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `tutoria-launch-2026-09-01` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 6/0.

### `context_scout`

No recorded delegated work yet.

### `frontend_engineer`

No recorded delegated work yet.

### `backend_engineer`

No recorded delegated work yet.

### `qa_browser`

No recorded delegated work yet.

### `security_reviewer`

No recorded delegated work yet.

### `researcher`

No recorded delegated work yet.

### `license_guard`

No recorded delegated work yet.

### `database_engineer`

No recorded delegated work yet.

### `integration_engineer`

No recorded delegated work yet.

### `payments_engineer`

No recorded delegated work yet.

### `qa_engineer`

- Overall effectiveness: **83/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **0%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `tutoria-launch-2026-09-01` — completed / after_rework; rework 2; QA failures 0; useful/invalid findings 7/0.

### `independent_verifier`

No recorded delegated work yet.

### `reliability_engineer`

No recorded delegated work yet.

## Interpretation rules

- `USED` means a distinct activity was opened with an assignment and later completed/failed; merely loading an agent configuration does not count.
- First-pass acceptance is only counted when the orchestrator records `first_pass` after independent review or direct acceptance evidence.
- QA failures are attributed only when evidence connects a regression/failure to that agent's work.
- Token/cost/model fields must come from Codex-visible telemetry. Do not estimate them.
- Compare agents within their role. A QA agent finding many valid bugs can be performing very well even when it causes more rework downstream.
- A small team with a high PASS rate and low rework is usually healthier than a task that invokes every specialist.
