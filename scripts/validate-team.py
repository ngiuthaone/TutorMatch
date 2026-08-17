#!/usr/bin/env python3
from pathlib import Path
import sys

try:
    import tomllib  # Python >= 3.11
except ModuleNotFoundError:
    import tomli as tomllib  # Python 3.9/3.10 backport

ROOT = Path(__file__).resolve().parents[1]
errors = []

required = [
    ROOT / "AGENTS.md",
    ROOT / ".codex/config.toml",
    ROOT / ".agents/skills/tutoria-orchestrator/SKILL.md",
    ROOT / ".agents/skills/repo-license-guard/SKILL.md",
    ROOT / ".agents/skills/tutoria-team-observability/SKILL.md",
    ROOT / "scripts/team-observability.py",
    ROOT / "docs/agent-team/OBSERVABILITY.md",
]
# install-observability.sh is a bundle migration helper and is intentionally not
# part of the live repository installed by the safe installer.
for p in required:
    if not p.exists() or p.stat().st_size == 0:
        errors.append(f"missing or empty: {p.relative_to(ROOT)}")

config = ROOT / ".codex/config.toml"
if config.exists():
    try:
        data = tomllib.loads(config.read_text())
        agents = data.get("agents", {})
        if agents.get("enabled") is not True:
            errors.append(".codex/config.toml must enable agents")
    except Exception as exc:
        errors.append(f"invalid .codex/config.toml: {exc}")

agent_files = sorted((ROOT / ".codex/agents").glob("*.toml"))
if not agent_files:
    errors.append("no custom agents found")

names = set()
for p in agent_files:
    try:
        data = tomllib.loads(p.read_text())
    except Exception as exc:
        errors.append(f"invalid TOML {p.name}: {exc}")
        continue
    for key in ("name", "description", "developer_instructions"):
        if not data.get(key):
            errors.append(f"{p.name}: missing {key}")
    name = data.get("name")
    if name in names:
        errors.append(f"duplicate agent name: {name}")
    names.add(name)

expected = {
    "product_planner", "product_designer", "code_explorer", "context_scout", "frontend_engineer",
    "backend_engineer", "qa_browser", "security_reviewer", "researcher", "license_guard",
    "database_engineer", "integration_engineer", "payments_engineer", "qa_engineer",
    "independent_verifier", "reliability_engineer"
}
missing = expected - names
if missing:
    errors.append(f"missing expected agents: {sorted(missing)}")


# Observability script must compile and the pack should contain an initialized report.
try:
    compile((ROOT / "scripts/team-observability.py").read_text(), "team-observability.py", "exec")
except Exception as exc:
    errors.append(f"invalid scripts/team-observability.py: {exc}")

if not (ROOT / ".codex/TEAM_PERFORMANCE.md").exists():
    errors.append("missing .codex/TEAM_PERFORMANCE.md")

if errors:
    print("Tutoria agent team validation: FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)

print("Tutoria agent team validation: PASS")
print(f"Custom agents: {len(agent_files)}")
for p in agent_files:
    data = tomllib.loads(p.read_text())
    print(f"- {data['name']}: {data.get('model', 'inherits parent')} / {data.get('sandbox_mode', 'inherits parent')}")
