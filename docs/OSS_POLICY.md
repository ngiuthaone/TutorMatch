# Tutoria Open-Source & External Source Policy

This is a conservative engineering/compliance policy, not legal advice.

## Non-negotiable gate

Before copying, adapting, vendoring, porting, installing, or closely rewriting external source material, the agent must:

1. identify the canonical source;
2. pin the exact tag, package version, or full commit SHA;
3. identify the exact files/directories/components to be used;
4. inspect the actual root and nested LICENSE/COPYING/NOTICE files and file-level SPDX headers at that pinned ref;
5. classify each incorporated path, not merely the repository as a whole;
6. separately verify fonts, images, icons, illustrations, datasets, examples, docs, trademarks, API keys, and customer/demo content;
7. record incorporated material in `oss/EXTERNAL_SOURCES.json`;
8. regenerate `THIRD_PARTY_NOTICES.md`;
9. run `python3 scripts/oss_guard.py ci` before completion.

## Automatic license policy

### PASS

May proceed automatically only when the exact material is clearly covered by:

- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- 0BSD

and there are no conflicting additional terms.

### REVIEW / no automatic incorporation

Do not automatically incorporate MPL, LGPL, GPL, AGPL, EPL, CDDL, SSPL, BSL/BUSL, Elastic, Commons Clause, PolyForm, source-available, custom, dual-license ambiguity, non-commercial, hosted-service, field-of-use, revenue, user-count, competitive-use, or similar restricted terms.

### BLOCKED

Do not incorporate unlicensed/all-rights-reserved source, proprietary/enterprise/premium source without a verified license, source of unclear ownership, or source whose intended commercial use is prohibited.

## Mixed-license repositories

A permissive root license does not clear restricted subdirectories. `enterprise`, `ee`, `premium`, `commercial`, `pro`, and similar areas are treated as restricted until their exact license is proven compatible.

## No license laundering

Do not evade a restriction by renaming, translating, AI-paraphrasing, porting line-by-line, reconstructing from diffs/bundles/minified source, or copying from mirrors.

When source is restricted, stop reading implementation details once classification is possible and independently implement from public documentation, standards, APIs, or observed behavior.

## UI/product references

Agents may learn general interaction patterns, information hierarchy, functional requirements, and public behavior. They must not automatically copy distinctive visual expression, brand identity, logos, proprietary illustrations/photos, unique marketing copy, or trademarked presentation.

## License status vs feature action

License classification describes the external material; it does not by itself cancel the requested feature. The orchestrator separately chooses the feature action:

- `INCORPORATE`: use the dependency/library when the exact version passes the gate and incorporation is preferable (example: Tiptap).
- `ADAPT`: selectively reuse exact permissive paths when adaptation is preferable to independent implementation and provenance is recorded.
- `STUDY_ONLY`: restricted or unnecessary source — study public behavior/docs/specifications, produce implementation-neutral feature requirements, and implement independently in Tutoria. No copying, paraphrasing, porting, or structural rewrites.
- `HARD_BLOCK`: stop the feature only for an independent blocker (legal, contractual, patent, security, privacy, or product).

A `BLOCKED` external source does not block the feature by default; it routes to `STUDY_ONLY`.

Exact-version discipline: gate the exact material actually incorporated. Inspecting a newer upstream version does not substitute for checking the incorporated version; report them separately (incorporated version vs latest-upstream context).

## Required Codex behavior

For any task involving an external repo/package/source:

- invoke the `repo-license-guard` / `license_guard` role first;
- emit an `OSS LICENSE GATE` result before implementation;
- if PASS, continue without asking the user again;
- if CONDITIONAL, use only paths proven permissive;
- if REVIEW/BLOCKED, choose a PASS alternative or independently implement the behavior;
- never silently reduce functionality;
- update provenance and notices before marking the task complete.

## Completion evidence

A task that incorporated external material is not complete unless:

- exact source and ref are recorded;
- exact scope is recorded;
- license evidence is recorded;
- required notices are preserved;
- restricted paths/assets were excluded;
- the guard passes;
- project tests pass.
