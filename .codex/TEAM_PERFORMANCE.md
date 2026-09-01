# Tutoria Agent Team Performance

Generated from `.codex/team-runs/*.json`. This report only uses recorded evidence; unavailable telemetry remains `N/A`.

## Team summary

- Recorded runs: **7**
- Completed runs: **4**
- PASS runs: **2** (50%)
- Average distinct agents per completed run: **4.0**

## Per-agent scorecard

| Agent | Assigned | Completed | First-pass | Rework | QA failures | Useful/invalid findings | Unnecessary | Avg time | Tokens | Cost | Effectiveness | Confidence | Trend |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| product_planner | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| product_designer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| code_explorer | 9 | 9 | 100% | 0 | 0 | 60/0 | 0 | 9.9m | N/A | N/A | 100/100 | Medium | Stable |
| context_scout | 2 | 2 | 100% | 0 | 0 | 10/0 | 0 | 1.5m | N/A | N/A | 100/100 | Very low | Insufficient data |
| frontend_engineer | 3 | 2 | 100% | 0 | 0 | 4/0 | 0 | 57.3m | N/A | N/A | 85/100 | Very low | Insufficient data |
| backend_engineer | 4 | 3 | 33% | 2 | 0 | 12/0 | 0 | 8.1h | N/A | N/A | 78/100 | Low | Insufficient data |
| qa_browser | 1 | 1 | 100% | 0 | 0 | 3/0 | 0 | 2.9m | N/A | N/A | 100/100 | Very low | Insufficient data |
| security_reviewer | 3 | 3 | 100% | 0 | 0 | 14/0 | 0 | 7.9m | N/A | N/A | 100/100 | Low | Insufficient data |
| researcher | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| license_guard | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| database_engineer | 3 | 3 | 67% | 0 | 0 | 10/0 | 0 | 6.6m | N/A | N/A | 91/100 | Low | Insufficient data |
| integration_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| payments_engineer | 0 | 0 | N/A | 0 | 0 | 0/0 | 0 | N/A | N/A | N/A | N/A | N/A | Insufficient data |
| qa_engineer | 3 | 3 | 67% | 0 | 0 | 15/0 | 0 | 17.7m | N/A | N/A | 100/100 | Low | Insufficient data |
| independent_verifier | 1 | 1 | 100% | 0 | 0 | 0/0 | 0 | 6.5m | N/A | N/A | 100/100 | Very low | Insufficient data |
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
- `20260828-001113-master-feature-technical-inventory-a` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 6/0.
- `20260828-001113-master-feature-technical-inventory-a` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 6/0.
- `20260828-001113-master-feature-technical-inventory-a` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 6/0.
- `20260829-110930-production-event-workshop-publicatio` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 9/0.
- `tutoria-launch-2026-08-31` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 7/0.

### `context_scout`

- Overall effectiveness: **100/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260827-230758-private-alpha-remediation-phases-1-1` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 4/0.
- `20260829-110930-production-event-workshop-publicatio` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 6/0.

### `frontend_engineer`

- Overall effectiveness: **85/100**
- Outcome/task success component: **67%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260829-110930-production-event-workshop-publicatio` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 4/0.
- `soft-launch-sprint-20260831` — running / N/A; rework 0; QA failures 0; useful/invalid findings 0/0.
- `tutor-link-2026-08-31` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 0/0.

### `backend_engineer`

- Overall effectiveness: **78/100**
- Outcome/task success component: **75%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **33%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260827-230758-private-alpha-remediation-phases-1-1` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 5/0.
- `20260829-110930-production-event-workshop-publicatio` — completed / after_rework; rework 1; QA failures 0; useful/invalid findings 3/0.
- `soft-launch-sprint-20260831` — running / N/A; rework 0; QA failures 0; useful/invalid findings 0/0.
- `tutoria-launch-2026-08-31` — completed / after_rework; rework 1; QA failures 0; useful/invalid findings 4/0.

### `qa_browser`

- Overall effectiveness: **100/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260829-110930-production-event-workshop-publicatio` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 3/0.

### `security_reviewer`

- Overall effectiveness: **100/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260827-230758-private-alpha-remediation-phases-1-1` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 4/0.
- `20260829-110930-production-event-workshop-publicatio` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 2/0.
- `tutoria-launch-2026-08-31` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 8/0.

### `researcher`

No recorded delegated work yet.

### `license_guard`

No recorded delegated work yet.

### `database_engineer`

- Overall effectiveness: **91/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **67%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260827-230758-private-alpha-remediation-phases-1-1` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 6/0.
- `20260827-230758-private-alpha-remediation-phases-1-1` — completed / n_a; rework 0; QA failures 0; useful/invalid findings 1/0.
- `20260829-110930-production-event-workshop-publicatio` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 3/0.

### `integration_engineer`

No recorded delegated work yet.

### `payments_engineer`

No recorded delegated work yet.

### `qa_engineer`

- Overall effectiveness: **100/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260829-110930-production-event-workshop-publicatio` — completed / after_rework; rework 0; QA failures 0; useful/invalid findings 4/0.
- `tutor-link-2026-08-31` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 0/0.
- `tutoria-launch-2026-08-31` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 11/0.

### `independent_verifier`

- Overall effectiveness: **100/100**
- Outcome/task success component: **100%**
- Reviewer acceptance component: **100%**
- Low rework/regression component: **100%**
- Efficiency component: **N/A**
- Specialist contribution component: **100%**

Recent activities:
- `20260829-110930-production-event-workshop-publicatio` — completed / first_pass; rework 0; QA failures 0; useful/invalid findings 0/0.

### `reliability_engineer`

No recorded delegated work yet.

## Interpretation rules

- `USED` means a distinct activity was opened with an assignment and later completed/failed; merely loading an agent configuration does not count.
- First-pass acceptance is only counted when the orchestrator records `first_pass` after independent review or direct acceptance evidence.
- QA failures are attributed only when evidence connects a regression/failure to that agent's work.
- Token/cost/model fields must come from Codex-visible telemetry. Do not estimate them.
- Compare agents within their role. A QA agent finding many valid bugs can be performing very well even when it causes more rework downstream.
- A small team with a high PASS rate and low rework is usually healthier than a task that invokes every specialist.
