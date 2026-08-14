#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "oss" / "REPO_POLICY.json"
SOURCES = ROOT / "oss" / "EXTERNAL_SOURCES.json"
NOTICES = ROOT / "THIRD_PARTY_NOTICES.md"

PASS_LICENSES = {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"}
REVIEW_PATTERNS = [
    r"\bAGPL(?:-|\b)", r"\bGPL(?:-|\b)", r"\bLGPL(?:-|\b)", r"\bMPL(?:-|\b)",
    r"\bSSPL\b", r"\bBUSL(?:-|\b)", r"\bBSL(?:-|\b)", r"Business Source License",
    r"Elastic License", r"Commons Clause", r"PolyForm", r"source[- ]available",
    r"non[- ]commercial", r"commercial license", r"proprietary"
]
RESTRICTED_SEGMENTS = {"enterprise", "ee", "premium", "commercial", "proprietary"}
REQUIRED_FIELDS = {
    "id", "source", "ref", "license", "status", "scope", "planned_use",
    "checked_on", "evidence", "required_actions", "excluded_material"
}
ALLOWED_STATUSES = {"PASS", "CONDITIONAL", "REVIEW", "BLOCKED", "STUDY_ONLY"}
INCORPORATION_STATUSES = {"PASS", "CONDITIONAL"}


class GuardError(Exception):
    pass


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise GuardError(f"Missing required file: {path.relative_to(ROOT)}") from exc
    except json.JSONDecodeError as exc:
        raise GuardError(f"Invalid JSON in {path.relative_to(ROOT)}: {exc}") from exc


def normalize_source(value: str) -> str:
    return value.strip().rstrip("/").lower()


def registry_entries() -> list[dict[str, Any]]:
    data = load_json(REGISTRY)
    return data.get("repositories", [])


def find_registry(source: str) -> dict[str, Any] | None:
    norm = normalize_source(source)
    for entry in registry_entries():
        candidate = normalize_source(entry.get("canonical_repo", ""))
        if norm == candidate or norm.endswith(candidate.removeprefix("https://")):
            return entry
    return None


def is_pinned_ref(ref: str) -> bool:
    ref = ref.strip()
    if re.fullmatch(r"[0-9a-fA-F]{40}", ref):
        return True
    if re.fullmatch(r"v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?", ref):
        return True
    if re.fullmatch(r"\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?", ref):
        return True
    return False


def suspicious_license(license_text: str) -> bool:
    return any(re.search(p, license_text, flags=re.I) for p in REVIEW_PATTERNS)


def validate_entry(entry: dict[str, Any], ids: set[str]) -> list[str]:
    errors: list[str] = []
    missing = REQUIRED_FIELDS - set(entry)
    if missing:
        errors.append(f"missing fields: {', '.join(sorted(missing))}")
        return errors

    eid = str(entry["id"]).strip()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", eid):
        errors.append("id must match [a-z0-9][a-z0-9._-]*")
    if eid in ids:
        errors.append("duplicate id")
    ids.add(eid)

    status = str(entry["status"]).upper()
    if status not in ALLOWED_STATUSES:
        errors.append(f"invalid status {status}")

    if status in INCORPORATION_STATUSES and not is_pinned_ref(str(entry["ref"])):
        errors.append("incorporated source must pin a full 40-char commit SHA or exact semver-like version/tag")

    lic = str(entry["license"])
    if status == "PASS" and lic not in PASS_LICENSES:
        errors.append(f"PASS entry uses non-allowlisted license '{lic}'")
    if status in INCORPORATION_STATUSES and suspicious_license(lic):
        errors.append(f"incorporated entry contains restricted/review license signal '{lic}'")

    scope = entry["scope"]
    if not isinstance(scope, list) or not scope or not all(isinstance(x, str) and x.strip() for x in scope):
        errors.append("scope must be a non-empty list of exact paths/components")
    else:
        for item in scope:
            segments = {s.lower() for s in re.split(r"[/\\]+", item) if s}
            if status in INCORPORATION_STATUSES and segments & RESTRICTED_SEGMENTS:
                errors.append(f"scope contains restricted path segment: {item}")

    for field in ("evidence", "required_actions", "excluded_material"):
        val = entry[field]
        if not isinstance(val, list) or not val or not all(isinstance(x, str) and x.strip() for x in val):
            errors.append(f"{field} must be a non-empty list")

    try:
        date.fromisoformat(str(entry["checked_on"]))
    except ValueError:
        errors.append("checked_on must be YYYY-MM-DD")

    hint = find_registry(str(entry["source"]))
    if hint:
        default = hint.get("default_status")
        if default in {"STUDY_ONLY", "BLOCKED"} and status in INCORPORATION_STATUSES:
            errors.append(f"registry marks source {default}; incorporation requires explicit policy change/legal review")
        excluded = [str(x).lower() for x in hint.get("excluded_scope", [])]
        for item in scope if isinstance(scope, list) else []:
            low = item.lower()
            for ex in excluded:
                # conservative lexical check for explicit glob-like exclusions
                token = ex.split("/**", 1)[0].strip("/ ")
                if token and token in low and token in {"ee", "enterprise", "premium", "commercial"}:
                    errors.append(f"scope appears to match registry exclusion '{ex}': {item}")

    return errors


def validate_manifest() -> list[str]:
    data = load_json(SOURCES)
    entries = data.get("entries")
    if not isinstance(entries, list):
        return ["oss/EXTERNAL_SOURCES.json: entries must be an array"]
    errors: list[str] = []
    ids: set[str] = set()
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"entry[{idx}] must be an object")
            continue
        for msg in validate_entry(entry, ids):
            errors.append(f"entry[{idx}] ({entry.get('id', '?')}): {msg}")
    return errors


def render_notices() -> str:
    data = load_json(SOURCES)
    entries = data.get("entries", [])
    incorporated = [e for e in entries if isinstance(e, dict) and str(e.get("status", "")).upper() in INCORPORATION_STATUSES]
    lines = [
        "# Third-Party Notices",
        "",
        "Generated from `oss/EXTERNAL_SOURCES.json` by `scripts/oss_guard.py`.",
        "This ledger records external source actually incorporated into Tutoria; it does not itself replace upstream LICENSE/NOTICE files that must be preserved when required.",
        ""
    ]
    if not incorporated:
        lines.append("_No incorporated external source entries are recorded yet._")
        lines.append("")
        return "\n".join(lines)

    for e in sorted(incorporated, key=lambda x: str(x["id"])):
        lines.extend([
            f"<!-- OSS:{e['id']} -->",
            f"## {e.get('name') or e['id']}",
            "",
            f"- Source: {e['source']}",
            f"- Pinned ref/version: `{e['ref']}`",
            f"- License: `{e['license']}`",
            f"- Status: `{str(e['status']).upper()}`",
            f"- Planned/use mode: {e['planned_use']}",
            f"- Checked on: {e['checked_on']}",
            "- Scope incorporated:",
        ])
        lines.extend([f"  - `{x}`" for x in e["scope"]])
        lines.append("- Evidence checked:")
        lines.extend([f"  - {x}" for x in e["evidence"]])
        lines.append("- Required actions:")
        lines.extend([f"  - {x}" for x in e["required_actions"]])
        lines.append("- Excluded material:")
        lines.extend([f"  - {x}" for x in e["excluded_material"]])
        lines.append("")
    return "\n".join(lines)


def cmd_registry(args: argparse.Namespace) -> int:
    if args.source:
        entry = find_registry(args.source)
        if not entry:
            print("No registry hint found. Treat as UNKNOWN/BLOCKED until exact license verification.")
            return 2
        print(json.dumps(entry, indent=2, ensure_ascii=False))
        return 0
    print(json.dumps(load_json(REGISTRY), indent=2, ensure_ascii=False))
    return 0


def cmd_validate(_: argparse.Namespace) -> int:
    errors = validate_manifest()
    if errors:
        print("OSS manifest validation: FAIL", file=sys.stderr)
        for e in errors:
            print(f"- {e}", file=sys.stderr)
        return 1
    print("OSS manifest validation: PASS")
    return 0


def cmd_generate(args: argparse.Namespace) -> int:
    errors = validate_manifest()
    if errors:
        for e in errors:
            print(f"- {e}", file=sys.stderr)
        return 1
    expected = render_notices()
    if args.check:
        actual = NOTICES.read_text(encoding="utf-8") if NOTICES.exists() else ""
        if actual.rstrip() != expected.rstrip():
            print("THIRD_PARTY_NOTICES.md is out of date. Run: python3 scripts/oss_guard.py generate-notices", file=sys.stderr)
            return 1
        print("Third-party notices: PASS")
        return 0
    NOTICES.write_text(expected, encoding="utf-8")
    print(f"Wrote {NOTICES.relative_to(ROOT)}")
    return 0


def cmd_ci(_: argparse.Namespace) -> int:
    failures = 0
    errors = validate_manifest()
    if errors:
        failures += 1
        print("OSS manifest validation: FAIL", file=sys.stderr)
        for e in errors:
            print(f"- {e}", file=sys.stderr)
    else:
        print("OSS manifest validation: PASS")

    if not errors:
        expected = render_notices()
        actual = NOTICES.read_text(encoding="utf-8") if NOTICES.exists() else ""
        if actual.rstrip() != expected.rstrip():
            failures += 1
            print("Third-party notices: FAIL (ledger out of date)", file=sys.stderr)
        else:
            print("Third-party notices: PASS")

    if failures:
        print("OSS LICENSE GATE: FAIL", file=sys.stderr)
        return 1
    print("OSS LICENSE GATE: PASS")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Tutoria conservative OSS provenance/license policy checker")
    sub = p.add_subparsers(dest="command", required=True)

    r = sub.add_parser("registry", help="Show registry hints; exact-ref verification is still mandatory")
    r.add_argument("--source")
    r.set_defaults(func=cmd_registry)

    v = sub.add_parser("validate", help="Validate external-source provenance manifest")
    v.set_defaults(func=cmd_validate)

    g = sub.add_parser("generate-notices", help="Generate THIRD_PARTY_NOTICES.md from manifest")
    g.add_argument("--check", action="store_true")
    g.set_defaults(func=cmd_generate)

    c = sub.add_parser("ci", help="Run all guard checks")
    c.set_defaults(func=cmd_ci)
    return p


def main() -> int:
    try:
        args = build_parser().parse_args()
        return args.func(args)
    except GuardError as exc:
        print(f"OSS guard error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
