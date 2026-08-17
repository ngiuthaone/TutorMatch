#!/usr/bin/env python3
"""Lightweight observability for the Tutoria Codex agent team.

Stores machine-readable run records in .codex/team-runs/ and regenerates
.codex/TEAM_PERFORMANCE.md from observed evidence. It never estimates tokens,
cost, or model data that Codex did not expose.
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

AGENTS = [
    "product_planner",
    "product_designer",
    "code_explorer",
    "context_scout",
    "frontend_engineer",
    "backend_engineer",
    "qa_browser",
    "security_reviewer",
    "researcher",
    "license_guard",
    "database_engineer",
    "integration_engineer",
    "payments_engineer",
    "qa_engineer",
    "independent_verifier",
    "reliability_engineer",
]

REVIEWER_AGENTS = {"qa_browser", "security_reviewer", "license_guard", "researcher", "code_explorer", "context_scout", "independent_verifier"}
STATUS_VALUES = {"PASS", "PARTIAL", "UNVERIFIED", "BLOCKED"}
ACTIVITY_STATUS_VALUES = {"completed", "failed", "cancelled"}
ACCEPTANCE_VALUES = {"first_pass", "after_rework", "rejected", "n_a"}
CONTEXT_READINESS_VALUES = {"READY", "READY_WITH_GAPS", "INPUT_RECOMMENDED", "INPUT_REQUIRED"}

WEIGHTS = {
    "outcome": 40.0,
    "reviewer_acceptance": 25.0,
    "rework_regression": 15.0,
    "efficiency": 10.0,
    "specialist_contribution": 10.0,
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def repo_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    return Path.cwd().resolve()


def data_dir(root: Path) -> Path:
    return root / ".codex" / "team-runs"


def report_path(root: Path) -> Path:
    return root / ".codex" / "TEAM_PERFORMANCE.md"


def safe_run_id(task: str) -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = "".join(c.lower() if c.isalnum() else "-" for c in task).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    short = (slug[:36].strip("-") or "task")
    return f"{stamp}-{short}"


def run_file(root: Path, run_id: str) -> Path:
    return data_dir(root) / f"{run_id}.json"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_run(root: Path, run_id: str) -> tuple[Path, dict[str, Any]]:
    path = run_file(root, run_id)
    if not path.exists():
        raise SystemExit(f"Unknown run: {run_id}")
    return path, read_json(path)


def list_runs(root: Path) -> list[dict[str, Any]]:
    directory = data_dir(root)
    if not directory.exists():
        return []
    runs = []
    for path in sorted(directory.glob("*.json")):
        try:
            run = read_json(path)
        except Exception as exc:
            print(f"warning: skipping invalid run file {path.name}: {exc}", file=sys.stderr)
            continue
        if run.get("schema_version") == 1:
            runs.append(run)
    return runs


def split_multi(values: list[str] | None) -> list[str]:
    if not values:
        return []
    result: list[str] = []
    for value in values:
        for part in value.split("|"):
            part = part.strip()
            if part:
                result.append(part)
    return result


def activity_by_id(run: dict[str, Any], activity_id: str) -> dict[str, Any]:
    for activity in run.get("activities", []):
        if activity.get("id") == activity_id:
            return activity
    raise SystemExit(f"Unknown activity {activity_id!r} in run {run.get('run_id')}")


def cmd_init(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    directory = data_dir(root)
    directory.mkdir(parents=True, exist_ok=True)
    keep = directory / ".gitkeep"
    keep.touch(exist_ok=True)
    generate_report(root)
    print(f"Initialized Tutoria team observability in {root}")


def cmd_start(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    run_id = args.run_id or safe_run_id(args.task)
    path = run_file(root, run_id)
    if path.exists():
        raise SystemExit(f"Run already exists: {run_id}")
    run = {
        "schema_version": 1,
        "run_id": run_id,
        "task": args.task,
        "started_at": utc_now(),
        "completed_at": None,
        "final_status": None,
        "summary": None,
        "contract_path": args.contract_path,
        "contract_changes": [],
        "activities": [],
        "tests": [],
        "qa_verdict": "N/A",
        "security_verdict": "N/A",
        "license_verdict": "N/A",
        "notes": [],
        "routing_assessment": {"unnecessary_invocations": [], "missing_specialists": [], "recommendation": None},
    }
    write_json(path, run)
    print(run_id)


def cmd_begin_agent(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    path, run = load_run(root, args.run)
    if args.agent not in AGENTS:
        raise SystemExit(f"Unknown agent {args.agent!r}. Expected one of: {', '.join(AGENTS)}")
    same = [a for a in run.get("activities", []) if a.get("agent") == args.agent]
    activity_id = args.activity_id or f"{args.agent}-{len(same)+1}"
    if any(a.get("id") == activity_id for a in run.get("activities", [])):
        raise SystemExit(f"Activity already exists: {activity_id}")
    activity = {
        "id": activity_id,
        "agent": args.agent,
        "reason": args.reason,
        "assignment": args.assignment,
        "model": args.model or None,
        "started_at": utc_now(),
        "completed_at": None,
        "duration_seconds": None,
        "status": "running",
        "acceptance": None,
        "context_readiness": None,
        "rework_count": 0,
        "artifacts": [],
        "files_changed": [],
        "checks": [],
        "useful_findings": 0,
        "invalid_findings": 0,
        "qa_failures_attributed": 0,
        "verdict": None,
        "tokens": {"input": None, "output": None, "total": None, "cost_usd": None, "source": None},
        "notes": [],
    }
    run.setdefault("activities", []).append(activity)
    write_json(path, run)
    print(activity_id)


def cmd_end_agent(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    path, run = load_run(root, args.run)
    activity = activity_by_id(run, args.activity)
    if activity.get("status") != "running":
        raise SystemExit(f"Activity is not running: {args.activity}")
    if args.status not in ACTIVITY_STATUS_VALUES:
        raise SystemExit(f"Invalid activity status: {args.status}")
    if args.acceptance not in ACCEPTANCE_VALUES:
        raise SystemExit(f"Invalid acceptance value: {args.acceptance}")
    if args.context_readiness is not None and args.context_readiness not in CONTEXT_READINESS_VALUES:
        raise SystemExit(f"Invalid context readiness: {args.context_readiness}")

    completed = utc_now()
    start_dt = parse_time(activity.get("started_at"))
    end_dt = parse_time(completed)
    duration = None
    if start_dt and end_dt:
        duration = max(0, int((end_dt - start_dt).total_seconds()))

    activity.update(
        {
            "completed_at": completed,
            "duration_seconds": duration,
            "status": args.status,
            "acceptance": args.acceptance,
            "context_readiness": args.context_readiness,
            "rework_count": max(0, args.rework_count),
            "artifacts": split_multi(args.artifact),
            "files_changed": split_multi(args.file),
            "checks": split_multi(args.check),
            "useful_findings": max(0, args.useful_findings),
            "invalid_findings": max(0, args.invalid_findings),
            "qa_failures_attributed": max(0, args.qa_failures),
            "verdict": args.verdict or None,
            "notes": split_multi(args.note),
        }
    )

    token_values = [args.input_tokens, args.output_tokens, args.total_tokens, args.cost_usd]
    if any(v is not None for v in token_values):
        activity["tokens"] = {
            "input": args.input_tokens,
            "output": args.output_tokens,
            "total": args.total_tokens,
            "cost_usd": args.cost_usd,
            "source": args.token_source or "Codex-observed",
        }
    if args.model:
        activity["model"] = args.model
    write_json(path, run)
    print(f"Recorded {args.activity}")


def cmd_contract_change(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    path, run = load_run(root, args.run)
    if run.get("final_status"):
        raise SystemExit(f"Cannot record a contract change on finalized run {args.run}")
    change = {
        "recorded_at": utc_now(),
        "criterion": args.criterion,
        "reason": args.reason,
        "authorized_by": args.authorized_by,
        "revised": args.revised,
    }
    run.setdefault("contract_changes", []).append(change)
    write_json(path, run)
    print(f"Recorded contract change {len(run['contract_changes'])} for {args.run}")


def cmd_finalize(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    path, run = load_run(root, args.run)
    if args.status not in STATUS_VALUES:
        raise SystemExit(f"Invalid run status: {args.status}")
    running = [a.get("id") for a in run.get("activities", []) if a.get("status") == "running"]
    if running and not args.allow_running:
        raise SystemExit("Cannot finalize while activities are running: " + ", ".join(running))
    run.update(
        {
            "completed_at": utc_now(),
            "final_status": args.status,
            "summary": args.summary,
            "tests": split_multi(args.test),
            "qa_verdict": args.qa,
            "security_verdict": args.security,
            "license_verdict": args.license,
            "notes": split_multi(args.note),
            "routing_assessment": {
                "unnecessary_invocations": split_multi(args.unnecessary_agent),
                "missing_specialists": split_multi(args.missing_agent),
                "recommendation": args.routing_recommendation or None,
            },
        }
    )
    write_json(path, run)
    generate_report(root)
    print(f"Finalized {args.run}: {args.status}")


def percentage(num: float, den: float) -> float | None:
    if den <= 0:
        return None
    return 100.0 * num / den


def fmt_pct(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.0f}%"


def fmt_score(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.0f}/100"


def fmt_duration(seconds: float | None) -> str:
    if seconds is None:
        return "N/A"
    if seconds < 60:
        return f"{seconds:.0f}s"
    if seconds < 3600:
        return f"{seconds/60:.1f}m"
    return f"{seconds/3600:.1f}h"


def weighted_score(components: dict[str, float | None]) -> float | None:
    total_weight = 0.0
    total = 0.0
    for key, value in components.items():
        if value is None:
            continue
        weight = WEIGHTS[key]
        total_weight += weight
        total += (value / 100.0) * weight
    if total_weight == 0:
        return None
    return 100.0 * total / total_weight


def effectiveness_for(agent: str, activities: list[dict[str, Any]]) -> tuple[float | None, dict[str, float | None]]:
    if not activities:
        components = {k: None for k in WEIGHTS}
        return None, components

    completed = [a for a in activities if a.get("status") == "completed"]
    outcome = percentage(len(completed), len(activities))

    if agent in REVIEWER_AGENTS:
        useful = sum(int(a.get("useful_findings") or 0) for a in completed)
        invalid = sum(int(a.get("invalid_findings") or 0) for a in completed)
        finding_total = useful + invalid
        reviewer_acceptance = percentage(useful, finding_total) if finding_total else percentage(
            sum(1 for a in completed if a.get("acceptance") in {"first_pass", "after_rework", "n_a"}),
            len(completed),
        )
        rework_regression = percentage(max(0, finding_total - invalid), finding_total) if finding_total else percentage(
            sum(1 for a in completed if int(a.get("qa_failures_attributed") or 0) == 0),
            len(completed),
        )
        specialist_contribution = percentage(
            sum(1 for a in completed if int(a.get("useful_findings") or 0) > 0 or a.get("acceptance") in {"first_pass", "after_rework", "n_a"}),
            len(completed),
        )
    else:
        accepted = [a for a in completed if a.get("acceptance") in {"first_pass", "after_rework"}]
        reviewer_acceptance = percentage(len(accepted), len(completed))
        clean = [a for a in completed if int(a.get("rework_count") or 0) == 0 and int(a.get("qa_failures_attributed") or 0) == 0]
        rework_regression = percentage(len(clean), len(completed))
        specialist_contribution = percentage(
            sum(1 for a in completed if a.get("acceptance") in {"first_pass", "after_rework"} or int(a.get("useful_findings") or 0) > 0),
            len(completed),
        )

    # Efficiency is deliberately N/A unless a concrete normalized efficiency score
    # is recorded by a future telemetry integration. Duration/tokens are reported,
    # but not converted into a made-up quality score.
    efficiency = None

    components = {
        "outcome": outcome,
        "reviewer_acceptance": reviewer_acceptance,
        "rework_regression": rework_regression,
        "efficiency": efficiency,
        "specialist_contribution": specialist_contribution,
    }
    return weighted_score(components), components


def trend_for(activities: list[dict[str, Any]]) -> str:
    completed = [a for a in activities if a.get("status") == "completed"]
    if len(completed) < 4:
        return "Insufficient data"
    scores = []
    for a in completed:
        s = 1.0
        if a.get("acceptance") == "rejected":
            s -= 0.6
        elif a.get("acceptance") == "after_rework":
            s -= 0.2
        s -= min(0.5, 0.1 * int(a.get("rework_count") or 0))
        s -= min(0.5, 0.15 * int(a.get("qa_failures_attributed") or 0))
        useful = int(a.get("useful_findings") or 0)
        invalid = int(a.get("invalid_findings") or 0)
        if useful + invalid:
            s *= useful / (useful + invalid)
        scores.append(s)
    half = max(2, len(scores) // 2)
    earlier = statistics.mean(scores[:-half]) if scores[:-half] else statistics.mean(scores[:half])
    recent = statistics.mean(scores[-half:])
    delta = recent - earlier
    if delta > 0.08:
        return "Improving"
    if delta < -0.08:
        return "Declining"
    return "Stable"


def confidence_for(n: int) -> str:
    if n == 0:
        return "N/A"
    if n <= 2:
        return "Very low"
    if n <= 4:
        return "Low"
    if n <= 9:
        return "Medium"
    return "High"


def latest_run(root: Path) -> dict[str, Any] | None:
    runs = list_runs(root)
    if not runs:
        return None
    return max(runs, key=lambda r: r.get("started_at") or "")


def cmd_status(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    if args.run:
        _, run = load_run(root, args.run)
    else:
        run = latest_run(root)
        if run is None:
            print("No Tutoria team runs recorded yet.")
            return
    overall = run.get("final_status") or "RUNNING"
    print(f"Run: {run.get('run_id')}")
    print(f"Task: {run.get('task')}")
    print(f"Status: {overall}")
    if run.get("contract_path"):
        changes = len(run.get("contract_changes") or [])
        print(f"QA contract: {run.get('contract_path')} ({changes} recorded change(s))")
    print("Agent activity:")
    activities = run.get("activities", [])
    if not activities:
        print("- No delegated agents recorded yet")
    for a in activities:
        status = str(a.get("status") or "unknown").upper()
        duration = a.get("duration_seconds")
        if duration is None and a.get("status") == "running":
            start = parse_time(a.get("started_at"))
            if start:
                duration = max(0, int((datetime.now(timezone.utc) - start).total_seconds()))
        acceptance = a.get("acceptance") or "pending"
        readiness = f" [readiness: {a['context_readiness']}]" if a.get("context_readiness") else ""
        print(f"- {a.get('agent')} — {status} — {acceptance}{readiness} — {fmt_duration(duration)}")
        print(f"  assignment: {a.get('assignment')}")
    if run.get("final_status"):
        routing = run.get("routing_assessment") or {}
        unneeded = routing.get("unnecessary_invocations") or []
        missing = routing.get("missing_specialists") or []
        print(f"QA: {run.get('qa_verdict', 'N/A')} | Security: {run.get('security_verdict', 'N/A')} | License: {run.get('license_verdict', 'N/A')}")
        print("Unnecessary invocations: " + (", ".join(unneeded) if unneeded else "none recorded"))
        print("Missing specialists: " + (", ".join(missing) if missing else "none recorded"))
        if routing.get("recommendation"):
            print(f"Routing recommendation: {routing['recommendation']}")


def generate_report(root: Path) -> None:
    runs = list_runs(root)
    rows = []
    detailed = []
    for agent in AGENTS:
        activities: list[dict[str, Any]] = []
        for run in runs:
            for activity in run.get("activities", []):
                if activity.get("agent") == agent:
                    enriched = dict(activity)
                    enriched["_run_status"] = run.get("final_status")
                    enriched["_run_id"] = run.get("run_id")
                    activities.append(enriched)

        completed = [a for a in activities if a.get("status") == "completed"]
        first_pass = [a for a in completed if a.get("acceptance") == "first_pass"]
        rework_count = sum(int(a.get("rework_count") or 0) for a in completed)
        qa_failures = sum(int(a.get("qa_failures_attributed") or 0) for a in completed)
        useful = sum(int(a.get("useful_findings") or 0) for a in completed)
        invalid = sum(int(a.get("invalid_findings") or 0) for a in completed)
        durations = [float(a["duration_seconds"]) for a in completed if a.get("duration_seconds") is not None]
        tokens = [int(a["tokens"]["total"]) for a in completed if a.get("tokens", {}).get("total") is not None]
        costs = [float(a["tokens"]["cost_usd"]) for a in completed if a.get("tokens", {}).get("cost_usd") is not None]
        score, components = effectiveness_for(agent, activities)

        unnecessary_count = sum(
            1
            for run in runs
            for name in (run.get("routing_assessment") or {}).get("unnecessary_invocations", [])
            if name == agent
        )
        rows.append(
            [
                agent,
                str(len(activities)),
                str(len(completed)),
                fmt_pct(percentage(len(first_pass), len(completed))),
                str(rework_count),
                str(qa_failures),
                f"{useful}/{invalid}",
                str(unnecessary_count),
                fmt_duration(statistics.mean(durations) if durations else None),
                f"{sum(tokens):,}" if tokens else "N/A",
                f"${sum(costs):.4f}" if costs else "N/A",
                fmt_score(score),
                confidence_for(len(completed)),
                trend_for(activities),
            ]
        )
        detailed.append((agent, score, components, activities))

    completed_runs = [r for r in runs if r.get("final_status")]
    pass_runs = [r for r in completed_runs if r.get("final_status") == "PASS"]
    invoked_counts = [len({a.get("agent") for a in r.get("activities", [])}) for r in completed_runs]

    lines = [
        "# Tutoria Agent Team Performance",
        "",
        "Generated from `.codex/team-runs/*.json`. This report only uses recorded evidence; unavailable telemetry remains `N/A`.",
        "",
        "## Team summary",
        "",
        f"- Recorded runs: **{len(runs)}**",
        f"- Completed runs: **{len(completed_runs)}**",
        f"- PASS runs: **{len(pass_runs)}**" + (f" ({100*len(pass_runs)/len(completed_runs):.0f}%)" if completed_runs else ""),
        f"- Average distinct agents per completed run: **{statistics.mean(invoked_counts):.1f}**" if invoked_counts else "- Average distinct agents per completed run: **N/A**",
        "",
        "## Per-agent scorecard",
        "",
        "| Agent | Assigned | Completed | First-pass | Rework | QA failures | Useful/invalid findings | Unnecessary | Avg time | Tokens | Cost | Effectiveness | Confidence | Trend |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ]
    for row in rows:
        lines.append("| " + " | ".join(row) + " |")

    lines += [
        "",
        "### Effectiveness formula",
        "",
        "Default weights: 40% outcome/task success, 25% independent reviewer acceptance, 15% low rework/regression, 10% efficiency, 10% useful specialist contribution.",
        "",
        "`Efficiency` is intentionally `N/A` until there is a concrete normalized telemetry signal. Observable duration, tokens, and cost are displayed separately and are never turned into a fabricated quality score. When a component is unavailable, the overall score is reweighted across the components that have real evidence.",
        "",
        "Reviewer agents (QA, security, license, research, explorer) are evaluated using valid/useful findings and accepted contributions rather than lines of code.",
        "",
        "## Agent details",
        "",
    ]

    for agent, score, components, activities in detailed:
        lines += [f"### `{agent}`", ""]
        if not activities:
            lines += ["No recorded delegated work yet.", ""]
            continue
        lines += [
            f"- Overall effectiveness: **{fmt_score(score)}**",
            f"- Outcome/task success component: **{fmt_pct(components['outcome'])}**",
            f"- Reviewer acceptance component: **{fmt_pct(components['reviewer_acceptance'])}**",
            f"- Low rework/regression component: **{fmt_pct(components['rework_regression'])}**",
            f"- Efficiency component: **{fmt_pct(components['efficiency'])}**",
            f"- Specialist contribution component: **{fmt_pct(components['specialist_contribution'])}**",
            "",
            "Recent activities:",
        ]
        for a in activities[-5:]:
            lines.append(
                f"- `{a.get('_run_id')}` — {a.get('status')} / {a.get('acceptance') or 'N/A'}; "
                f"rework {a.get('rework_count', 0)}; QA failures {a.get('qa_failures_attributed', 0)}; "
                f"useful/invalid findings {a.get('useful_findings', 0)}/{a.get('invalid_findings', 0)}."
            )
        lines.append("")

    lines += [
        "## Interpretation rules",
        "",
        "- `USED` means a distinct activity was opened with an assignment and later completed/failed; merely loading an agent configuration does not count.",
        "- First-pass acceptance is only counted when the orchestrator records `first_pass` after independent review or direct acceptance evidence.",
        "- QA failures are attributed only when evidence connects a regression/failure to that agent's work.",
        "- Token/cost/model fields must come from Codex-visible telemetry. Do not estimate them.",
        "- Compare agents within their role. A QA agent finding many valid bugs can be performing very well even when it causes more rework downstream.",
        "- A small team with a high PASS rate and low rework is usually healthier than a task that invokes every specialist.",
        "",
    ]

    path = report_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def cmd_report(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    generate_report(root)
    print(report_path(root))


def cmd_show(args: argparse.Namespace) -> None:
    root = repo_root(args.repo)
    _, run = load_run(root, args.run)
    print(json.dumps(run, ensure_ascii=False, indent=2))


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Tutoria agent-team observability")
    p.add_argument("--repo", help="Repository root (defaults to current directory)")
    sub = p.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("init", help="Initialize run directory and report")
    sp.set_defaults(func=cmd_init)

    sp = sub.add_parser("start", help="Start an orchestrated run")
    sp.add_argument("--task", required=True)
    sp.add_argument("--run-id")
    sp.add_argument("--contract-path", help="Run-scoped QA acceptance contract, e.g. docs/agent-team/qa-contracts/<run-id>-qa-contract.md")
    sp.set_defaults(func=cmd_start)

    sp = sub.add_parser("begin-agent", help="Record a delegated assignment before spawning the agent")
    sp.add_argument("--run", required=True)
    sp.add_argument("--agent", required=True)
    sp.add_argument("--reason", required=True)
    sp.add_argument("--assignment", required=True)
    sp.add_argument("--model")
    sp.add_argument("--activity-id")
    sp.set_defaults(func=cmd_begin_agent)

    sp = sub.add_parser("end-agent", help="Finish a delegated activity with evidence")
    sp.add_argument("--run", required=True)
    sp.add_argument("--activity", required=True)
    sp.add_argument("--status", required=True, choices=sorted(ACTIVITY_STATUS_VALUES))
    sp.add_argument("--acceptance", required=True, choices=sorted(ACCEPTANCE_VALUES))
    sp.add_argument("--context-readiness", choices=sorted(CONTEXT_READINESS_VALUES), help="context_scout readiness state (distinct from run outcome and generic per-activity verdict)")
    sp.add_argument("--rework-count", type=int, default=0)
    sp.add_argument("--artifact", action="append")
    sp.add_argument("--file", action="append")
    sp.add_argument("--check", action="append")
    sp.add_argument("--useful-findings", type=int, default=0)
    sp.add_argument("--invalid-findings", type=int, default=0)
    sp.add_argument("--qa-failures", type=int, default=0)
    sp.add_argument("--verdict")
    sp.add_argument("--note", action="append")
    sp.add_argument("--model")
    sp.add_argument("--input-tokens", type=int)
    sp.add_argument("--output-tokens", type=int)
    sp.add_argument("--total-tokens", type=int)
    sp.add_argument("--cost-usd", type=float)
    sp.add_argument("--token-source")
    sp.set_defaults(func=cmd_end_agent)

    sp = sub.add_parser("contract-change", help="Record an approved change to the run-scoped QA acceptance contract")
    sp.add_argument("--run", required=True)
    sp.add_argument("--criterion", required=True, help="Original acceptance criterion")
    sp.add_argument("--reason", required=True, help="Why the criterion changed")
    sp.add_argument("--authorized-by", required=True, help="Who/what approved the change")
    sp.add_argument("--revised", required=True, help="Revised criterion")
    sp.set_defaults(func=cmd_contract_change)

    sp = sub.add_parser("finalize", help="Finalize the task and rebuild TEAM_PERFORMANCE.md")
    sp.add_argument("--run", required=True)
    sp.add_argument("--status", required=True, choices=sorted(STATUS_VALUES))
    sp.add_argument("--summary", required=True)
    sp.add_argument("--test", action="append")
    sp.add_argument("--qa", default="N/A")
    sp.add_argument("--security", default="N/A")
    sp.add_argument("--license", default="N/A")
    sp.add_argument("--note", action="append")
    sp.add_argument("--unnecessary-agent", action="append", help="Agent invoked without enough value; repeatable")
    sp.add_argument("--missing-agent", action="append", help="Specialist that should have been invoked but was not; repeatable")
    sp.add_argument("--routing-recommendation")
    sp.add_argument("--allow-running", action="store_true")
    sp.set_defaults(func=cmd_finalize)

    sp = sub.add_parser("status", help="Show live status for a run, or the latest run")
    sp.add_argument("--run")
    sp.set_defaults(func=cmd_status)

    sp = sub.add_parser("report", help="Regenerate aggregate performance report")
    sp.set_defaults(func=cmd_report)

    sp = sub.add_parser("show", help="Show a run JSON")
    sp.add_argument("--run", required=True)
    sp.set_defaults(func=cmd_show)

    return p


def main() -> None:
    args = parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
