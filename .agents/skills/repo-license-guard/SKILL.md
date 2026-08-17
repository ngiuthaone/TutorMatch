---
name: repo-license-guard
description: Use whenever a task involves using, copying, adapting, cloning, porting, installing, studying, or integrating code, UI, assets, data, snippets, packages, or architecture from an external repository. Enforce a conservative license/IP gate before external material enters the project. Automatically proceed only with clearly permissive material; block or replace ambiguous, copyleft, source-available, enterprise, proprietary, or unlicensed material unless the user explicitly authorizes legal review.
---

# Repo License Guard

## Purpose

Minimize legal and IP risk when using external repositories in a commercial proprietary project.

This is a conservative engineering policy, not legal advice and not a guarantee of zero legal exposure. When licensing or ownership is unclear, choose the safer implementation path instead of guessing.

## Core rule

**Do not copy, adapt, install, vendor, translate, port, or closely rewrite external material until its exact license scope has been verified for the exact version and files being used.**

If the source does not pass the gate below, do not use its code or protected assets. Prefer an independently implemented alternative based on public product behavior, standards, APIs, or documentation.

## When this skill must run

Run this workflow before doing any of the following:

- cloning or copying code from GitHub, GitLab, Bitbucket, npm, PyPI, crates.io, or another external source;
- asking to "use this repo", "reference this repo", "copy this implementation", "port this", "borrow this component", or similar;
- installing a new third-party package or vendoring its source;
- reproducing an external UI, design system, editor, booking flow, marketplace feature, algorithm, schema, or component from source code;
- copying images, icons, fonts, illustrations, datasets, demo content, documentation text, tests, examples, or templates from a repository;
- using AI to rewrite or paraphrase external source code.

## Tutoria project enforcement

For this repository, the policy and provenance ledger are part of the gate, not optional documentation.

Before external-source work:

1. Read `docs/OSS_POLICY.md` and `oss/REPO_POLICY.json`.
2. Treat registry entries only as dated hints; verify the exact pinned ref and exact paths independently.
3. When useful, run `python3 scripts/oss_guard.py registry --source <canonical-source>` to inspect the hint registry.
4. Emit an `OSS LICENSE GATE` result with status `PASS`, `CONDITIONAL`, `REVIEW`, `BLOCKED`, or `STUDY_ONLY`.
5. For `PASS`/`CONDITIONAL` material actually incorporated, add the exact source/ref/scope/evidence to `oss/EXTERNAL_SOURCES.json`.
6. Run `python3 scripts/oss_guard.py generate-notices` and then `python3 scripts/oss_guard.py ci`.
7. Keep restricted paths out even when another part of the same repository is permissive.

The ledger records what Tutoria actually incorporates. Do not pre-populate it merely because a repository appears in `oss/REPO_POLICY.json`.

## Mandatory preflight

Before implementation, identify:

1. Repository/package name and canonical source URL.
2. Exact commit SHA, tag, or package version being used.
3. Exact files/directories/components intended for use.
4. Top-level and nested license files, including names such as:
   - `LICENSE*`
   - `COPYING*`
   - `NOTICE*`
   - `COPYRIGHT*`
5. License metadata in package manifests.
6. File-level SPDX identifiers and copyright/license headers.
7. Any `enterprise`, `ee`, `premium`, `commercial`, `pro`, `licensed`, or similarly restricted directories.
8. Whether assets, fonts, icons, media, datasets, examples, or documentation have separate terms.

Do not rely only on a GitHub/GitLab sidebar license badge or a README summary. Check the actual license text and the scope applying to the exact files.

If nested or file-level terms conflict with the repository root, the more specific terms control the gate for those files.

## License gate

### PASS — may proceed automatically

Automatically allow source code only when the exact material is clearly covered by one of these licenses and there are no conflicting additional terms:

- `MIT`
- `Apache-2.0`
- `BSD-2-Clause`
- `BSD-3-Clause`
- `ISC`
- `0BSD`

Proceed only after recording and satisfying the attribution/notice obligations below.

### CONDITIONAL — only proven permissive paths may proceed

Use when a mixed-license source contains exact paths that independently pass while other paths are restricted. Incorporate only the verified permissive paths, record every exclusion, and never infer permission for enterprise, premium, asset, or separately licensed areas.

### REVIEW — do not incorporate automatically

Treat the following as **review required** even when the license may permit some commercial/proprietary uses under specific conditions:

- `MPL-2.0`
- LGPL family
- GPL family
- AGPL family
- EPL family
- CDDL family
- SSPL
- BSL / Business Source License
- Elastic License
- Commons Clause
- PolyForm licenses
- source-available licenses
- dual or multi-license arrangements where the applicable choice is unclear
- licenses containing non-commercial, field-of-use, revenue, user-count, hosted-service, SaaS, redistribution, or competitive-use restrictions
- custom licenses
- licenses with exceptions or additional terms that have not been reviewed

Do not use REVIEW material unless the user explicitly chooses to proceed after obtaining appropriate legal/license review. If a permissive alternative exists, choose the permissive alternative instead of interrupting the task.

### BLOCKED — do not use

Block incorporation when:

- no license can be found;
- the material says "all rights reserved" without a separate applicable license grant;
- it is proprietary, enterprise-only, premium-only, or commercially licensed and the project has no verified license for it;
- the license prohibits the intended commercial use;
- ownership or license scope cannot be determined;
- the repository contains copied third-party material whose permission cannot be established.

A public repository is **not** automatically permission to reuse its contents.

### STUDY_ONLY — behavior and public documentation only

Use when public behavior, APIs, standards, or documentation can inform an independent implementation but implementation source must not be copied, ported, closely paraphrased, or reconstructed.

## No license laundering

Never try to bypass a restriction by:

- changing variable or function names;
- translating code to another programming language;
- asking AI to paraphrase or "rewrite from scratch" while following blocked source line-by-line;
- copying only "a few lines" based on an assumed safe line-count threshold;
- reconstructing a blocked implementation from patches, diffs, generated bundles, minified files, screenshots of source, or mirrors.

If source is REVIEW or BLOCKED, stop reading implementation details once enough information has been gathered to classify the license. Reimplement the required behavior from public documentation, standards, public APIs, observed product behavior, or an independently designed specification.

## Source status vs feature action

License classification describes the external material, not the requested Tutoria feature. Do not equate a `BLOCKED` external source with a `BLOCKED` Tutoria feature by default.

- `INCORPORATE` — use the external project as an actual dependency/library when the exact material/version passes the gate, incorporation is technically preferable, and required provenance/notices are recorded (example: Tiptap as a mature rich-text engine).
- `ADAPT` — selectively adapt a small amount of external implementation when the exact material passes the gate, adaptation is preferable to independent implementation, and attribution/provenance requirements are satisfied. Direct reuse stays optional, never the default goal.
- `STUDY_ONLY` — use the external project only to understand the useful feature (user problem, workflow, states, UX/product/architecture concepts) when incorporation is REVIEW/BLOCKED, unnecessary, or the user wants the idea rather than the code. The output is a feature specification, not implementation-transplant notes.
- `HARD_BLOCK` — stop the entire feature only for a separate, independent blocker (legal/contractual, patent, security, privacy, or product). Never treat the source classification alone as a `HARD_BLOCK`.

### STUDY_ONLY continuation

When direct reuse is prohibited (REVIEW/BLOCKED material, or the user wants the concept only):

1. Stop inspecting restricted implementation details once the restriction is established.
2. Mark the material `STUDY_ONLY`.
3. Do not copy, translate, paraphrase, port, or structurally reproduce the implementation.
4. Switch research to safe public sources where available: product documentation, READMEs, public API documentation, specifications, public demos, screenshots, observable behavior, and public descriptions of workflows.
5. Extract only feature-level requirements: user problem, workflow, inputs/outputs, states, edge cases, constraints, and useful product/UX principles.
6. Hand those requirements back to the Tutoria implementation workflow.
7. Implement independently using Tutoria's own code and architecture.
8. Record `STUDY_ONLY` provenance when appropriate (without copying implementation details into the record).

Restricted implementation must never be "rewritten by AI" as a way to bypass its license (see "No license laundering" above).

## Mixed-license repositories

Assume a monorepo may contain multiple licenses.

For every reused file, determine the license that actually covers that file. Do not treat a permissive root license as permission for directories or files marked with separate enterprise, commercial, source-available, copyleft, or third-party terms.

If only part of a repository passes, use only the passing paths.

## Required compliance for PASS material

When PASS material is incorporated:

1. Preserve existing copyright and license headers in copied source files.
2. Preserve the required license text with distributed copies where the license requires it.
3. For Apache-2.0 material, preserve applicable `NOTICE` information when a NOTICE file exists and comply with its notice requirements.
4. Do not imply the original authors endorse the project.
5. Do not use upstream names, logos, or trademarks as project branding unless separately permitted.
6. Record the use in `THIRD_PARTY_NOTICES.md` (create it if needed).
7. Record enough information for a future audit:
   - project/package name;
   - canonical source URL;
   - exact version/tag/commit;
   - SPDX license identifier;
   - files/components used;
   - whether code was copied, modified, vendored, or used as a dependency;
   - required notices/attributions;
   - date checked.
8. If modifications to copied files are substantial, clearly identify that the project modified them when appropriate.

## Assets, fonts, data, and documentation are separate

A source-code license does not automatically prove that every repository asset is reusable.

Before using any of the following, verify its own license/provenance:

- logos and trademarks;
- product names and brand assets;
- photographs and videos;
- illustrations;
- icon packs;
- fonts and font files;
- datasets;
- music/audio;
- screenshots;
- documentation prose;
- example/customer content;
- third-party API keys, credentials, tokens, or secrets.

If separate permission cannot be established, replace the asset with an original or clearly licensed alternative.

Never copy secrets or credentials even if they appear in a public repository.

## UI and product-design rule

For external product UIs:

- It is acceptable to learn general patterns, interaction ideas, information hierarchy, and functional requirements.
- Do not automatically create a pixel-for-pixel clone of distinctive visual expression.
- Do not copy logos, branding, proprietary illustrations, photographs, marketing copy, or unique textual content.
- Re-express the solution in the current project's own design system, spacing, typography, components, copy, and brand language.
- If the user explicitly asks for an exact clone, apply this license/IP gate first and avoid protected or separately licensed material.

## Dependencies

Before adding a package dependency:

1. Pin or record the exact version being evaluated.
2. Check the package's actual license and repository, not just its name.
3. Check whether the package includes bundled/vendored code under other licenses.
4. Prefer PASS-licensed alternatives when functionally comparable.
5. Add the dependency and required notices to the third-party record.

Transitive dependencies should be checked by the project's normal dependency/license audit tooling when available. Do not claim the dependency tree is legally cleared if it has not been audited.

## Trademarks, patents, and other rights

Passing an open-source copyright-license check does not prove clearance of trademarks, patents, privacy/publicity rights, database rights, export restrictions, or contractual restrictions.

Do not claim "legally risk-free", "fully cleared", or "zero legal risk". If the task materially depends on one of these rights, flag it for review and choose a lower-risk alternative when possible.

## Preferred behavior when a repo fails the gate

Do not stall if an equivalent safe route exists.

Use this order:

1. Find a functionally equivalent PASS-licensed library or repository.
2. Use an existing dependency already approved in the project.
3. Implement the feature independently from public specifications/docs/behavior.
4. Only if none of the above works, report that legal/license review is required.

Never downgrade functionality silently merely to avoid explaining the blocked source; state what alternative was used.

## Required status output

Before incorporating a new external repository or package, produce a concise internal/project-facing gate result in this shape:

```text
OSS LICENSE GATE
Status: PASS | CONDITIONAL | REVIEW | BLOCKED | STUDY_ONLY
Source: <canonical repo/package>
Version: <tag/commit/version>
License: <SPDX identifier or exact custom license name>
Scope checked: <paths/components>
Planned use: <dependency / copied+modified / reference-only>
Feature action: <INCORPORATE / ADAPT / STUDY_ONLY / HARD_BLOCK>
Required actions: <notices/attribution/etc.>
Excluded material: <enterprise/assets/fonts/etc. or none>
Evidence: <license files / headers / manifest inspected>
```

If `Status: PASS`, continue the implementation without asking for permission.

If `Status: CONDITIONAL`, incorporate only the exact paths proven permissive. If `Status: REVIEW`, `BLOCKED`, or `STUDY_ONLY`, do not incorporate implementation material. Automatically use a PASS alternative or an independent public-docs/API/behavior implementation when reasonably available.

Version discipline: the exact dependency/material actually incorporated into Tutoria is what must be gated. Checking a newer upstream version does not substitute for checking the incorporated version. When both were inspected, report them separately (for example: `Incorporated version: 3.27.3 — license/provenance PASS`; `Latest upstream inspected: 3.30.0 — context only, no upgrade performed`).

## Completion checklist

Before finishing a task that used external material, verify:

- [ ] Exact source and version recorded.
- [ ] Exact license scope checked.
- [ ] Every incorporated path is PASS.
- [ ] No enterprise/premium/restricted directory was copied.
- [ ] No blocked source was paraphrased or ported.
- [ ] Required license/copyright/NOTICE material preserved.
- [ ] `THIRD_PARTY_NOTICES.md` updated.
- [ ] Assets/fonts/data/documentation checked separately.
- [ ] No trademarks, logos, secrets, or credentials copied without permission.
- [ ] Project tests still pass.
- [ ] Final response names the external dependencies/material actually incorporated and their licenses.

## Default interpretation

When uncertain, choose **BLOCKED**, not PASS.

Never automatically use `/enterprise`, `/ee`, Premium, proprietary, BSL/BUSL, AGPL/GPL, SSPL, or unlicensed code. Preserve MIT/BSD copyright notices and Apache LICENSE/NOTICE obligations, and never copy logos, trademarks, secrets, customer data, or third-party assets merely because nearby code is open source.

The goal is not to find a loophole that permits copying. The goal is to build the requested feature while keeping external-code provenance clear, auditable, and conservatively licensed for a commercial proprietary project.
