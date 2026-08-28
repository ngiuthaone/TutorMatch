#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

try:
    import tomllib  # Python >= 3.11
except ModuleNotFoundError:
    import tomli as tomllib  # Python 3.9/3.10 backport

NEW_ROLES = {
    'database_engineer','integration_engineer','payments_engineer','qa_engineer',
    'independent_verifier','reliability_engineer','context_scout'
}
READ_ONLY = {'independent_verifier','context_scout'}
REQUIRED_SKILLS = {
    'tutoria-task-routing','tutoria-context-scout','tutoria-evidence-map',
    'tutoria-handoff-contract','tutoria-requirement-traceability','tutoria-domain-modeling',
    'tutoria-capacity-concurrency','tutoria-supabase-persistence','tutoria-postgres-concurrency',
    'tutoria-rls-review','tutoria-application-services','tutoria-idempotency-outbox',
    'tutoria-payment-integration','tutoria-payment-webhooks','tutoria-backend-qa',
    'tutoria-browser-qa','tutoria-independent-verification','tutoria-server-authoritative-ui',
    'tutoria-production-reliability','tutoria-product-policy','tutoria-skill-ingestion',
    'tutoria-external-reference'
}
REQUIRED_DOCS = {
    'AGENT_RESPONSIBILITY_SKILL_MATRIX_V2.md','AGENT_AUTHORITY_MATRIX_V2.md',
    'AGENT_SKILL_PHASE_ACTIVATION_V2.md','AGENT_SKILL_BINDINGS_PATCH.md',
    'EXTERNAL_AGENT_SKILL_ADOPTION_PLAN.md','CODEX_INTEGRATION_PROMPT.md'
}
NAME_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')


def parse_frontmatter(text: str) -> dict[str,str]:
    if not text.startswith('---\n'):
        raise ValueError('missing YAML frontmatter opener')
    end = text.find('\n---\n', 4)
    if end < 0:
        raise ValueError('missing YAML frontmatter closer')
    out = {}
    for raw in text[4:end].splitlines():
        if not raw.strip() or raw.lstrip().startswith('#'):
            continue
        if ':' not in raw:
            raise ValueError(f'invalid frontmatter line: {raw!r}')
        k,v = raw.split(':',1)
        out[k.strip()] = v.strip().strip('"\'')
    return out


def validate(repo: Path) -> list[str]:
    errors=[]
    agent_dir=repo/'.codex/agents'
    loaded={}
    if not agent_dir.is_dir(): errors.append('missing .codex/agents')
    else:
        for p in sorted(agent_dir.glob('*.toml')):
            try: data=tomllib.loads(p.read_text())
            except Exception as e:
                errors.append(f'{p}: invalid TOML: {e}'); continue
            for field in ('name','description','developer_instructions'):
                if not isinstance(data.get(field),str) or not data[field].strip():
                    errors.append(f'{p}: missing/non-empty {field}')
            name=data.get('name')
            if isinstance(name,str):
                if name in loaded: errors.append(f'duplicate agent name: {name}')
                loaded[name]=data
        missing=NEW_ROLES-set(loaded)
        if missing: errors.append('missing new roles: '+', '.join(sorted(missing)))
        for role in READ_ONLY:
            if role in loaded and loaded[role].get('sandbox_mode')!='read-only':
                errors.append(f'{role}: must use read-only sandbox')

    skill_root=repo/'.agents/skills'
    skill_names=set()
    if not skill_root.is_dir(): errors.append('missing .agents/skills')
    else:
        # Validate this V2 pack's canonical skills. Do not reject unrelated live skills
        # merely because an older/local skill uses another supported house format.
        for expected in sorted(REQUIRED_SKILLS):
            d=skill_root/expected
            p=d/'SKILL.md'
            spec=d/'SPEC.md'
            if not p.is_file():
                errors.append(f'{d}: missing SKILL.md'); continue
            if not spec.is_file(): errors.append(f'{d}: missing SPEC.md maintenance contract')
            try: fm=parse_frontmatter(p.read_text())
            except Exception as e:
                errors.append(f'{p}: {e}'); continue
            name=fm.get('name','')
            desc=fm.get('description','')
            if name != d.name: errors.append(f'{p}: name {name!r} != directory {d.name!r}')
            if not NAME_RE.match(name): errors.append(f'{p}: invalid skill name')
            if len(name)>64: errors.append(f'{p}: name >64 chars')
            if not desc: errors.append(f'{p}: missing description')
            if len(desc)>1024: errors.append(f'{p}: description >1024 chars')
            if name in skill_names: errors.append(f'duplicate skill name: {name}')
            skill_names.add(name)

    docs=repo/'docs/agent-team'
    for fn in REQUIRED_DOCS:
        if not (docs/fn).is_file(): errors.append(f'missing doc: docs/agent-team/{fn}')

    cand=repo/'oss/AGENT_SKILL_CANDIDATES.json'
    if not cand.is_file(): errors.append('missing oss/AGENT_SKILL_CANDIDATES.json')
    else:
        try: data=json.loads(cand.read_text())
        except Exception as e: errors.append(f'candidate registry invalid JSON: {e}')
        else:
            if 'NOT' not in data.get('purpose','').upper():
                errors.append('candidate registry must state it is not the incorporation ledger')
            ids=[]
            for item in data.get('candidates',[]):
                ids.append(item.get('id'))
                for f in ('id','repo','recommended_action','why','priority'):
                    if not item.get(f): errors.append(f'candidate missing {f}: {item}')
            if len(ids)!=len(set(ids)): errors.append('duplicate external candidate id')

    return errors


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('repo',nargs='?',default='.')
    args=ap.parse_args()
    errors=validate(Path(args.repo).resolve())
    if errors:
        print('FAIL')
        for e in errors: print('- '+e)
        return 1
    print('PASS: Tutoria Agent OS V2 skills pack is structurally valid.')
    return 0

if __name__=='__main__': sys.exit(main())
