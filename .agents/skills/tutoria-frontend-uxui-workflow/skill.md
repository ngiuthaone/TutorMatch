# Tutoria Frontend UX/UI Workflow

## Purpose

Use this skill for frontend changes in the Tutoria repository.

The production web application is the Next.js/React application under `discover/`. Standalone HTML is a visual prototyping/reference tool only. It must never become a second production frontend.

The workflow separates:
1. understanding the existing production UI,
2. visual experimentation,
3. approved visual design,
4. native Next.js implementation,
5. verification.

## Core rule

**Next.js/React is the canonical production UI. HTML is a design sandbox.**

Never replace production React/Next.js with standalone HTML merely because an HTML prototype was created.

## When this skill applies

Apply this skill whenever the user requests a frontend/UI/UX change, including:
- redesigning a page or feature
- changing layout, cards, navigation, typography, spacing, colors, hierarchy, or responsive behavior
- changing forms, modals, sheets, tabs, dashboards, booking UI, or other interactions
- making an existing feature look more premium, modern, compact, polished, etc.
- converting a visual reference into production UI
- changing a production page based on a screenshot or HTML reference

For very small changes (for example a single text label, one spacing value, or an obvious bug fix), do not create an HTML prototype unless it materially improves visual review.

## Phase 1 — Inspect before changing

Before editing production code:
- identify the actual Next.js route
- trace the rendered component tree
- inspect related components and shared design-system primitives
- identify API/data dependencies
- identify auth/session requirements
- identify existing state and interaction logic
- identify responsive behavior
- identify whether the current UI is native React or contains an iframe/static HTML bridge
- check for existing UX references before creating another one

Do not infer architecture from filenames alone.

For feature changes, preserve existing business logic, API contracts, authentication, booking/payment behavior, and server-authoritative rules unless the user explicitly asks to change them.

## Phase 2 — Decide whether to prototype visually

For substantial visual changes, create or update a standalone reference such as:

`discover/public/<feature>-uxui-reference.html`

The reference should:
- reproduce the relevant current or proposed UI
- be independently viewable in a browser
- use mock/static data where needed
- include realistic states and responsive layouts
- make interactions understandable with lightweight JavaScript
- contain no production secrets
- remain clearly identified as a prototype/reference

Do not modify production functionality while creating the reference.

For a current-UI export, reproduce the existing UI faithfully before redesigning it.

For a redesign, keep the prototype focused on visual/interaction decisions rather than implementing real backend behavior.

## Phase 3 — Visual iteration

The user may take the HTML reference to ChatGPT or another design tool for visual iteration.

Treat the approved HTML/reference as a **visual specification**, not as an instruction to copy its implementation literally.

The final implementation must use the existing Tutoria:
- Next.js App Router
- React
- TypeScript
- Tailwind/design tokens
- existing reusable components
- existing API/data clients
- existing auth/session handling

Do not introduce duplicated business logic just to match the prototype.

## Phase 4 — Implement natively in Next.js

Once the visual direction is approved:
- implement the design in the existing production route
- reuse existing components where appropriate
- create feature-specific components when the current component is too monolithic
- preserve API contracts and business rules
- preserve accessibility
- preserve loading, empty, error, and disabled states
- preserve desktop and mobile/responsive behavior
- remove iframe/static-HTML production dependencies when the native replacement is complete
- do not delete the reference HTML until the user/project no longer needs it

For large features, prefer a structure such as:

`<feature>/page.tsx`
`<feature>/components/*`
`<feature>/lib/*`

Avoid creating one giant client component when the feature naturally separates into independent UI sections.

## Phase 5 — Verify

After implementation:
1. run TypeScript/typecheck
2. run lint
3. run relevant tests
4. run the production build when appropriate
5. visually inspect the affected route
6. test important interactions
7. test responsive/mobile layout
8. verify no existing feature was broken
9. verify that API/auth/business behavior is unchanged unless intentionally modified

For significant UI changes, use the browser QA workflow when available.

A frontend change is not complete merely because the code compiles.

## HTML reference rules

### Do
- use HTML to make visual iteration fast
- create a faithful snapshot of current production UI
- use realistic mock data
- keep prototypes easy to open and inspect
- map prototype sections back to production components when useful

### Do not
- make HTML an alternative production application
- add real authentication to the prototype
- add real payment processing
- duplicate backend business logic
- replace Next.js routes with HTML
- blindly convert every HTML file in the repository
- delete existing production components because a prototype exists
- assume an HTML prototype's implementation is architecturally suitable for production

## Special rule for existing static/iframe UI

If the current production feature uses:

Next.js -> iframe -> static HTML -> postMessage -> backend

and the user wants to improve that feature, prefer the long-term migration toward:

Next.js -> native React components -> existing API/backend

Do not perform the migration blindly as part of a visual-only request. First reproduce/validate the desired UI, then replace the production surface incrementally and verify behavior.

## Mobile readiness

Tutoria will eventually have a React Native/Expo client.

Therefore:
- keep backend/API contracts platform-neutral
- avoid putting business logic inside web-only UI components
- reuse domain types, validation, API clients, and business rules where genuinely shareable
- do not design the web implementation in a way that unnecessarily couples business logic to browser-only APIs

Do not try to make Next.js components directly reusable as React Native components. Mobile UI should be rebuilt with React Native primitives while sharing appropriate domain/API logic.

## Agent reporting requirements

At the end of a frontend task, report:
- what was inspected
- what changed
- production routes/components affected
- whether an HTML reference was created or updated
- whether production UI remains native Next.js/React
- tests/typecheck/lint/build results
- browser verification results when performed
- any known limitations
- exact files changed
- commit SHA if a commit was created

Do not report vague percentages such as "90% complete" without concrete evidence.

## Default decision tree

```
Frontend request
      |
      v
Inspect current production UI
      |
      +-- tiny/local change --> implement directly in Next.js
      |
      +-- substantial visual change
      |          |
      |          v
      |    create/update HTML reference
      |          |
      |          v
      |    visual iteration / approval
      |          |
      |          v
      |    implement natively in Next.js
      |
      v
Verify behavior + visual result
      |
      v
Report concrete evidence
```

## Success criterion

The desired end state is:

**one canonical production web UI (Next.js/React), optionally supported by standalone HTML visual references for fast design iteration.**
