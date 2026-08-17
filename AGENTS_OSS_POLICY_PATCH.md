## Mandatory external-source gate

For every task involving an external repository, package, component library, copied/adapted source, UI implementation reference, asset, dataset, template, or third-party code:

1. Delegate license classification to `license_guard` / run `.agents/skills/repo-license-guard/SKILL.md` before implementation.
2. Do not incorporate source until an exact-ref, exact-path `OSS LICENSE GATE` result exists.
3. Treat `oss/REPO_POLICY.json` only as a hint; re-check the exact ref and files.
4. Record any incorporated source in `oss/EXTERNAL_SOURCES.json` and regenerate `THIRD_PARTY_NOTICES.md`.
5. Run `python3 scripts/oss_guard.py ci` before marking work complete.
6. If material is REVIEW/BLOCKED/STUDY_ONLY, do not copy or closely rewrite it. Use a permissive alternative or independently implement from public docs/APIs/observed behavior.
7. Never use `/enterprise`, `/ee`, Premium, proprietary, BSL/BUSL, AGPL/GPL, SSPL, or unlicensed code automatically.
