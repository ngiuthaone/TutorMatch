# Integrate Tutoria Agent OS V2 — Responsibilities + Skills + Production Team

You are integrating a prepared **Tutoria Agent OS V2 overlay** into the live current Tutoria repository.

This is an **AGENT-OS-INTEGRATION-ONLY** task.

Do **not** implement product features, do not begin Supabase persistence, do not reopen the accepted Booking/Session/Payment architecture, and do not modify application behavior merely to prove the agents work.

The live checkout is authoritative. The supplied overlay is a prepared candidate implementation and must be semantically merged, never blindly forced over newer project instructions.

---

## 1. Goal

Upgrade Tutoria's existing Agent OS from primarily role definitions into a durable system with:

- explicit agent responsibilities;
- repeatable Agent Skills;
- authority/boundary rules;
- standardized handoffs;
- phase-based agent activation;
- independent final verification;
- safe external-skill ingestion;
- continued observability, security, and OSS/license enforcement.

Preserve the existing philosophy:

```text
smallest competent team
+ evidence before claims
+ read-heavy parallelism when useful
+ serialized/owned overlapping writes
+ STUDY -> ABSTRACT -> TUTORIA-NATIVE IMPLEMENTATION
+ exact-source license/provenance gate
+ independent security/QA/verifier roles
```

---

## 2. Audit the live Agent OS first

Before edits, inspect at least:

```text
AGENTS.md
nested AGENTS.md files if any
.codex/config.toml
.codex/agents/*.toml
.agents/skills/**/SKILL.md
docs/agent-team/**
scripts/validate-agent-os.py
scripts/validate-team.py
scripts/team-observability.py
.agents/skills/tutoria-orchestrator/SKILL.md
.agents/skills/tutoria-team-observability/SKILL.md
.agents/skills/tutoria-security-guard/SKILL.md
.agents/skills/repo-license-guard/SKILL.md
docs/OSS_POLICY.md
oss/REPO_POLICY.json
oss/EXTERNAL_SOURCES.json
THIRD_PARTY_NOTICES.md
scripts/oss_guard.py
```

Also inspect `git status` before changing anything.

Do not assume the dated overlay reflects every live-repo improvement.

Report any direct contradiction between the overlay and current Agent OS before resolving it. Prefer the stricter/current Tutoria-specific behavior when compatible.

---

## 3. Preserve the existing team

The previously established team contains these project roles:

```text
product_planner
product_designer
code_explorer
frontend_engineer
backend_engineer
qa_browser
security_reviewer
researcher
license_guard
```

plus the root/orchestrator workflow.

Do not remove or replace those roles solely because this overlay adds specialization.

The V2 expansion proposes these additional roles:

```text
context_scout
database_engineer
integration_engineer
payments_engineer
qa_engineer
independent_verifier
reliability_engineer
```

If a materially equivalent live role already exists, merge responsibilities instead of creating a duplicate. Preserve unique agent names.

`qa_engineer` and `qa_browser` are intentionally different:

```text
qa_engineer = backend/database/API/concurrency/idempotency/failure QA
qa_browser  = browser/UI/E2E/responsive/accessibility evidence
```

`context_scout` and `independent_verifier` should remain read-only unless the current Codex schema requires another safe equivalent.

---

## 4. Integrate the Tutoria-native skill library

The overlay contains Tutoria-native skills under:

```text
.agents/skills/
```

including:

```text
tutoria-task-routing
tutoria-context-scout
tutoria-evidence-map
tutoria-handoff-contract
tutoria-requirement-traceability

tutoria-product-policy
tutoria-domain-modeling
tutoria-capacity-concurrency

tutoria-supabase-persistence
tutoria-postgres-concurrency
tutoria-rls-review

tutoria-application-services
tutoria-idempotency-outbox

tutoria-payment-integration
tutoria-payment-webhooks

tutoria-backend-qa
tutoria-browser-qa
tutoria-independent-verification

tutoria-server-authoritative-ui
tutoria-production-reliability

tutoria-skill-ingestion
tutoria-external-reference
```

For each incoming skill:

1. inspect whether a live equivalent already exists;
2. if no equivalent exists, add it;
3. if an equivalent exists, compare semantics and preserve the stronger/current version;
4. do not keep two canonical skills that encode the same workflow with conflicting rules;
5. maintain Agent Skills-compatible frontmatter (`name`, `description`) and exact directory/name matching;
6. preserve progressive-disclosure intent: SKILL.md should contain repeatable workflow knowledge, not a giant dump of the whole project.

Do not replace existing `repo-license-guard`, `tutoria-security-guard`, `tutoria-orchestrator`, or team-observability skills with weaker versions.

---

## 5. Merge responsibility and authority rules

Use these supplied docs as semantic merge inputs:

```text
docs/agent-team/AGENT_RESPONSIBILITY_SKILL_MATRIX_V2.md
docs/agent-team/AGENT_AUTHORITY_MATRIX_V2.md
docs/agent-team/AGENT_SKILL_BINDINGS_PATCH.md
docs/agent-team/AGENT_SKILL_PHASE_ACTIVATION_V2.md
docs/agent-team/AGENT_ROUTING_MATRIX_V2.md
docs/agent-team/AGENT_HANDOFF_CONTRACTS_V2.md
docs/agent-team/PRODUCTION_PHASE_GATES.md
```

Important authority rules to preserve:

```text
product policy
!=
domain invariant
!=
database enforcement strategy
```

Examples:

- `database_engineer` may choose a correct persistence/serialization mechanism, but may not decide that requested bookings do not hold capacity merely because that is easier to implement.
- `payments_engineer` may design provider integration but may not place payment states into `BookingStatus`.
- `frontend_engineer` may present capacity/payment state but may not make client state authoritative.
- `security_reviewer` independently reviews RLS/auth/trust boundaries and should not self-certify its own risky implementation.
- `independent_verifier` must inspect the real final diff and remain independent of the implementation it certifies.

---

## 6. Skill bindings

Semantically bind agents to relevant skills; do not create rigid loading that wastes context on every task.

Expected conceptual mapping:

```text
orchestrator
  -> tutoria-task-routing
  -> tutoria-handoff-contract
  -> tutoria-requirement-traceability

context_scout
  -> tutoria-context-scout
  -> tutoria-evidence-map

code_explorer
  -> tutoria-evidence-map
  -> tutoria-requirement-traceability

product_planner
  -> tutoria-product-policy

backend_engineer
  -> tutoria-domain-modeling
  -> tutoria-capacity-concurrency when relevant

database_engineer
  -> tutoria-supabase-persistence
  -> tutoria-postgres-concurrency

integration_engineer
  -> tutoria-application-services
  -> tutoria-idempotency-outbox

payments_engineer
  -> tutoria-payment-integration
  -> tutoria-payment-webhooks

frontend_engineer
  -> tutoria-server-authoritative-ui

security_reviewer
  -> existing tutoria-security-guard
  -> tutoria-rls-review when relevant
  -> tutoria-skill-ingestion for external skills

qa_engineer
  -> tutoria-backend-qa

qa_browser
  -> tutoria-browser-qa

independent_verifier
  -> tutoria-independent-verification
  -> tutoria-requirement-traceability

reliability_engineer
  -> tutoria-production-reliability
  -> tutoria-idempotency-outbox

researcher
  -> tutoria-external-reference

license_guard
  -> existing repo-license-guard
  -> tutoria-skill-ingestion for external skills
```

Use the mechanism supported by the live Codex/project Agent Skills setup. Do not invent unsupported agent-config fields merely to encode a dependency.

---

## 7. Preserve phase-based activation

Tutoria is currently finishing domain architecture with Capacity + Concurrency before persistence.

The Agent OS must understand the sequence:

```text
DOMAIN / CAPACITY
    -> backend_engineer
    -> product_planner only if real policy gap
    -> verifier

then SUPABASE PERSISTENCE
    -> database_engineer
    -> security_reviewer
    -> backend_engineer
    -> qa_engineer
    -> verifier

then TRANSACTIONS / API / OUTBOX
    -> integration_engineer
    -> database_engineer
    -> backend_engineer
    -> QA/verifier

then PAYMENT PROVIDER
    -> payments_engineer
    -> integration_engineer
    -> security_reviewer
    -> qa_engineer
    -> verifier

then FRONTEND VERTICAL SLICE
    -> frontend_engineer
    -> integration_engineer
    -> qa_browser

then PRIVATE ALPHA / PRODUCTION
    -> reliability_engineer
    -> security_reviewer
    -> QA
    -> verifier
```

Do not invoke production specialists merely because they exist.

---

## 8. External skill ingestion pipeline

The overlay contains:

```text
oss/AGENT_SKILL_CANDIDATES.json
docs/agent-team/EXTERNAL_AGENT_SKILL_ADOPTION_PLAN.md
.agents/skills/tutoria-skill-ingestion/SKILL.md
```

This registry is **research only** and must NOT be merged into `oss/EXTERNAL_SOURCES.json` as though the candidates were already incorporated.

For any external skill/plugin you consider installing now or later, require:

```text
canonical exact source
-> exact commit/tag/version + exact skill path
-> existing repo-license-guard
-> security scan of SKILL.md/scripts/downloads/tool permissions
-> Tutoria semantic-conflict review
-> least-privilege review
-> bounded behavior/eval
-> INCORPORATE / ADAPT / STUDY_ONLY / REJECT
-> real OSS ledger/notices only if material is actually incorporated/adapted
```

Priority research candidates include:

```text
agentskills/agentskills               structural specification reference
supabase/agent-skills                 official Supabase skills
getsentry/skills skill-scanner        external-skill security scanning candidate
vercel-labs/agent-browser             qa_browser execution-layer candidate
vercel-labs/agent-skills              frontend guidance candidate
stripe/ai                             only if Stripe becomes selected provider
trailofbits/skills                    plugin/reference; exact license gate required
obra/superpowers                      adapt selected methodology, not competing OS
```

### External installations in THIS task

Do not mass-install the research list.

You MAY evaluate and integrate an external skill/tool during this Agent OS task only when all of the following hold:

1. it materially improves the Agent OS immediately;
2. exact current source/ref is identified;
3. existing OSS/license policy passes;
4. skill/security review passes;
5. it does not install a competing orchestration system or weaken Tutoria rules;
6. installation can be validated without modifying Tutoria application behavior.

Strong first candidates for evaluation are:

```text
getsentry/skills -> skill-scanner
agentskills/agentskills -> specification/reference only
```

Supabase skills may be prepared/evaluated, but do **not** begin Supabase persistence as part of this task.

If exact-source/tool availability prevents safe installation, keep the candidate documented and report `DEFERRED`, not `PASS`.

---

## 9. Existing external-reference philosophy must survive

Preserve:

```text
STUDY -> ABSTRACT -> TUTORIA-NATIVE IMPLEMENTATION
```

and the distinction:

```text
SOURCE LICENSE RESULT:
PASS / REVIEW / BLOCKED

FEATURE ACTION:
INCORPORATE / ADAPT / STUDY_ONLY / HARD_BLOCK
```

A blocked source does not automatically block independent implementation of a useful Tutoria feature.

---

## 10. Model/cost/concurrency policy

Inspect live `.codex/config.toml` and current model availability before changing any model identifiers.

Preserve the current principle:

- cheap/fast read-only scouting where sufficient;
- stronger reasoning for implementation/security/payment/database correctness;
- do not spawn the whole team;
- stay within the existing configured subagent concurrency cap unless there is an explicit reason to change it;
- independent read-heavy work may run in parallel;
- overlapping writes must have clear ownership and normally serialize.

Do not change model routing merely because the overlay contains dated model suggestions if live config is newer or currently working.

---

## 11. Observability integration

Preserve the existing team-observability system.

Update it only if needed so new agents can be recorded using the same evidence model as existing agents.

Do not fabricate token/cost/model telemetry. Keep unavailable metrics `N/A` according to existing policy.

For substantial orchestrated tasks, continue recording:

- agents invoked;
- reasons;
- results;
- reviewer acceptance/rework;
- unnecessary/missed routing where the current system supports it.

---

## 12. Installer/merge behavior

If using the supplied installer:

```bash
bash install-agent-os-v2-skills.sh /ABSOLUTE/PATH/TO/TUTORIA
```

Exit `0` means no content conflicts were detected by the copy step.
Exit `10` means incoming files were safely staged and require semantic merge.

Never interpret either result as final Agent OS acceptance without validation.

The installer intentionally does not overwrite:

```text
AGENTS.md
.codex/config.toml
existing differing agent/skill definitions
existing observability state
existing OSS ledger/notices
existing security/license skills
```

Resolve all staged conflicts manually/semantically.

---

## 13. Validate the integrated Agent OS

Run applicable existing checks plus the new validator. At minimum, if paths exist:

```bash
python3 scripts/validate-agent-os.py
python3 scripts/validate-team.py
python3 scripts/validate-agent-os-v2-pack.py
python3 scripts/oss_guard.py ci
python3 scripts/team-observability.py report
bash -n scripts/security-scan.sh
```

Run relevant Python tests for validators/OSS guard/Agent OS.

Validate all `.codex/agents/*.toml` against the current Codex schema/tooling available locally.

Validate all skill directories:

```text
directory name == SKILL.md frontmatter name
required name/description present
no duplicate canonical workflow skill
no accidental executable/download behavior added without review
```

Because this task should not change application code, do not run expensive unrelated full application builds solely for ceremony. If application files are accidentally touched, investigate and revert unrelated changes before acceptance.

---

## 14. Bounded routing smoke tests

Do not implement product changes. Test routing conceptually or with read-only/bounded tasks.

### A — Current Capacity + Concurrency architecture

Prompt concept:

```text
Continue the accepted Capacity + Concurrency architecture test.
Do not begin Supabase persistence.
```

Expected:

```text
backend_engineer / code_explorer as needed
product_planner only for genuine unresolved policy
independent_verifier
NO database implementation
NO payment/reliability/frontend agents by default
```

### B — Supabase persistence task

Expected:

```text
database_engineer primary
backend_engineer for domain mapping
security_reviewer for RLS/auth
qa_engineer for persistence/concurrency tests
independent_verifier
```

### C — Payment webhook integration

Expected:

```text
payments_engineer primary
integration_engineer
database_engineer if durable idempotency schema changes
security_reviewer
qa_engineer
independent_verifier
```

### D — Small frontend spacing/responsive bug

Expected:

```text
frontend_engineer
qa_browser if verification warrants it
```

Do not spawn database/payments/reliability merely because they exist.

### E — External agent skill request

Expected:

```text
researcher or code_explorer for candidate context
license_guard
security_reviewer/skill security workflow when executable behavior exists
tutoria-skill-ingestion
```

No blind installation from an awesome list.

### F — Missing historical context

Expected:

```text
context_scout read-only
```

Only when the current task genuinely lacks needed evidence.

Record routing smoke-test evidence through existing team observability when appropriate.

---

## 15. Independent verification

After integration, invoke `independent_verifier` or equivalent independent read-only review.

It must inspect:

- actual final diff;
- all newly added/merged agent definitions;
- all skills;
- responsibility/authority matrix consistency;
- routing/phase rules;
- validator results;
- external-skill candidate registry separation from real OSS incorporation ledger;
- whether existing security/license/observability behavior was weakened;
- whether application code was improperly modified.

Do not let the same implementer simply declare itself verified.

---

## 16. Final report

Report exactly:

1. **Live Agent OS found** — existing agents/skills/config/guards/observability.
2. **New agents integrated** — exact roles added vs merged/deferred.
3. **Skills integrated** — exact Tutoria-native skills added/merged.
4. **Responsibilities/boundaries** — important authority rules preserved.
5. **Routing changes** — how smallest-team routing changed.
6. **Phase activation** — domain -> Supabase -> API -> payment -> frontend -> reliability.
7. **External skill candidates** — evaluated/installed/deferred and exact reasons.
8. **External material actually incorporated** — exact source/ref/license/ledger status, if any.
9. **Security findings** — including skill supply-chain review.
10. **OSS/license findings** — confirm candidate registry was not treated as incorporation ledger.
11. **Observability changes** — new agents correctly recordable or any limitations.
12. **Files changed** — exact paths.
13. **Conflicts resolved** — exact semantic merges.
14. **Checks run** — exact commands/results; skipped = UNVERIFIED.
15. **Routing smoke tests** — scenarios A-F and actual routing result.
16. **Independent verifier result**.
17. **Anything still deferred/unverified**.
18. **Final status** — `PASS`, `PARTIAL`, `UNVERIFIED`, or `BLOCKED`.

---

## 17. Stop rule

Stop after Agent OS V2 integration and validation.

Do **not** proceed into:

```text
Capacity implementation
Supabase persistence
RLS application changes
payment provider integration
notifications
production APIs
frontend vertical slice
```

Those are subsequent product tasks.

The success criterion for this task is:

> Tutoria has a coherent agent organization where each specialist has clear responsibility, reusable skills, explicit authority boundaries, safe handoffs, phase-aware routing, external-skill supply-chain controls, and independent verification — without weakening the Agent OS already in the live repository.
