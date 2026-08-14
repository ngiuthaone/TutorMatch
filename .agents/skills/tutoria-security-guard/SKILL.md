---
name: tutoria-security-guard
description: Audit and harden Tutoria across Next.js/Vercel/Supabase, dependencies, secrets, auth/RLS, APIs, bookings/payments, uploads, messaging, GitHub Actions, and deployment. Use before production, after security-sensitive changes, when adding dependencies or third-party repos, or whenever asked to review Tutoria security. Prefer safe local/staging verification, never attack third-party systems, and never copy external security code without a license gate.
---

# Tutoria Security Guard

Act as Tutoria's defensive application-security engineer. Find exploitable weaknesses, prove them safely, fix the smallest root cause, add regression coverage, and re-test. Do not claim the application is "secure" merely because scanners are clean.

## Operating principles

1. **Defensive scope only.** Scan the current repository and Tutoria-owned environments only. Do not attack unrelated third-party targets, users, vendors, or infrastructure.
2. **Local/staging first.** Prefer source review, unit/integration tests, local services, and staging. Production testing must be passive or clearly non-destructive unless the user explicitly authorizes a specific safe test.
3. **Never expose secrets.** Redact tokens, passwords, cookies, private keys, service-role keys, webhook secrets, database URLs, and PII in logs/reports. Show only fingerprints or the first/last few characters when necessary.
4. **No blind tool installation.** Do not `curl | sh`, execute untrusted install scripts, or add new dependencies merely to complete a scan. Use already-installed tools first. Propose installation separately with the license status and reason.
5. **License before adoption.** Treat running a scanner, adding a dependency, copying code, and reading reference material as different actions. Follow the License Gate below.
6. **Evidence over speculation.** Every finding should identify the affected path/component, attack precondition, impact, and verification status.
7. **Fix + regression test + re-test.** A security fix is incomplete until there is a test or deterministic verification preventing recurrence where practical.
8. **Least privilege by default.** Apply this to Supabase policies, API tokens, GitHub Actions, storage, admin functions, and server-side credentials.
9. **Fail safely.** Security controls should deny on ambiguity; errors should not leak implementation details or secrets.
10. **Do not weaken controls to make tests pass.** Never disable RLS, CSP, auth checks, signature validation, rate limits, or scanners as a shortcut.

## 0. Establish scope and mode

Determine what changed and classify the requested review:

- `QUICK`: changed files + secrets + dependencies + relevant auth/RLS/API checks.
- `PR`: diff-focused review plus regression tests and CI/workflow checks.
- `FULL`: whole repository and local/staging security review.
- `PRE_RELEASE`: FULL plus release gates and safe DAST against staging.
- `INCIDENT`: contain exposure, rotate/revoke credentials, identify blast radius, preserve evidence, then fix.
- `DEPENDENCY_REVIEW`: license + provenance + vulnerability + maintainer/supply-chain review before adoption.
- `THREAT_MODEL`: enumerate assets, trust boundaries, abuse cases, controls, and tests before implementation.

If no mode is given, choose `QUICK` for ordinary code changes and `PRE_RELEASE` when the user is preparing a deployment/launch.

Record:

- repository root and current branch/commit;
- package manager and lockfile;
- framework/runtime versions visible in the repo;
- Supabase configuration/migrations/functions/storage usage;
- GitHub Actions workflows;
- Vercel config and environment-variable usage;
- authentication/authorization entry points;
- public API/route handlers/server actions;
- booking/payment/webhook code if present;
- uploads/storage/media handling if present;
- messaging/community/content moderation surfaces if present;
- admin/internal tooling if present.

Do not assume a component exists because it is typical for Tutoria. Derive it from the repository.

## 1. License Gate for security repositories

Before introducing code, packages, Actions, templates, or scripts from another repository, classify the intended use:

- `RUN_TOOL`: invoke an external CLI/container/action without incorporating its source into Tutoria.
- `ADD_DEPENDENCY`: add a library/package to Tutoria's runtime/dev dependencies.
- `COPY_CODE`: paste, vendor, fork, modify, or incorporate source/templates/config from the repo.
- `REFERENCE_ONLY`: learn security requirements or testing ideas without copying substantial text/code.

Then:

1. If the `repo-license-guard` skill is available, invoke/follow it before `ADD_DEPENDENCY` or `COPY_CODE`, and when a tool's license is uncertain.
2. Verify the repository's **current** license at the exact version/commit being considered; do not rely only on this skill's snapshot.
3. For `COPY_CODE`, require an explicit compatible license and preserve notices/attribution as required.
4. Treat **missing/unresolved license** as `BLOCK_COPY` until verified.
5. Treat strong copyleft/AGPL tools as `RUN_TOOL_ONLY` unless the user intentionally accepts the obligations after review.
6. Treat documentation under CC BY-SA as `REFERENCE_ONLY` by default: summarize principles, cite requirement IDs where useful, and do not paste large sections into proprietary Tutoria docs/code.
7. Treat separately licensed binaries/CLIs (for example CodeQL CLI) according to their own terms, not the source-query repository's license.
8. Record the decision in the final report: repo, version/commit if known, purpose, license, mode, decision.

See `references/security-repos.md` for the curated catalog and special cases.

## 2. Map attack surface before scanning

Build a compact trust-boundary map from the code:

- browser/client ↔ Next.js/Vercel server;
- browser/client ↔ Supabase browser-safe APIs;
- server ↔ Supabase service-role/admin APIs;
- unauthenticated ↔ authenticated ↔ privileged/admin identities;
- user A ↔ user B object ownership boundaries;
- public content ↔ private account/booking/message/payment data;
- upload client ↔ storage bucket ↔ public/signed download;
- app ↔ payment provider/webhooks;
- app ↔ email/SMS/OAuth/maps/AI or other external services;
- GitHub Actions ↔ repository secrets ↔ deployments.

Identify high-value assets:

- authentication sessions and reset flows;
- private profile/contact information;
- tutor/learner identity and verification data;
- bookings, prices, payouts/refunds/payment state;
- private messages;
- uploaded documents/media;
- admin/moderation capability;
- Supabase service-role/database credentials;
- deployment and CI credentials.

Prioritize broken access control, credential exposure, payment tampering, unsafe uploads, webhook forgery, injection, SSRF, XSS, CSRF, API abuse/rate-limit gaps, and CI supply-chain compromise.

## 3. Secrets scan

Preferred order:

1. Gitleaks for repository/history checks.
2. detect-secrets for baseline/pre-commit style prevention.
3. TruffleHog only as an optional external CLI; default to offline/no-verification behavior so scanning does not contact third-party services to validate credentials.
4. Trivy secret scanner can be a secondary cross-check.

Check:

- tracked files and relevant git history;
- `.env*`, test fixtures, logs, screenshots, exported JSON, SQL dumps, and source maps;
- Vercel/Supabase keys accidentally prefixed with `NEXT_PUBLIC_`;
- GitHub workflow logs and generated artifacts;
- hard-coded JWT secrets, API keys, webhook secrets, OAuth credentials, database URLs, private keys.

If a likely **live secret** is found:

- mark `STOP-THE-LINE`;
- do not print its full value;
- recommend or perform revocation/rotation only if the user has explicitly requested/authorized credential changes and the connected tool exists;
- remove it from current code and add prevention;
- warn that deleting a file in the latest commit does not erase git history;
- verify downstream logs/build artifacts do not still expose it.

## 4. Dependency, vulnerability, license, and SBOM review

Use overlapping tools because databases and detection methods differ:

- OSV-Scanner: primary package vulnerability check and license-policy support.
- Trivy: filesystem/repo vulnerabilities + misconfiguration + secret/license cross-check.
- Syft or cdxgen: produce an SBOM when release/provenance work needs it.
- Grype: optional second vulnerability pass against filesystem/SBOM.
- lockfile-lint: npm/yarn lockfile origin/integrity checks when compatible with the repo's lockfile.
- OpenSSF Scorecard: external dependency/repository supply-chain signals, not a substitute for code review.

Rules:

- detect the package manager; never assume npm/yarn/pnpm support is identical;
- do not auto-run package-manager lifecycle scripts on untrusted code;
- distinguish runtime vs dev-only vulnerabilities;
- determine whether the vulnerable code path is reachable before downgrading a finding;
- prefer upgrading to a patched compatible version over suppressing;
- document every suppression/waiver with reason and expiry/review trigger;
- flag abandoned/unmaintained critical dependencies and typosquatting/provenance anomalies;
- verify newly added GitHub Actions and dependencies are from intended publishers.

For `DEPENDENCY_REVIEW`, report:

- repository/package identity and official source;
- exact requested version;
- license and adoption mode;
- known vulnerabilities;
- maintenance/release recency;
- suspicious install/postinstall scripts;
- transitive dependency risk;
- safer alternative if blocked.

## 5. JavaScript / TypeScript / Next.js static review

Use:

- existing ESLint plus `eslint-plugin-security` when already configured or deliberately approved;
- Semgrep Community Edition as an external analysis tool when available, with its license noted;
- framework-native type checking and tests;
- manual taint/data-flow review for security-critical handlers.

Review specifically for:

- untrusted HTML / `dangerouslySetInnerHTML` / markdown rendering;
- DOM XSS and URL injection;
- open redirects;
- server-side request forgery from user-controlled URLs;
- shell/command execution;
- unsafe dynamic SQL or RPC inputs;
- path traversal;
- prototype pollution / unsafe object merging;
- server-only code or secrets imported into client bundles;
- authorization performed only in UI/client components;
- insecure Server Actions/route handlers that trust hidden form values;
- cache leakage between users;
- sensitive data in logs/errors/analytics;
- overly broad CORS;
- missing request size limits and schema validation.

Never treat TypeScript types as runtime input validation.

## 6. Supabase / Postgres / RLS review — highest priority

For every table/view/function/storage bucket reachable from a client or exposed API:

1. Determine intended actors and operations: anonymous, authenticated owner, counterpart, moderator/admin, server-only.
2. Verify Row Level Security is enabled where exposure requires it.
3. Enumerate SELECT/INSERT/UPDATE/DELETE policies independently.
4. Test **negative access** first:
   - anonymous cannot read/write private rows;
   - user A cannot read/update/delete user B's private rows;
   - role escalation cannot be achieved by editing client-controlled profile metadata;
   - unauthenticated or ordinary users cannot call privileged RPC/functions.
5. For ownership writes, check both row visibility (`USING`) and accepted new values (`WITH CHECK`) as applicable.
6. Avoid blanket `USING (true)` / public write policies unless the resource is intentionally public and abuse controls exist.
7. Verify service-role/admin keys exist only on trusted server paths and are never bundled to the browser.
8. Do not base authorization on user-editable metadata.
9. Review views for security-invoker behavior or keep them out of exposed schemas when appropriate.
10. Review security-definer functions carefully; keep privileged functions out of exposed schemas and constrain `search_path`.
11. Review storage bucket visibility and object policies; private uploads should not become permanent public URLs accidentally.
12. Verify signed URLs have appropriate expiry and are not logged/leaked.
13. Test migrations from a clean database when feasible so security does not depend on manual dashboard state.

Use Supabase-native linting when available. `supabase/splinter` is a valuable source/tool, but do not copy its SQL into Tutoria while its repository license remains unresolved; re-check current status first.

For deterministic database authorization, prefer pgtap or equivalent SQL tests checked into Tutoria, written specifically for Tutoria's policies rather than copied wholesale.

### Minimum RLS regression matrix

For each sensitive resource, cover as applicable:

| Actor | Own row | Other user's row | Public row | Admin/server path |
|---|---:|---:|---:|---:|
| anonymous | deny/private | deny | read only if intended | deny |
| authenticated owner | intended CRUD | deny | intended | deny |
| authenticated other user | deny unless business rule | deny | intended | deny |
| privileged/admin | explicit intended access | explicit intended access | intended | allow only trusted path |

Derive the actual matrix from business rules; this table is a starting invariant, not permission to invent access.

## 7. Authentication and session security

Trace sign-up, login, logout, OAuth, magic-link/email verification, password reset, account changes, and deletion.

Verify:

- redirect/callback allowlists prevent open redirect/account takeover chains;
- password reset and email-change flows cannot be replayed or redirected to attacker-controlled origins;
- privileged actions require fresh server-side authorization;
- auth state is checked on the server for protected mutations;
- session tokens/cookies use framework/provider secure defaults and are not logged;
- logout/revocation semantics are understood for critical sessions;
- admin/moderator access is not granted from a client-editable field;
- account enumeration is minimized where practical;
- login/reset/resend flows have abuse throttling.

Test horizontal and vertical access-control cases, not only happy paths.

## 8. API / Server Action / authorization review

For each mutation and sensitive read:

- identify the authenticated actor server-side;
- fetch/modify objects through an authorization condition, not `id` alone;
- reject mass assignment of ownership/role/price/status fields;
- validate input at runtime with bounded lengths/ranges/enums;
- return only required fields;
- cap pagination and expensive search/filter inputs;
- use safe database parameterization/RPCs;
- avoid exposing stack traces/internal IDs/secrets;
- set intentional CORS and methods;
- protect cookie-authenticated state-changing endpoints against CSRF as appropriate to architecture;
- rate-limit abuse-sensitive operations;
- make high-value mutations idempotent where retries are possible.

### BOLA / IDOR test pattern

For every object keyed by an ID/slug:

1. create/identify object owned by user A;
2. authenticate as user B;
3. try read/update/delete/status-change using A's object identifier;
4. verify denial and no side effect;
5. repeat across nested/indirect endpoints and server actions.

Apply this pattern to actual Tutoria resource names found in code rather than assuming a fixed schema.

## 9. Booking / payment / payout / webhook controls

If payment code exists, treat client data as untrusted.

Verify:

- product/session/booking price is recomputed or fetched server-side;
- currency, quantity, discount, fees, and recipient are not trusted from hidden/client fields;
- payment success is based on provider-confirmed server state, not a redirect query parameter;
- webhook signatures are verified against the **raw request body** where the provider requires it;
- webhook timestamp/replay protections are used when supported;
- webhook handling is idempotent;
- duplicate/reordered events cannot double-book, double-refund, or corrupt state;
- event type/object ownership/amount/currency match the expected booking;
- refund/cancel/reschedule paths enforce actor permissions and state transitions;
- payout/admin actions require strong server-side authorization;
- payment/webhook secrets are server-only.

Model race conditions around limited workshop capacity and simultaneous booking attempts. Prefer database-enforced atomicity/constraints or transactions rather than client-side counters.

## 10. File upload and storage security

For each upload surface:

- require authentication where intended;
- enforce byte-size limits before expensive processing;
- validate allowed types using server-side content/signature checks where relevant, not filename/`Content-Type` alone;
- generate server-controlled object names/paths;
- prevent path traversal and overwrite of another user's object;
- separate public promotional media from private identity/verification documents;
- make private buckets private by default;
- serve private objects through authorized short-lived signed URLs when appropriate;
- prevent SVG/HTML/scriptable uploads from executing in trusted app origin unless explicitly sanitized/isolated;
- strip or intentionally handle metadata when privacy matters;
- do not process untrusted files with unsafe native converters without sandboxing/limits;
- delete orphaned/private data according to product requirements.

## 11. Messaging, community, reviews, and user-generated content

Check:

- sender/recipient/thread membership on every message read/write;
- blocked/removed users cannot bypass restrictions through direct endpoints;
- HTML/markdown/rich text is sanitized at the correct boundary;
- links do not create `javascript:`/unsafe URL execution;
- mentions/previews/fetchers cannot SSRF internal services;
- attachments follow upload rules;
- spam/flooding controls exist for high-abuse endpoints;
- moderation/admin actions are audited and authorization-protected;
- deleted/private content does not remain available through predictable public URLs or caches.

## 12. GitHub Actions and software-supply-chain review

Run or emulate:

- `actionlint` for workflow correctness;
- `zizmor` for GitHub Actions security findings;
- OpenSSF Scorecard for relevant external repositories/dependencies;
- Harden-Runner only if its current licensing/service model fits the repository and the user chooses it.

Review manually:

- workflow `permissions:` are minimal and explicit;
- `pull_request_target` and untrusted PR code cannot access secrets;
- untrusted input is not interpolated into shell scripts;
- actions are pinned to immutable full commit SHAs for high-assurance workflows;
- checkout credential persistence is not broader than needed;
- fork PRs do not receive deployment/production credentials;
- artifacts/caches do not leak secrets;
- deploy jobs have environment protections appropriate to the project;
- dependency-update automation cannot silently introduce unreviewed privileged Actions.

## 13. Vercel / deployment / environment review

Inspect configuration and code rather than assuming dashboard state.

Check:

- server secrets are never intentionally exposed with `NEXT_PUBLIC_` or rendered into HTML/client JS;
- preview/development/production environments do not share unnecessary privileged secrets;
- deployment logs and error reporting redact secrets/PII;
- security headers fit the app: CSP, framing, MIME sniffing, referrer policy, permissions policy where useful;
- redirects/rewrites do not create auth bypass/open redirects;
- preview deployments containing sensitive features/data are appropriately protected;
- source maps/debug endpoints do not reveal secrets;
- environment-specific callback URLs/webhooks cannot be confused across prod/staging;
- serverless functions enforce their own authorization and input limits.

Do not invent dashboard settings you cannot inspect; report them as `MANUAL_VERIFY`.

## 14. Safe DAST / API testing

Default targets: local application, ephemeral preview, or staging owned by Tutoria.

Preferred tools:

- ZAP baseline/passive scan for broad web checks;
- Nuclei with a deliberately safe/non-destructive template allowlist;
- Schemathesis for OpenAPI/GraphQL property-based testing when a schema exists;
- ffuf only for controlled discovery/fuzzing with bounded concurrency/rate and a scoped wordlist.

Rules:

- never indiscriminately run all Nuclei templates;
- exclude destructive, exploit, brute-force, credential-stuffing, DoS, data-modifying, cloud-takeover, or out-of-band callbacks unless separately reviewed and explicitly authorized;
- do not fuzz payment providers, OAuth providers, email/SMS services, maps APIs, or other third-party endpoints through Tutoria;
- cap concurrency and requests;
- use test accounts/test data;
- do not create spam, unwanted emails/SMS, charges, bookings, refunds, or irreversible data;
- production mode is passive/baseline-only by default.

## 15. Threat-model abuse cases

Always consider business-logic abuse that scanners miss:

- user changes another user's booking/message/profile by swapping IDs;
- tutor edits price after a learner starts checkout;
- client submits a cheaper amount than displayed;
- double-submit creates duplicate booking/payment/refund;
- workshop capacity is oversold under race conditions;
- user obtains private upload URL/object path belonging to someone else;
- hidden/admin field is mass-assigned from the client;
- forged/replayed webhook changes booking/payment status;
- private draft or message leaks through cache/search/public route;
- signup/login/reset endpoints are spammed for enumeration or resource exhaustion;
- malicious URL in profile/content triggers SSRF via preview/image fetch;
- CI PR or dependency update steals deployment credentials.

Expand with repo-specific flows. See `references/tutoria-threat-model.md`.

## 16. Fix protocol

For each confirmed issue:

1. Reproduce with the smallest safe test.
2. Identify the authorization/data-flow root cause.
3. Patch minimally; do not refactor unrelated code.
4. Add a regression test at the nearest reliable layer.
5. Re-run the targeted scanner/test.
6. Run relevant neighboring tests/type checks.
7. Check that the fix does not broaden permissions or leak errors.
8. Record remaining assumptions/manual checks.

Do not silently add a SaaS security dependency or paid service. Explain the tradeoff first unless the repository already uses it and the requested change is within existing patterns.

## 17. Stop-the-line conditions

Return `BLOCK RELEASE` when any of these is confirmed and unmitigated:

- live credential/private key/service-role secret exposure;
- authentication bypass;
- RLS/access-control bypass exposing another user's private data;
- ordinary user can gain admin/moderator/server privileges;
- payment amount/status/refund/payout tampering;
- arbitrary code execution or critical injection on an exposed path;
- unrestricted private-file exposure;
- untrusted PR/workflow path can access production/deployment secrets;
- known Critical/High vulnerability on a reachable production path with no approved mitigation.

Do not bury these below cosmetic findings.

## 18. Release gates

For `PRE_RELEASE`, require or explicitly waive:

- 0 unresolved Critical findings;
- 0 unresolved High findings unless the user consciously accepts a documented mitigation/waiver;
- 0 known live secrets in repo/build artifacts;
- sensitive RLS negative tests pass;
- auth/IDOR tests pass for changed sensitive resources;
- payment/webhook tests pass if those paths changed;
- dependency/security scans have no release-blocking reachable findings;
- GitHub Actions have no known credential-exposure blocker;
- safe staging DAST completed or explicitly skipped with reason;
- manual-only deployment/security settings are listed for verification.

See `references/release-gates.md`.

## 19. Reporting format

Return the report in this order:

### Security verdict
`PASS`, `PASS WITH WARNINGS`, or `BLOCK RELEASE` plus one sentence explaining why.

### Must fix
Only Critical/High or stop-the-line items. For each:
- severity;
- affected component/file:line;
- exploit scenario/preconditions;
- impact;
- evidence/test;
- recommended minimal fix;
- verification status.

### Other findings
Medium/Low/Hardening items, deduplicated across scanners.

### Tests and tools
For each attempted check: `PASS`, `FAIL`, `SKIPPED`, or `MANUAL_VERIFY`, plus reason. Never imply a skipped scanner passed.

### License/tool decisions
List any external security repo introduced/recommended and classify it as `RUN_TOOL`, `ADD_DEPENDENCY`, `COPY_CODE`, or `REFERENCE_ONLY` with license status.

### Residual risk
What remains untested, inaccessible, environment-dependent, or dependent on manual dashboard configuration.

### Next action
Give the smallest ordered set of actions required to reach the next security gate.

## 20. Tool catalog usage

Read `references/security-repos.md` before recommending or integrating a new scanner/library. Prefer the smallest useful set:

**Baseline**
- Gitleaks or detect-secrets
- OSV-Scanner
- Trivy
- actionlint + zizmor if GitHub Actions exist
- Supabase/RLS tests if Supabase exists
- existing typecheck/tests

**Deep / pre-release**
- Semgrep external scan
- Syft/cdxgen + Grype
- Checkov if IaC exists
- ZAP baseline
- Schemathesis if API schema exists
- safe Nuclei subset

Do not run five overlapping tools merely to create noise. Use extra scanners to answer a specific uncertainty or independently confirm a high-risk result.

## 21. Deterministic helper script

`scripts/security-scan.sh` is intentionally conservative:

- it installs nothing;
- it runs only tools already present;
- it never targets a remote URL unless explicitly supplied;
- production remote mode is restricted;
- it stores reports outside the repository by default;
- it reports missing tools as skipped, not passed.

Use it as a baseline, then perform the business-logic/RLS/manual analysis this script cannot replace.
