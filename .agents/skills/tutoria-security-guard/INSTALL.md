# Install Tutoria Security Guard for Codex

Place this folder at:

```text
<YOUR_TUTORIA_REPO>/.agents/skills/tutoria-security-guard/
```

The required file is `SKILL.md`. Keep `references/`, `scripts/`, and `agents/openai.yaml` beside it.

Example invocations in Codex:

```text
$tutoria-security-guard audit the current changes before I merge
$tutoria-security-guard do a full pre-release security audit
$tutoria-security-guard check all Supabase RLS policies and write regression tests
$tutoria-security-guard threat-model the booking and payment flow before we build it
$tutoria-security-guard review this new GitHub repo/dependency before we add it
$tutoria-security-guard audit our file uploads and private storage
$tutoria-security-guard audit GitHub Actions and deployment secrets
```

You can also ask naturally without naming the skill; Codex can match skills from their descriptions. Explicit `$tutoria-security-guard` invocation is useful when you want to guarantee the workflow is applied.

## Recommended pairing

Keep your existing `repo-license-guard` skill installed. This skill will defer to it before copying/embedding external security repository code and will still perform its own conservative license classification when that skill is unavailable.

## Optional helper

Run the deterministic baseline helper from the Tutoria repo:

```bash
.agents/skills/tutoria-security-guard/scripts/security-scan.sh --quick
```

Full local pass using only already-installed tools:

```bash
.agents/skills/tutoria-security-guard/scripts/security-scan.sh --full
```

Staging baseline (only for a Tutoria-owned URL):

```bash
.agents/skills/tutoria-security-guard/scripts/security-scan.sh --full --target https://YOUR-STAGING-URL
```

Production mode intentionally disables active/fuzzing helpers:

```bash
.agents/skills/tutoria-security-guard/scripts/security-scan.sh --target https://YOUR-PRODUCTION-URL --prod
```

The helper installs nothing. Missing scanners are reported as `SKIPPED`, never as passed.
