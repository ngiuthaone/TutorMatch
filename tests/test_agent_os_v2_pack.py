from pathlib import Path
import importlib.util

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('validator', ROOT/'scripts/validate-agent-os-v2-pack.py')
mod=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(mod)

def test_pack_validates():
    assert mod.validate(ROOT)==[]

def test_skill_count_and_names():
    dirs=[p for p in (ROOT/'.agents/skills').iterdir() if p.is_dir()]
    assert len(dirs) >= 22
    assert (ROOT/'.agents/skills/tutoria-skill-ingestion/SKILL.md').is_file()
    assert (ROOT/'.agents/skills/tutoria-postgres-concurrency/SKILL.md').is_file()

def test_external_candidates_are_not_real_ledger():
    text=(ROOT/'oss/AGENT_SKILL_CANDIDATES.json').read_text()
    assert 'NOT the incorporated external-source ledger' in text
