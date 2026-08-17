# External Agent-Skill Adoption Plan

This file records research candidates only. It is intentionally separate from `oss/EXTERNAL_SOURCES.json`. A candidate is **not incorporated** merely because it is listed here.

## P0 — evaluate before next production phases
1. **Agent Skills specification (`agentskills/agentskills`)** — structural reference for all Tutoria skills.
2. **Supabase official agent skills (`supabase/agent-skills`)** — evaluate before Supabase persistence work. Verify changing implementation details against current official docs and current issues.
3. **Sentry `skill-scanner` (`getsentry/skills`)** — evaluate as the security gate for any future external skill.
4. **Vercel `agent-browser`** — evaluate as the execution layer for `qa_browser`.

## Conditional
- **Stripe official skills** only if Stripe becomes Tutoria's selected provider.
- **Vercel React skills** when Discover/production frontend integration begins.
- **Trail of Bits** preferably via plugin/reference because current repository licensing is share-alike; exact reuse requires the existing license guard.
- **Superpowers**: adapt methodology only. Do not install a competing orchestration operating system over Tutoria Agent OS.

## Ingestion test
For every candidate: exact source/ref -> license guard -> security scan -> semantic conflict review -> least privilege -> bounded eval -> incorporate/adapt/study/reject.
