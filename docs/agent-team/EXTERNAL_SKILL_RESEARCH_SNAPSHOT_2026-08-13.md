# External Agent-Skill Research Snapshot — 2026-08-13

This snapshot is research evidence, not permanent approval. Reverify exact refs before incorporation.

## High-priority upstreams

### Agent Skills specification
- Repo: `https://github.com/agentskills/agentskills`
- Verified: a skill is a folder with `SKILL.md`; YAML frontmatter requires at least `name` and `description`; optional scripts/references/assets support progressive disclosure.
- Tutoria use: structural authority/reference only.

### Supabase Agent Skills
- Repo: `https://github.com/supabase/agent-skills`
- License observed: MIT.
- Verified: official skills exist for Supabase, and the core skill explicitly warns that Supabase changes frequently and current docs/changelog should be verified.
- Tutoria use: selectively evaluate for `database_engineer`; vendor docs remain current implementation authority.

### Sentry Skills
- Repo: `https://github.com/getsentry/skills`
- License observed: Apache-2.0.
- Verified useful skills: `skill-scanner`, `skill-writer`, `security-review`, `find-bugs`, `code-review`, `agents-md`.
- `skill-scanner` checks prompt injection, malicious scripts, excessive permissions, secret exposure, and supply-chain risk.
- Tutoria use: `skill-scanner` is the strongest P0 external-skill ingestion candidate.

### Vercel agent-browser
- Repo: `https://github.com/vercel-labs/agent-browser`
- License observed: Apache-2.0.
- Verified: browser automation CLI for agents with navigation, accessibility snapshots, form interaction, screenshots, JS evaluation, tab/network/console inspection.
- Tutoria use: execution layer for `qa_browser`, subject to live toolchain compatibility and security/license gate.

### Vercel Agent Skills
- Repo: `https://github.com/vercel-labs/agent-skills`
- Verified selected skill: `skills/react-best-practices` declares MIT and covers React/Next.js performance optimization.
- Tutoria use: selected frontend skills only; do not mass-install repository contents.

### Stripe AI
- Repo: `https://github.com/stripe/ai`
- License observed: MIT.
- Verified: Stripe publishes official Agent Skills and recommends a Codex Stripe plugin.
- Tutoria use: defer until Stripe is actually selected as provider; provider skill must not redefine Tutoria Payment domain.

## Secondary references

### Trail of Bits Skills
- Repo: `https://github.com/trailofbits/skills`
- License observed: CC-BY-SA-4.0.
- Verified: security workflows include differential review, static analysis, audit-context building, supply-chain review, and related skills.
- Tutoria use: prefer plugin/reference or exact license-approved reuse; do not casually vendor into Tutoria.

### Superpowers
- Repo: `https://github.com/obra/superpowers`
- License observed: MIT.
- Verified relevant methodology: test-driven development, systematic debugging, verification-before-completion, structured/parallel-agent workflows.
- Tutoria use: adapt selected methods only; do not install a second orchestration OS over Tutoria Agent OS.

### QA Skills
- Repo: `https://github.com/petrkindlmann/qa-skills`
- License observed: MIT.
- Verified: 50 QA skills across API/database/payment/reliability/browser/security/performance testing.
- Tutoria use: study or install a bounded subset after gate, not all 50.

### Addy Osmani Agent Skills
- Repo: `https://github.com/addyosmani/agent-skills`
- License observed: MIT.
- Verified: engineering lifecycle skills from specification/planning through build/test/review/ship.
- Tutoria use: study/adapt selected methods; existing Tutoria routing remains primary.

### OpenSpec
- Repo: `https://github.com/Fission-AI/OpenSpec`
- License observed: MIT.
- Tutoria use: requirements/design/tasks/verification ideas; do not replace accepted Tutoria docs/process unless separately justified.

### Context Engineering Skills
- Repo: `https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering`
- License observed: MIT.
- Tutoria use: selected context/evaluation/multi-agent concepts only; executable examples still require security review.

### Awesome Agent Skills
- Repo: `https://github.com/VoltAgent/awesome-agent-skills`
- Catalog repo license observed: MIT.
- Tutoria use: discovery only. Catalog inclusion is not evidence that a listed skill is safe, correct, compatible, or license-cleared.

## Permanent Tutoria rule

```text
candidate discovery
-> exact source/ref
-> repo-license-guard
-> skill security scan
-> semantic conflict review
-> least privilege
-> bounded eval
-> INCORPORATE / ADAPT / STUDY_ONLY / REJECT
```
