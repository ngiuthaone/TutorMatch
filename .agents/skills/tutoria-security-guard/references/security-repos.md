# Security repository catalog for Tutoria

Snapshot researched: **2026-08-11**. Licenses, product tiers, and repositories can change. Re-verify the exact version/commit before adding, copying, redistributing, or depending on any external project.

The catalog deliberately distinguishes **running a tool** from **incorporating its code**. A scanner can be useful without becoming part of Tutoria's codebase.

## Decision labels

- **BASELINE** — high-value default for Tutoria.
- **DEEP** — use for pre-release or focused investigation.
- **OPTIONAL** — useful only when the corresponding architecture/risk exists.
- **REFERENCE** — guidance/checklist source; not a runtime tool.
- **RUN_TOOL_ONLY** — do not vendor/copy into Tutoria without a separate license review.
- **VERIFY_FIRST** — current licensing/entitlement is ambiguous, special, or environment-dependent.

## Baseline scanners and linters

| Repository | Purpose | License snapshot | Tutoria mode | Priority | Notes |
|---|---|---|---|---|---|
| `google/osv-scanner` | Vulnerable dependency scanning; license policy support | Apache-2.0 | RUN_TOOL | BASELINE | Strong first pass for package vulnerabilities. Avoid guided remediation on untrusted projects if it would execute package-manager scripts. |
| `aquasecurity/trivy` | Vulnerability, secret, misconfiguration, license scanning across repos/images/filesystems | Apache-2.0 | RUN_TOOL | BASELINE | Broad cross-check. Treat unknown licenses as review items rather than safe. |
| `gitleaks/gitleaks` | Git/repo secret detection | MIT | RUN_TOOL | BASELINE | Mature and useful; current project states it is feature-complete with future releases focused on security patches. |
| `Yelp/detect-secrets` | Prevent new secrets using baselines/plugins/audit workflow | Apache-2.0 | RUN_TOOL or approved dev dependency | BASELINE | Good complement to Gitleaks for pre-commit/baseline workflows. |
| `eslint-community/eslint-plugin-security` | JavaScript/Node security hotspot linting | Apache-2.0 | ADD_DEPENDENCY after normal review | BASELINE | Hotspot rules can false-positive; human triage required. |
| `zizmorcore/zizmor` | GitHub Actions security static analysis | MIT | RUN_TOOL | BASELINE if Actions exist | Checks template injection, credentials, permissions, impostor refs, etc. |
| `rhysd/actionlint` | GitHub Actions syntax/semantic checks | MIT | RUN_TOOL | BASELINE if Actions exist | Complements zizmor; correctness failures often reveal unsafe workflow assumptions. |
| `theory/pgtap` | PostgreSQL unit testing | permissive PostgreSQL-style license | ADD/USE after review | BASELINE for Supabase | Excellent for deterministic RLS/authorization tests written for Tutoria. |

## Supabase-specific

| Repository | Purpose | License snapshot | Tutoria mode | Priority | Notes |
|---|---|---|---|---|---|
| `supabase/supabase` | Supabase platform/docs/examples | Apache-2.0 at root | REFERENCE / existing platform | BASELINE | Follow official RLS guidance: client-exposed data needs correct RLS; service-role secrets stay server-side. |
| `supabase/splinter` | SQL/Postgres linter used for Supabase-style schema issues | **VERIFY_FIRST: repository currently shows an open PR to add Apache-2.0 LICENSE** | REFERENCE/RUN VIA APPROVED TOOLING; BLOCK_COPY until verified | BASELINE idea, special license gate | Do **not** copy `splinter.sql` into Tutoria while license status is unresolved. Re-check before each adoption. |

## Deeper SAST / IaC / supply chain

| Repository | Purpose | License snapshot | Tutoria mode | Priority | Notes |
|---|---|---|---|---|---|
| `semgrep/semgrep` | Multi-language static analysis | LGPL-2.1 | RUN_TOOL_ONLY by default | DEEP | Community Edition is useful, but do not vendor/modify/copy without license review. Some deeper capabilities belong to Semgrep's commercial platform. |
| `bridgecrewio/checkov` | IaC/config/SCA scanning | Apache-2.0 | RUN_TOOL | DEEP if Terraform/K8s/Docker/OpenAPI etc. exist | Do not add if Trivy already covers the actual IaC risk sufficiently. |
| `ossf/scorecard` | Open-source project security posture signals | Apache-2.0 | RUN_TOOL | DEEP | Use for supply-chain signals, not as a binary allow/deny score. |
| `lirantal/lockfile-lint` | Lockfile origin/integrity policy for npm/yarn | Apache-2.0 | RUN_TOOL/dev tool after review | DEEP | Detect package manager first; do not assume pnpm parity. |
| `step-security/harden-runner` | GitHub Actions runtime/egress hardening | Apache-2.0 code; service tier matters | VERIFY_FIRST / optional Action | DEEP | Current project indicates private-repository support is in paid Enterprise. Do not silently introduce service dependency/cost. |
| `github/codeql` | CodeQL libraries/queries | MIT for repo content | REFERENCE / queries; CLI separately licensed | OPTIONAL / VERIFY_FIRST | **CodeQL CLI has separate terms and closed-source/automated analysis requires appropriate commercial entitlement.** Never infer CLI rights from the MIT query repo. |

## SBOM and secondary vulnerability analysis

| Repository | Purpose | License snapshot | Tutoria mode | Priority | Notes |
|---|---|---|---|---|---|
| `anchore/syft` | Generate SBOMs | Apache-2.0 | RUN_TOOL | DEEP | Good release/provenance artifact. |
| `anchore/grype` | Scan images/filesystems/SBOMs for vulnerabilities | Apache-2.0 | RUN_TOOL | DEEP | Useful independent cross-check and prioritization. |
| `cdxgen/cdxgen` | CycloneDX/SPDX SBOM generation | Apache-2.0 | RUN_TOOL | OPTIONAL | Choose Syft or cdxgen unless there is a reason to maintain both. |
| `microsoft/sbom-tool` | SPDX SBOM generation | MIT | RUN_TOOL | OPTIONAL | Alternative SBOM path. |
| `sigstore/cosign` | Sign/verify OCI artifacts | Apache-2.0 | RUN_TOOL | OPTIONAL | Valuable only if Tutoria ships/signs OCI/container artifacts or similar release artifacts. |
| `DefectDojo/django-DefectDojo` | Vulnerability-management aggregation | BSD-3-Clause | External platform/tool | OPTIONAL/later | Probably unnecessary for a lean early-stage repo; useful when scanner volume/team size grows. |

## DAST / API / runtime testing

| Repository | Purpose | License snapshot | Tutoria mode | Priority | Safety rule |
|---|---|---|---|---|---|
| `zaproxy/zaproxy` | Web application DAST/proxy | Apache-2.0 | RUN_TOOL | PRE_RELEASE | Local/staging baseline/passive first; production passive by default. |
| `projectdiscovery/nuclei` | Template-driven vulnerability scanning | MIT | RUN_TOOL | PRE_RELEASE | Use a safe allowlist only; never run all exploit/destructive templates against production. |
| `projectdiscovery/nuclei-templates` | Community Nuclei templates | MIT | REFERENCE/RUN selected templates | PRE_RELEASE | Review selected template behavior before execution. Treat templates as executable security logic. |
| `schemathesis/schemathesis` | Property-based/adaptive OpenAPI/GraphQL API testing | MIT | RUN_TOOL | PRE_RELEASE when schema exists | Use test accounts/data; avoid third-party side effects. |
| `ffuf/ffuf` | HTTP fuzzing/content discovery | MIT | RUN_TOOL | OPTIONAL | Strict scope/rate limits; local/staging preferred; no brute-force abuse. |

## Optional runtime protections

These are **not automatic recommendations**. Adding runtime security services increases architecture, cost, vendor dependencies, and failure modes. First prove the missing control cannot be adequately implemented with existing stack primitives.

| Repository | Purpose | License snapshot | Tutoria mode | Priority | Notes |
|---|---|---|---|---|---|
| `arcjet/arcjet-js` | App-layer bot/abuse/security controls for JS/Next.js | Apache-2.0 | ADD_DEPENDENCY only after architecture review | OPTIONAL | Could help for rate limiting/bot abuse; do not add merely because it exists. |
| `upstash/ratelimit-js` | Serverless/Next.js rate limiting | MIT | ADD_DEPENDENCY + external data/service dependency | OPTIONAL | Evaluate current infra/cost/privacy before adding. |

## Special/copyleft tool

| Repository | Purpose | License snapshot | Tutoria mode | Priority | Notes |
|---|---|---|---|---|---|
| `trufflesecurity/trufflehog` | Discover and optionally verify secrets across many sources | AGPL-3.0 | RUN_TOOL_ONLY unless explicit legal review | OPTIONAL | Prefer no-verification/offline mode by default to avoid contacting third-party services with candidate secrets. Never vendor casually. |

## Reference-only OWASP repositories

These are excellent for deciding **what must be verified**, but their documentation is generally CC BY-SA. Use them as references, cite requirement/test identifiers where appropriate, and summarize rather than copying substantial text into proprietary materials.

| Repository | Role | License snapshot | Tutoria use |
|---|---|---|---|
| `OWASP/ASVS` | Application Security Verification Standard | CC BY-SA 4.0 | Security acceptance criteria / release requirements |
| `OWASP/CheatSheetSeries` | Practical implementation guidance | CC BY-SA 4.0 | Focused design/remediation reference |
| `OWASP/API-Security` | API Security Top 10/guidance | CC BY-SA 4.0 | API abuse/access-control threat modeling |
| `OWASP/wstg` | Web Security Testing Guide | CC BY-SA 4.0 | Manual/DAST testing methodology |

## Suggested Tutoria stack by maturity

### Right now / lean baseline

Use only what gives high signal with little operational burden:

1. Gitleaks.
2. OSV-Scanner.
3. Trivy.
4. Existing ESLint/typecheck/tests; add `eslint-plugin-security` only if it fits the JS config cleanly.
5. actionlint + zizmor when GitHub Actions exist.
6. Supabase RLS tests with project-owned SQL/pgtap tests.
7. Manual business-logic review for bookings, messages, uploads, admin, and webhooks.

### Before public production launch

Add targeted:

1. Semgrep external scan.
2. SBOM (Syft or cdxgen) + optional Grype cross-check.
3. ZAP baseline against staging.
4. Schemathesis if an OpenAPI/GraphQL schema exists.
5. Carefully selected safe Nuclei templates.
6. Checkov only if relevant IaC/config exists.

### When team/repo complexity grows

Consider:

- OpenSSF Scorecard for upstream dependency governance;
- Harden-Runner if pricing/private-repo support and workflow needs justify it;
- DefectDojo or another findings-management system only after spreadsheet/issue-based triage stops scaling;
- Cosign when distributing container/OCI artifacts.

## Do not cargo-cult scanners

A clean scan does not prove:

- RLS policies are correct;
- user A cannot edit user B's booking;
- a price cannot be tampered with;
- a webhook cannot be replayed;
- workshop capacity cannot oversell under concurrency;
- private messages/uploads cannot leak;
- admin routes cannot be reached by ordinary users;
- payment/refund state transitions are valid.

Those require Tutoria-specific tests and reasoning.
