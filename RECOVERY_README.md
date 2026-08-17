# Tutoria missing-files recovery overlay

Recovered from the original Tutoria agent-team, OSS guard, and security-guard artifacts created on 2026-08-11.

## Copy this directory into the Tutoria repository root

It restores:

- `.agents/skills/tutoria-security-guard/` — exact original security skill folder
- `scripts/security-scan.sh` — compatibility wrapper that calls the skill's canonical helper
- `scripts/oss_guard.py` — exact original OSS guard
- `oss/REPO_POLICY.json` — exact original repository policy registry
- `oss/EXTERNAL_SOURCES.json` — exact original provenance manifest
- `docs/OSS_POLICY.md` — exact original OSS policy
- `THIRD_PARTY_NOTICES.md` — exact original generated notice file
- `docs/agent-team/TUTORIA_PRODUCT_BRAIN.md` — correct original path

Also included because the OSS guard references/tests them:

- `.agents/skills/repo-license-guard/SKILL.md`
- `tests/test_oss_guard.py`
- `.github/workflows/oss-license-gate.yml`
- `AGENTS_OSS_POLICY_PATCH.md`
- `docs/VERIFIED_LICENSE_SNAPSHOT.md`

## Important path correction

Do **not** move `TUTORIA_PRODUCT_BRAIN.md` to the repository root. The original Tutoria `AGENTS.md`, installer, and specialist-agent configs reference `docs/agent-team/TUTORIA_PRODUCT_BRAIN.md`.

The original security pack keeps its real helper at:

`.agents/skills/tutoria-security-guard/scripts/security-scan.sh`

The root `scripts/security-scan.sh` in this recovery overlay is only a compatibility entrypoint for the older tree/specification.

## Validate after merging

```bash
bash -n scripts/security-scan.sh
bash -n .agents/skills/tutoria-security-guard/scripts/security-scan.sh
python3 -m unittest discover -s tests -p 'test_oss_guard.py' -v
python3 scripts/oss_guard.py validate
python3 scripts/oss_guard.py generate-notices --check
python3 scripts/oss_guard.py ci
```

Then inspect/merge `AGENTS_OSS_POLICY_PATCH.md` into the repository root `AGENTS.md`; do not overwrite an existing `AGENTS.md` blindly.
