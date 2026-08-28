#!/usr/bin/env python3
from __future__ import annotations
import json, py_compile, sys
from pathlib import Path

try:
    import tomllib  # Python >= 3.11
except ModuleNotFoundError:
    import tomli as tomllib  # Python 3.9/3.10 backport

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_AGENTS = {
    'product_planner','product_designer','code_explorer','context_scout','frontend_engineer',
    'backend_engineer','qa_browser','security_reviewer','researcher','license_guard',
    'database_engineer','integration_engineer','payments_engineer','qa_engineer',
    'independent_verifier','reliability_engineer'
}
REQUIRED = [
    'AGENTS.md', '.codex/config.toml', '.codex/TEAM_PERFORMANCE.md',
    '.agents/skills/tutoria-orchestrator/SKILL.md',
    '.agents/skills/tutoria-team-observability/SKILL.md',
    '.agents/skills/repo-license-guard/SKILL.md',
    '.agents/skills/tutoria-security-guard/SKILL.md',
    'docs/agent-team/TUTORIA_PRODUCT_BRAIN.md',
    'docs/agent-team/LAST_KNOWN_REPO_AUDIT.md',
    'docs/agent-team/AGENT_RESPONSIBILITY_SKILL_MATRIX_V2.md',
    'docs/agent-team/AGENT_ROUTING_MATRIX_V2.md',
    'docs/agent-team/AGENT_SKILL_PHASE_ACTIVATION_V2.md',
    'docs/agent-team/EXTERNAL_AGENT_SKILL_ADOPTION_PLAN.md',
    'docs/OSS_POLICY.md', 'oss/REPO_POLICY.json', 'oss/EXTERNAL_SOURCES.json',
    'oss/AGENT_SKILL_CANDIDATES.json',
    'THIRD_PARTY_NOTICES.md', 'scripts/team-observability.py',
    'scripts/oss_guard.py', 'scripts/security-scan.sh', 'tests/test_oss_guard.py',
    'tests/test_agent_os_v2_pack.py', 'tests/test_agent_os_v2_policy.py',
]
errors=[]
notes=[]
for rel in REQUIRED:
    if not (ROOT/rel).exists(): errors.append(f'missing required file: {rel}')

# Validate project subagent files.
agents_dir=ROOT/'.codex/agents'
seen=set()
if agents_dir.exists():
    for p in sorted(agents_dir.glob('*.toml')):
        try: data=tomllib.loads(p.read_text())
        except Exception as e:
            errors.append(f'invalid TOML {p.relative_to(ROOT)}: {e}'); continue
        for k in ('name','description','developer_instructions'):
            if not data.get(k): errors.append(f'{p.relative_to(ROOT)} missing {k}')
        name=data.get('name')
        if name in seen: errors.append(f'duplicate agent name: {name}')
        if name: seen.add(name)
        if data.get('sandbox_mode') not in (None,'read-only','workspace-write','danger-full-access'):
            errors.append(f'{p.relative_to(ROOT)} unexpected sandbox_mode={data.get("sandbox_mode")!r}')
else:
    errors.append('missing .codex/agents')
missing_roles=EXPECTED_AGENTS-seen
extra_roles=seen-EXPECTED_AGENTS
if missing_roles: errors.append('missing agent roles: '+', '.join(sorted(missing_roles)))
if extra_roles: notes.append('extra project agents present: '+', '.join(sorted(extra_roles)))

# Validate global subagent config.
try:
    cfg=tomllib.loads((ROOT/'.codex/config.toml').read_text())
    acfg=cfg.get('agents',{})
    if acfg.get('enabled') is not True: errors.append('agents.enabled must be true')
    cap=acfg.get('max_concurrent_threads_per_session')
    if not isinstance(cap,int) or cap < 1: errors.append('invalid agents.max_concurrent_threads_per_session')
except Exception as e:
    errors.append(f'invalid .codex/config.toml: {e}')

# Validate policy JSON and ensure incorporation ledger starts structurally sound.
for rel in ('oss/REPO_POLICY.json','oss/EXTERNAL_SOURCES.json'):
    try:
        data=json.loads((ROOT/rel).read_text())
        if data.get('schema_version') != 1: notes.append(f'{rel}: schema_version is not 1')
    except Exception as e: errors.append(f'invalid JSON {rel}: {e}')

# Compile deterministic Python helpers.
for rel in ('scripts/team-observability.py','scripts/oss_guard.py'):
    try: py_compile.compile(str(ROOT/rel), doraise=True)
    except Exception as e: errors.append(f'python compile failed {rel}: {e}')

# Cross-system invariants.
agents_text=(ROOT/'AGENTS.md').read_text() if (ROOT/'AGENTS.md').exists() else ''
for needle in ('repo-license-guard','oss/EXTERNAL_SOURCES.json','tutoria-security-guard','qa_browser','security_reviewer','context_scout'):
    if needle not in agents_text: errors.append(f'AGENTS.md missing enforced reference: {needle}')
for needle in ('database_engineer','integration_engineer','payments_engineer','qa_engineer','independent_verifier','reliability_engineer'):
    if needle not in agents_text: errors.append(f'AGENTS.md missing production-specialist reference: {needle}')
for needle in ('product policy ≠ domain invariant ≠ database enforcement strategy','Phase-based activation','AGENT_SKILL_PHASE_ACTIVATION_V2.md'):
    if needle not in agents_text: errors.append(f'AGENTS.md missing V2 policy reference: {needle}')
for needle in ('QA preflight acceptance contract','PRODUCT_DECISION_REQUIRED','QA expectations are established independently','INPUT_RECOMMENDED','DISCOVER TUTORIA CONTEXT'):
    if needle not in agents_text: errors.append(f'AGENTS.md missing QA-policy reference: {needle}')
qa_text=(ROOT/'.codex/agents/qa-browser.toml').read_text() if (ROOT/'.codex/agents/qa-browser.toml').exists() else ''
for needle in ('MODE A','MODE B','PRODUCT_DECISION_REQUIRED','acceptance contract','BROWSER SPECIALTY'):
    if needle not in qa_text: errors.append(f'qa-browser.toml missing QA-policy reference: {needle}')
scout_text=(ROOT/'.codex/agents/context-scout.toml').read_text() if (ROOT/'.codex/agents/context-scout.toml').exists() else ''
for needle in ('READY_WITH_GAPS','INPUT_RECOMMENDED','INPUT_REQUIRED','SEARCH BEFORE REQUEST','EXTERNAL_SOURCE_ASSUMPTION','VERIFIED_TUTORIA_EVIDENCE','MISSING_DECISION','EVIDENCE INTEGRITY'):
    if needle not in scout_text: errors.append(f'context-scout.toml missing context-policy reference: {needle}')
license_text=(ROOT/'.agents/skills/repo-license-guard/SKILL.md').read_text() if (ROOT/'.agents/skills/repo-license-guard/SKILL.md').exists() else ''
for needle in ('No license laundering','scripts/oss_guard.py','EXTERNAL_SOURCES.json'):
    if needle not in license_text: errors.append(f'repo-license-guard missing rule/reference: {needle}')

if errors:
    print('Tutoria Agent OS validation: FAIL')
    for e in errors: print(f'ERROR: {e}')
    for n in notes: print(f'NOTE: {n}')
    sys.exit(1)
print('Tutoria Agent OS validation: PASS')
print(f'Agents: {len(seen)} ({", ".join(sorted(seen))})')
for n in notes: print(f'NOTE: {n}')
