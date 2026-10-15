#!/usr/bin/env python3
"""Tutoria policy-as-code validator.

Validates policies/security-policy.yaml for structural correctness and
scans governed files (.agents/skills/*/SKILL.md, scripts/*.py, scripts/*.sh)
for forbidden command patterns defined in the security policy. Documentation
files (docs/, AGENTS.md) are not scanned because they legitimately reference
patterns to describe restrictions.

This script is self-contained and uses only the Python standard library
plus PyYAML (already a project dependency via the OSS guard ecosystem).

Usage:
    python3 scripts/validate-policies.py           # validate + scan
    python3 scripts/validate-policies.py --scan-only  # skip YAML validation, scan only
    python3 scripts/validate-policies.py --verbose  # print per-file results
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML is required. Install with: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
POLICY_FILE = ROOT / "policies" / "security-policy.yaml"

REQUIRED_TOP_LEVEL = {
    "schema_version",
    "policy_owner",
    "description",
    "forbidden_commands",
    "protected_files",
    "security_sensitive_changes",
    "required_verification",
    "prohibited_deploy_actions",
}

REQUIRED_FORBIDDEN_COMMAND_FIELDS = {"pattern", "severity", "reason"}
VALID_SEVERITIES = {"critical", "high", "medium", "low"}


@dataclass
class Violation:
    file: str
    line: int
    pattern: str
    severity: str
    reason: str

    def __str__(self) -> str:
        return (
            f"{self.file}:{self.line} — FORBIDDEN PATTERN [{self.severity}]: "
            f"'{self.pattern}' ({self.reason})"
        )


class PolicyError(Exception):
    pass


def is_in_root(path: Path) -> bool:
    try:
        path.resolve().relative_to(ROOT)
        return True
    except ValueError:
        return False


def load_policy(path: Path = POLICY_FILE) -> dict[str, Any]:
    if not path.is_file():
        raise PolicyError(f"Policy file not found: {path.relative_to(ROOT) if is_in_root(path) else path}")
    try:
        text = path.read_text(encoding="utf-8")
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        rel = path.relative_to(ROOT) if is_in_root(path) else str(path)
        raise PolicyError(f"Invalid YAML in {rel}: {exc}")
    if not isinstance(data, dict):
        raise PolicyError(f"Policy root must be a mapping, got {type(data).__name__}")
    return data


def validate_structure(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    missing = REQUIRED_TOP_LEVEL - set(data)
    if missing:
        errors.append(f"Missing required top-level keys: {sorted(missing)}")
        return errors

    forbidden = data.get("forbidden_commands", {})
    if not isinstance(forbidden, dict):
        errors.append("forbidden_commands must be a mapping")
        return errors

    patterns = forbidden.get("patterns", [])
    if not isinstance(patterns, list):
        errors.append("forbidden_commands.patterns must be a list")
    elif len(patterns) < 3:
        errors.append(
            f"forbidden_commands.patterns must have at least 3 entries, found {len(patterns)}"
        )

    for i, entry in enumerate(patterns):
        if not isinstance(entry, dict):
            errors.append(f"forbidden_commands.patterns[{i}] must be a mapping")
            continue
        missing_fields = REQUIRED_FORBIDDEN_COMMAND_FIELDS - set(entry)
        if missing_fields:
            errors.append(
                f"forbidden_commands.patterns[{i}] missing fields: {sorted(missing_fields)}"
            )
        sev = entry.get("severity", "")
        if sev and sev not in VALID_SEVERITIES:
            errors.append(
                f"forbidden_commands.patterns[{i}] has invalid severity '{sev}'; "
                f"must be one of {sorted(VALID_SEVERITIES)}"
            )

    for section in ("protected_files", "security_sensitive_changes",
                    "required_verification", "prohibited_deploy_actions"):
        val = data.get(section)
        if not isinstance(val, dict):
            errors.append(f"{section} must be a mapping")
            continue
        if "description" not in val or not str(val["description"]).strip():
            errors.append(f"{section} must have a non-empty 'description'")
        if "paths" in val or "patterns" in val or "triggers" in val or "actions" in val or "checks" in val:
            lst_key = next(k for k in ("paths", "patterns", "triggers", "actions", "checks") if k in val)
            lst = val.get(lst_key)
            if not isinstance(lst, list) or not lst:
                errors.append(f"{section}.{lst_key} must be a non-empty list")

    return errors


def scan_files(data: dict[str, Any]) -> list[Violation]:
    violations: list[Violation] = []
    patterns_entry = data.get("forbidden_commands", {}).get("patterns", [])
    compiled: list[tuple[re.Pattern[str], str, str, str]] = []
    for entry in patterns_entry:
        pattern_str = entry.get("pattern", "")
        severity = entry.get("severity", "unknown")
        reason = entry.get("reason", "")
        try:
            compiled.append((re.compile(pattern_str, re.IGNORECASE), pattern_str, severity, reason))
        except re.error as exc:
            violations.append(Violation(
                file=str(POLICY_FILE.relative_to(ROOT)),
                line=0,
                pattern=pattern_str,
                severity="error",
                reason=f"Invalid regex: {exc}",
            ))

    scan_targets: list[Path] = []
    skills_dir = ROOT / ".agents" / "skills"
    if skills_dir.is_dir():
        for skill_dir in sorted(skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if skill_md.is_file() and skill_md.stem == "SKILL":
                scan_targets.append(skill_md)
    scripts_dir = ROOT / "scripts"
    if scripts_dir.is_dir():
        for f in scripts_dir.iterdir():
            if f.is_file() and f.suffix in (".py", ".sh"):
                scan_targets.append(f)

    excluded_skills = {
        (ROOT / ".agents" / "skills" / "tutoria-security-guard" / "SKILL.md").resolve(),
    }

    seen: set[Path] = set()
    for f in scan_targets:
        rp = f.resolve()
        if rp in seen or rp in excluded_skills:
            continue
        seen.add(rp)
        try:
            lines = f.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for i, line in enumerate(lines, 1):
            for regex, pattern, severity, reason in compiled:
                if regex.search(line):
                    rel = f.relative_to(ROOT)
                    violations.append(Violation(
                        file=str(rel),
                        line=i,
                        pattern=pattern,
                        severity=severity,
                        reason=reason,
                    ))

    return violations


def cmd_validate(args: argparse.Namespace) -> int:
    errors: list[str] = []
    try:
        data = load_policy()
    except PolicyError as exc:
        print(f"POLICY VALIDATION: FAIL - {exc}", file=sys.stderr)
        return 1

    errors = validate_structure(data)
    if errors:
        print("POLICY VALIDATION: FAIL", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
    else:
        print("POLICY VALIDATION: PASS")

    if args.scan_only:
        return 0

    return cmd_scan(args, data)


def cmd_scan(args: argparse.Namespace, data: dict[str, Any] | None = None) -> int:
    if data is None:
        try:
            data = load_policy()
        except PolicyError as exc:
            print(f"POLICY SCAN: FAIL - {exc}", file=sys.stderr)
            return 1

    violations = scan_files(data)
    if violations:
        print("POLICY SCAN: FAIL", file=sys.stderr)
        for v in violations:
            print(f"  - {v}", file=sys.stderr)
    else:
        print("POLICY SCAN: PASS")

    return 1 if violations else 0


def cmd_ci(args: argparse.Namespace) -> int:
    try:
        data = load_policy()
    except PolicyError as exc:
        print(f"POLICY: FAIL - {exc}", file=sys.stderr)
        return 1

    errors = validate_structure(data)
    violations = scan_files(data)

    failures = 0
    if errors:
        failures += 1
        print("Policy structure: FAIL", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
    else:
        print("Policy structure: PASS")

    if violations:
        failures += 1
        print("Policy scan: FAIL", file=sys.stderr)
        for v in violations:
            print(f"  - {v}", file=sys.stderr)
    else:
        print("Policy scan: PASS")

    if failures:
        print("POLICY GATE: FAIL", file=sys.stderr)
        return 1
    print("POLICY GATE: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate Tutoria security policies and scan for violations"
    )
    parser.add_argument(
        "--scan-only",
        action="store_true",
        help="Skip YAML structural validation; scan files only",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-file scan results",
    )
    sub = parser.add_subparsers(dest="command")

    v = sub.add_parser("validate", help="Validate policy structure")
    v.set_defaults(func=cmd_validate)

    s = sub.add_parser("scan", help="Scan files for forbidden patterns")
    s.set_defaults(func=cmd_scan)

    c = sub.add_parser("ci", help="Run all policy checks (validate + scan)")
    c.set_defaults(func=cmd_ci)

    args = parser.parse_args()

    if args.command is None:
        return cmd_ci(args)

    if args.command == "validate":
        return cmd_validate(args)
    elif args.command == "scan":
        return cmd_scan(args)
    elif args.command == "ci":
        return cmd_ci(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
