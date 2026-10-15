---
name: tutoria-browser-debugging
description: Browser-first debugging, functional audit, product-disposition, and QA for Tutoria. Reproduce UI behavior in a real browser, trace failures across DOM/events/state/API/auth/persistence/rendering, classify audited controls, turn undefined behavior into explicit product decisions, implement the smallest justified fix, and re-audit.
---

# Tutoria Browser Debugging

## Purpose

Use this skill whenever a Tutoria feature or UI component is reported as broken, unresponsive, inconsistent, only apparently functional, or undefined from a product perspective.

Core principle:

> **Do not assume the code is broken because the user reports that a UI feature does not work. Reproduce the exact interaction in a real browser first. Identify the first failing layer before modifying code.**

This skill covers the full loop:

`browser reproduction → root-cause diagnosis → functional audit → product disposition → implementation guidance → browser verification`

## Tooling

Prefer the browser tooling already configured in the OpenCode environment.

1. Playwright / Playwright MCP for deterministic browser automation.
2. browser-control for browser/session control when available.
3. Existing OpenCode browser QA / E2E skills when they provide concrete workflows.
4. Other installed browser integrations only when required.

Before installing anything, inspect the environment. Do not create duplicate browser stacks when an equivalent capability already exists.

## Operating Rules

### Rule 1 — Reproduce before editing

Never jump directly from a bug report to a code patch.

First:
- identify the exact route/page
- reproduce the user's action
- confirm whether the failure really occurs
- capture browser evidence
- determine the first failing layer

### Rule 2 — Trace the interaction chain

For UI problems, investigate:

`user action → DOM → event listener → handler → validation → state mutation → API request → backend response → persistence → render/update`

Stop at the first definitive failure, but verify enough context to rule out misleading downstream symptoms.

### Rule 3 — Distinguish environments

Always determine whether the issue is occurring in:
- static HTML prototype
- local Next.js development
- deployed Vercel environment
- backend/API environment
- authenticated or unauthenticated session
- specific browser state

Do not assume a prototype and native implementation share behavior.

### Rule 4 — Diagnose, then fix

Until the root cause is established, prefer read-only investigation.

Once identified:
- make the smallest appropriate fix
- preserve existing architecture and UX
- avoid rewriting unrelated components
- rerun the exact failing browser interaction
- run focused regression checks

### Rule 5 — Evidence over claims

Do not report “fixed” without evidence.

Use relevant evidence:
- browser action result
- DOM/state change
- console/page error
- network response
- screenshot
- persistence check
- browser test result

## Standard Investigation Workflow

### Phase A — Understand the report

Extract:
- exact user action
- expected behavior
- observed behavior
- route/page
- environment
- auth/session state if relevant
- whether deterministic/intermittent

### Phase B — Browser reproduction

Open the real page and perform the exact interaction.

Capture, where useful:
- screenshot before/after
- DOM/state before/after
- console errors/warnings
- page errors
- failed network requests
- request/response status

Prefer real hit-tested clicks over synthetic DOM calls when the issue concerns actual user interaction.

### Phase C — Root-cause trace

#### DOM
Check:
- element exists
- selector/data attribute
- disabled state
- visibility
- pointer-events
- overlay/occlusion
- wrong target

#### Event handling
Check:
- direct listener
- delegated listener
- bubbling
- selector match
- handler registration
- duplicate handlers
- initialization timing

#### JavaScript/runtime
Check:
- uncaught exceptions
- undefined values
- stale closures
- missing imports
- execution order
- hydration errors

#### State
Check:
- component/shared/client state
- context/store
- localStorage/sessionStorage
- derived state
- whether state changes but render does not

#### Network/API
Check:
- request created
- URL/method
- payload
- auth
- response status/body
- CORS
- timeout/retry

#### Persistence/backend
Check:
- mutation executed
- database mutation succeeded
- authorization
- validation
- transaction/constraint failures
- stale reads

#### Rendering/cache
Check:
- rerender
- SSR/CSR mismatch
- stale cache
- ISR/revalidation
- optimistic rollback
- key/list problems

## Functional Audit Mode

When asked to audit a page rather than fix one known issue:

1. Inventory meaningful interactive elements.
2. Test buttons, tabs, links, forms, menus, dialogs, add/remove controls, navigation, save/publish actions.
3. Identify controls that:
   - do nothing
   - show the wrong UI
   - lose state
   - fail silently
   - throw errors
   - use mock/demo behavior
   - route incorrectly
4. Re-test ambiguous findings with isolated probes.
5. Do not modify code during audit mode unless explicitly requested.

### Audit disposition buckets

Every audited control must be classified into exactly one bucket:

1. **IMPLEMENT** — required production behavior is understood and approved.
2. **REMOVE** — prototype control should not exist in the product.
3. **EMPTY STATE / HELP** — intentionally limited behavior needs an explicit user-facing explanation.
4. **DISABLED BY DESIGN** — disabled state is intentional.
5. **WORKING** — verified in browser; no implementation required.
6. **PRODUCT DECISION** — behavior is undefined and must be decided before implementation.

Important:

> A “dead control” is an audit observation, not automatically a bug.

Do not invent product behavior merely because a prototype button exists.

### Audit coverage rules

- Preserve verified working functionality as WORKING.
- Re-audit ambiguous controls before classifying them.
- Count dead/no-op controls only as observations; after disposition they may become IMPLEMENT, REMOVE, EMPTY STATE / HELP, DISABLED BY DESIGN, or PRODUCT DECISION.
- The final acceptance gate is **zero unintended dead controls for the audited scope**. Deliberately removed, disabled, or explicitly documented empty-state controls are acceptable.

## Product Decision Layer

Use this layer after functional audit and before implementation.

### When to create a product decision

Create a PRODUCT DECISION whenever behavior is undefined, business rules are missing, multiple reasonable UX interpretations exist, or data/API implications are unclear.

Typical examples:
- bulk uploader semantics
- coupon scope and redemption rules
- pricing persistence
- referral program behavior
- quiz/assignment/practice data models
- section goal semantics
- upload architecture
- rich-text format and supported toolbar actions
- test-video feedback behavior
- creator settings scope

### Product decision template

For each PRODUCT DECISION, define:

- **Product behavior** — what the feature actually does.
- **UX behavior** — user flow and states.
- **Data/model implications** — tables, enums, fields, relationships.
- **API/backend implications** — routes, validation, permissions, persistence.
- **Persistence expectations** — autosave, explicit save, reload behavior.
- **V1 scope** — what is included now.
- **Out of scope** — what is explicitly deferred.
- **Reuse** — existing repo capability to use.
- **Dependencies/blockers** — what must exist first.
- **Priority** — P0/P1/P2.

### Product decision rule

> **Nothing invented.**

If the existing audit or repo does not support a product behavior, do not silently infer one. Record the gap as a decision to be made.

## Tutoria Implementation Guardrails

When converting prototype behavior into the native Tutoria product:

- Reuse existing native components, routes, state, APIs, services, database models, and UI primitives when they already solve the requirement.
- Upgrade the native `curriculum-page.tsx` implementation; do not duplicate the curriculum system from prototype HTML/JS.
- Prototype JavaScript is evidence/specification, not production architecture to migrate wholesale.
- `messaging-api` is not automatically the course-creator messaging system; verify domain ownership.
- Workshop booking APIs are not automatically curriculum APIs.
- Prefer existing shell/navigation/autosave/SaveStatus and course/section/lesson CRUD/reorder/publish infrastructure where applicable.
- Search the repo before adding new models/routes/components.
- If a database table already exists but API routes are missing, prefer exposing the existing model over creating a parallel table.

### Known audit-derived repo-gap pattern

The course-creator audit found examples of this pattern:

**Already existing / reusable:**
- native shell and NAV_PAGES
- autosave and SaveStatus
- course/section/lesson CRUD
- reorder and publish
- signed URLs
- `course_coupons` and `course_captions` tables with RLS
- existing UI primitives
- landing/messages/learners parity columns

**Observed gaps:**
- quiz-questions migration disabled
- lesson enum missing assignment/practice-test coverage
- authoritative price columns missing
- modal/toast infrastructure missing
- upload POST path missing while signed GETs existed
- PATCH accepting only title/slug/description/cover

These are audit findings, not permanent assumptions. Verify current repo state before implementation.

## Recommended Post-Audit Implementation Order

When multiple product gaps exist:

1. **Product decisions** for all undefined behavior.
2. **F1 save/navigation backbone** and shared state/persistence behavior.
3. **F2 + F4 bindings/checklist engine** where applicable.
4. **F5 upload architecture**.
5. **F3 curriculum upgrade + F7 lesson models**.
6. Parallelize independent features where dependencies allow.
7. **F9 coupons** only after coupon rules are defined.
8. **F11 polish** and cleanup.
9. Run the skill again as a **zero-unintended-dead-controls gate** before sign-off.

Do not start a downstream feature when an upstream PRODUCT DECISION blocks its correct implementation.

## Tutoria Critical Browser Flows

### Learner booking

`Discover → offering → session → booking → payment → return → confirmation`

Check price snapshot, capacity, booking creation, payment handoff, return handling, final status.

### Creator workshop

`Create → details → media → sessions → capacity → pricing → publish → public page`

Verify creator data maps correctly to the published offering.

### Course creator curriculum

`Curriculum → Section → Curriculum Item → Editor → Save → reload`

Supported item types:
- Lecture
- Quiz
- Practice Test
- Assignment

For each item: create, select/open, edit, save, relevant tabs, delete, navigation away/back, persistence.

### Authentication

Test signed-out and relevant signed-in roles. Distinguish UI visibility from authorization.

## Next.js-Specific Checks

When relevant, test:
- hydration errors
- Server/Client Component boundaries
- browser-only APIs during SSR
- route transitions
- loading/error boundaries
- stale server data
- cache/revalidation
- client state loss on navigation

## Production-vs-Local Mode

When local works but production fails, compare:
- environment variables
- API base URLs
- Vercel rewrites/proxying
- CORS
- cookies/session
- auth redirects
- server/client boundaries
- caching/revalidation
- backend deployment version
- database/schema version
- request payloads/responses

## Persistence Verification

For create/update/delete/save features:
1. perform action
2. verify immediate UI
3. inspect request if applicable
4. navigate away
5. return
6. reload if safe
7. verify persisted state

## Payment / Booking Edge Cases

When relevant, test:
- final seat
- capacity full
- cancellation
- payment failure/cancel
- interrupted return
- expired session
- duplicate submission

## Visual Regression

When visual behavior is the complaint or verification is requested:
- capture screenshots at relevant viewport sizes
- compare spacing, typography, controls, borders, hierarchy
- preserve existing visual language unless visual change is explicitly requested

## Final Reporting Format

### Reproduction
- route
- environment
- auth state
- exact action
- reproduced/not reproduced

### Root cause
State the first confirmed failing layer.

### Evidence
Include concise browser evidence.

### Disposition
For audits, report the classification of each relevant control.

### Product decisions
List unresolved PRODUCT DECISION items separately. Never silently invent behavior.

### Change
List actual files/functions modified.

### Verification
Report the exact browser scenario rerun after the change and the result.

### Remaining limitations
Explicitly state what was not tested or remains unresolved.

## Default User Command Interpretation

- “this button doesn't work” → reproduce and trace before editing
- “fix this component” → reproduce, diagnose, then fix
- “audit this page” → functional audit, no code changes unless requested
- “test this feature” → browser-test the complete meaningful workflow
- “works locally but not production” → compare environments and network/auth/configuration
- “make sure this works” → implement/repair, then browser-verify
- “why does this do nothing?” → diagnosis only until root cause is established
- “what should this button do?” → PRODUCT DECISION analysis; use existing product/repo evidence and relevant external references if requested

## Safety Against Over-Fixing

Before changing code, answer:
1. Did the browser reproduce the issue?
2. Which exact layer failed?
3. What evidence proves that layer failed?
4. Is there already an implementation elsewhere in the repo?
5. Is the behavior actually a product decision rather than a technical bug?
6. What is the smallest change that addresses the confirmed cause?

Never rewrite a working feature merely because the user's reproduction environment differs from the environment where the feature was verified.
