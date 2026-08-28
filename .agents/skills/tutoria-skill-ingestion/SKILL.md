---
name: tutoria-skill-ingestion
description: Safely evaluate any external agent skill, plugin, or skill repository before it is installed, copied, adapted, or referenced by Tutoria. Use the existing license guard plus security scanning and semantic conflict review.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria external skill ingestion

External skills are executable/behavioral supply-chain inputs. Never install from an “awesome” list merely because it is popular.

## Required pipeline
1. **Resolve exact source** — canonical repo, exact commit/tag/version, exact skill path.
2. **Classify intended use** — `INCORPORATE`, `ADAPT`, `STUDY_ONLY`, or `REJECT`.
3. **License/provenance gate** — run existing `license_guard` / `repo-license-guard`; exact material matters.
4. **Security scan** — inspect SKILL.md, scripts, referenced downloads, allowed tools, secret access, prompt injection, shell/network behavior, and supply-chain dependencies. Prefer Sentry `skill-scanner` if approved and installed.
5. **Semantic conflict review** — ensure external orchestration, state models, security assumptions, or provider-specific rules do not override accepted Tutoria architecture.
6. **Least privilege** — remove unnecessary tools/network/scripts when adapting.
7. **Record provenance** — only incorporated/adapted material goes into the real external-source ledger/notices as required. Candidate research must stay in the candidate registry, not masquerade as incorporated material.
8. **Validate** — run skill-format validator and bounded behavior/routing test.

## Preference order
Official vendor/team skill > mature audited community skill > independent Tutoria-native skill > large unaudited collection.

A blocked external source does not automatically block independent Tutoria implementation.
