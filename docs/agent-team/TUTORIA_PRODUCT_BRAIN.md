# Tutoria Product Brain

This is a compact shared context file for agent work. It is not a substitute for reading the relevant code or the latest product requirements when a task depends on them.

**Live audit:** revalidated against commit `31045709806a2754b97dc0dbdf58708e4fb9f18f` and the dirty working tree on **2026-08-12**. The live checkout is authoritative; this file must be updated when code, persistence, or deployment boundaries change.

## Product

Tutoria is a learning marketplace and community product. It connects learners/parents with tutors and broader learning formats such as workshops, events, classes, courses, communities, discussions, and articles.

Primary product idea: help people evaluate **fit, trust, teaching style, availability, format, location, and price** rather than treating tutors as commodity listings.

Initial market context is Vietnam, with Hanoi frequently used in product examples.

## Product principles

1. Trust before transaction.
2. Privacy by default.
3. Fit over volume.
4. Tutor identity and teaching style matter.
5. Progressive disclosure.
6. Demo/prototype capability is not production capability.

## Visual system

- Charcoal / gray, restrained palette.
- Minimal and premium; avoid visual noise.
- No green as a primary brand color.
- Clear hierarchy and concise copy.
- Mobile responsiveness is mandatory, not a later polish step.
- Category/type labels should remain clear where mixed content appears.
- Learn from other products at the pattern/interaction level; express the result as Tutoria rather than cloning distinctive external UI.

## Repository mental model

### Root TutorMatch SPA
Legacy/local demo using React 19, esbuild, a Node static server, browser storage, and an `/api/state` route. The tracked `data/state.json` is currently deleted in the live worktree, so this surface is neither a durable nor deployable production source of truth.

### `backend/`
Production-oriented Fastify 5 / Supabase foundation. It now includes authenticated profile and tutor-CV flows, public tutor listing/detail APIs, rate limits, strict CORS/environment parsing, and a new course/event marketplace listing API backed by `marketplace_listings`. Treat server-side authorization, ownership, runtime validation, and RLS as authoritative.

### `discover/`
Broader Next.js 16.3 / React 19.2 Tutoria experience and preferred production web-shell direction. Supabase auth callback/reset/session configuration and API-facing tutor/marketplace bridges now exist, but many routes still use localStorage, static HTML/iframe bridges, seeded data, or Next route handlers that persist JSON on the local filesystem. Those paths remain prototypes even when they perform authentication and input sanitization.

## Narrow production-MVP boundary

The safest current production scope is centered on:
- Supabase auth/session flows
- trusted backend role retrieval
- tutor CV draft/preview/publish/edit/unpublish
- public tutor discovery/list/detail
- tutor filters/search
- a backend `course`/`event` marketplace listing foundation, pending authorization and rendering hardening before live publication
- safe public/private field separation
- contact-pattern protection in public profile text
- learner-side save/bookmark when backed by production persistence
- basic reporting entry point
- analytics needed for funnel measurement

Do not silently promote these prototype/future areas into production claims:
- booking/scheduling
- payments/refunds/payouts
- direct messaging/inquiries
- reviews/ratings
- tutor verification/credentials
- public UGC/community moderation
- end-to-end course/event production operation: the backend listing table/API now exists, but creator/browse/detail flows are mixed between the backend bridge, localStorage, static fixtures, and file-backed Next route handlers

## Current persistence map

- `profiles`, tutor-CV relations, and tutor publication state: Supabase migrations `0001` and `0002`, with RLS and security-definer RPCs.
- Course/event listing envelope: Supabase migration `0003` plus `backend/src/routes/marketplace.ts`. The Fastify route checks for a tutor role and executes through the caller JWT, but current table RLS only checks `creator_id = auth.uid()`. An authenticated Supabase client can therefore bypass the Fastify tutor gate and write directly. Treat live publication as blocked until direct writes are removed or RLS also enforces a trusted tutor role.
- Role trust boundary: migration `0001` currently derives `profiles.role` from client-editable signup metadata. Do not treat `role = tutor` as trusted until tutor enablement moves to a server/admin-controlled workflow.
- Static creator iframe bridge: `discover/public/marketplace-api.js` calls the backend in configured live mode and does not itself store access tokens.
- Discover `/api/events` and `/api/tutors`: still write `discover/data/*.json` through local filesystem APIs. The tutor route currently returns the raw store to unauthenticated callers and accepts client-selected publication state without a trusted tutor/moderator check. These routes are not safe or durable production APIs.
- Courses, events, discussions, articles, saves, follows, messages, and several profile variants still contain localStorage or fixture-driven behavior. Treat these as demo/prototype capability unless a task proves a production path end to end.
- Marketplace payloads are stored as an open object and some static catalog pages interpolate their fields through `innerHTML`; this is a stored-XSS release blocker until payload schemas and output-context-safe rendering are enforced.

## Production data rules

Never make production business truth depend on:
- `localStorage`
- `data/state.json`
- `/api/state`
- `discover/data/*.json`
- seeded demo accounts
- simulated payments
- fixture fallback after live API failure

Private/public rules:
- Never expose auth user IDs through public tutor APIs.
- Never expose email, phone, exact private address, service-role secrets, private version/audit state, or hidden ownership fields.
- Client metadata is not a trusted authorization source.
- Student/learner users must not be able to mutate tutor-owned records.

## High-risk feature prerequisites

### Messaging/inquiries
Needs participant-scoped persistence/RLS, state machine, contact redaction, spam/abuse controls, blocking/reporting, retention rules, and moderation/support operations.

### Booking
Needs authoritative availability, concurrency/double-book protection, time-zone rules, cancellation/reschedule states, and auditable state transitions.
Capacity + Concurrency policy is FROZEN FOR PERSISTENCE (`docs/agent-team/DECISIONS-CAPACITY-CONCURRENCY.md`): `requested`+`confirmed` hard-reserve capacity; capacity unit is participant quantity; one Booking per learner per Session; `minimumMet` counts confirmed only; Payment never mutates capacity.

### Payments
Needs provider-hosted collection, signed replay-safe idempotent webhooks, server-side ledger/reconciliation, refunds/disputes/no-shows, support operations, and legal/finance/security approval.

### Reviews
Only after a real completed engagement can be authoritatively established; requires moderation/edit/delete rules.

### Verification/credentials
Do not claim verification or collect sensitive credential material until a separate privacy/security/legal/retention design is approved and implemented.

## UX quality expectations

For changed user-facing flows, agents should think through:
- desktop and mobile layouts
- loading / empty / error states
- keyboard/focus behavior
- touch targets
- locale-aware VND, dates, times, and Vietnamese/English behavior where relevant
- truthful inventory/ratings/availability
- Safari/iOS Safari as meaningful target browsers, not Chrome-only assumptions

## Engineering truthfulness

Use evidence-based status:
- PASS — implemented and relevant checks passed
- PARTIAL — useful implementation but integration/operation remains
- UNVERIFIED — required validation could not run
- BLOCKED — dependency, safety, licensing, or missing production system prevents safe completion

Never describe a prototype as production-ready solely because its UI is complete.
