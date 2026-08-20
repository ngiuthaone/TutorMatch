# QA Contract — Workshop Booking Flow V1

**Mode:** PRE-FLIGHT — defines acceptance criteria for post-implementation verification.
**Date:** 2026-08-19
**Branch:** `codex/core-1to1-integrated`
**Head:** 7f5dd4f
**Scope:** Workshop detail page + session picker + booking creation + auth gate + host bookings view — first production vertical slice for Non-Tutor Product Surfaces V1.

## Authority

Derived in this order (see AGENTS.md orchestration policy):
1. Explicit user instruction: "Turn the shared booking engine into a real user-facing Workshop booking experience."
2. `docs/workshop-detail-v1-ux-contract.md` — frozen UX contract for Workshop Detail V1 (session picker, participant stepper, price summary, booking CTA, mobile layout, server authority).
3. Verified repository facts: `discover/src/lib/booking-api.ts` (client types + API calls), `backend/src/routes/booking.ts` (endpoint contracts), `discover/src/lib/bookable-session-projection.ts` (session filtering), `backend/src/services/marketplace-service.ts` (listing schema), `discover/src/lib/auth/gate.ts` (auth redirect pattern).
4. Shared Booking Engine Phase 1 baselined behavior.

**Not consulted as requirements:** prototype HTML files, external workshop products. These may inform design direction but do not create acceptance criteria.

## Scope

- Workshop detail page loading from server data (marketplace listing + bookable sessions).
- Session picker: fetch, filter, present, and select bookable sessions.
- Participant quantity stepper with server-derived max.
- Price summary and booking CTA with all states.
- Booking creation via POST /api/v1/bookings returning a server-authoritative BookingRecord.
- Auth gate: unauthenticated redirect, unverified email redirect.
- Free workshop path (unitPriceVnd = 0).
- Host bookings view (GET /api/v1/me/host-bookings).
- Session filtering: cancelled and full sessions excluded from picker.
- Published-only visibility for marketplace listings.
- Mobile responsive at 390x844.

**Out of scope (per UX contract section 10):** payment integration, workshop creation/editing, discovery listing page, rescheduling, real-time capacity, reviews, host dashboard.

## Actors and permissions

- **Learner (authenticated, email verified):** may view workshop detail, select session, create booking.
- **Learner (authenticated, email not verified):** may view workshop detail, but booking creation triggers verification redirect.
- **Anonymous user:** may view workshop detail, but booking CTA triggers sign-in redirect.
- **Host (workshop creator):** may view own bookings via host-bookings endpoint.
- **Non-owner / unauthorized:** must not see other hosts' private bookings or mutate bookings they do not own.

## Data flow (verified in code)

```
1. Page load → GET /api/v1/marketplace/event?slug={slug}
   → MarketplaceListing { id, slug, title, payload, publishedAt }

2. Sessions → GET /api/v1/sessions?offeringId={id}  (or kind=workshop)
   → BookableSession[] with status, startsAt, endsAt, spotsLeft, unitPriceVnd

3. User selects session + quantity → client estimate: unitPriceVnd × quantity

4. Booking → POST /api/v1/bookings { sessionId, participantCount }
   → BookingRecord { id, status, pricing: { amountVnd, model, ... }, session, ... }

5. Host view → GET /api/v1/me/host-bookings (authenticated)
   → BookingRecord[] where caller is host
```

## Acceptance criteria

### A. Workshop detail page loads from server data

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| A1 | Detail page renders from marketplace listing data, not localStorage or static mock data. | Workshop listing exists in `marketplace_listings` with `status: "published"`. | 1. Navigate to workshop detail page by slug. 2. Inspect network tab for `GET /api/v1/marketplace/event?slug=...`. 3. Verify page title and content match the listing payload. | Page renders workshop title, description, host info from the server response. No `localStorage.getItem` calls for workshop content. No hardcoded mock data in the rendered output. | API + browser |
| A2 | Page returns 404-style response for non-existent or unpublished slug. | No listing with the given slug, or listing exists with `status: "draft"`. | 1. Navigate to workshop detail page with invalid slug. 2. Navigate to workshop detail page with slug of a draft listing. | Both show a 404 or "not found" state. Draft listing is not accessible via direct URL. | API + browser |

### B. Session picker — bookable sessions only

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| B1 | Sessions fetched from `listBookableSessions()` with the workshop's offering ID. | Workshop has an associated offering with bookable sessions. | 1. Open workshop detail page. 2. Inspect network: `GET /api/v1/sessions?offeringId=...` or `GET /api/v1/sessions?kind=workshop`. 3. Verify response contains `BookableSession[]`. | Session picker receives sessions from the server endpoint. Sessions are grouped by date and sorted chronologically (per `sortFutureBookableSessions`). | API + browser |
| B2 | Only sessions with `status: "scheduled"` and `spotsLeft > 0` appear as selectable in the picker. | Workshop has sessions in various states: some scheduled with spots, one cancelled, one full (`spotsLeft = 0`). | 1. Open workshop detail page. 2. Open session picker. 3. Count visible session pills. | Cancelled sessions (`status !== "scheduled"`) are not shown. Full sessions (`spotsLeft === 0`) are not shown or shown as disabled with "Full" label (per UX contract table in section 2). Only scheduled sessions with available spots appear as clickable. | browser |
| B3 | Session times are displayed correctly from ISO 8601 `startsAt`/`endsAt`. | At least one bookable session exists with known start/end times. | 1. Open session picker. 2. Read displayed time for a session. 3. Compare with the API response `startsAt`/`endsAt`. | Displayed date and time range match the ISO timestamps, formatted as local Vietnam time (e.g., "Sun, 26 Jul 2026" / "09:00–11:30"). | browser |
| B4 | Selected session highlights with white fill; unselected sessions show border style. | At least 2 bookable sessions available. | 1. Click a session pill. 2. Observe visual state. 3. Click a different pill. 4. Observe visual state change. | First pill returns to border style. Second pill shows white fill with dark text. Only one session is selected at a time. | browser |

### C. Capacity — server-authoritative

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| C1 | `spotsLeft` displayed after session selection comes from the BookableSession response, not a client-computed value. | Session has `spotsLeft: 5` in the API response. | 1. Select a session. 2. Read "N spots remaining" text. 3. Compare with API `spotsLeft` value. | Displayed count matches the server-provided `spotsLeft`. No client-side calculation derives this number. | API + browser |
| C2 | When `spotsLeft <= 3`, urgency color (`--accent` / `#d6c1ad`) is applied to the spots remaining text. | Session with `spotsLeft: 2` exists. | 1. Select that session. 2. Inspect the spots remaining element's color. | Text color uses the warm accent color. Sessions with `spotsLeft > 3` use standard muted text color. | browser |
| C3 | When `spotsLeft` is `null`, the spots remaining count is omitted. | Session with `spotsLeft: null` exists (unlimited capacity). | 1. Select that session. 2. Look for "spots remaining" text. | No spots count is displayed. Participant quantity is capped at 1 (fallback max per UX contract section 3). | browser |
| C4 | Participant quantity stepper max is clamped to `min(spotsLeft, 100)`. | Session with `spotsLeft: 150`. | 1. Select session. 2. Attempt to increment participant count past 100. | Plus button is disabled at 100. Cannot exceed 100 even though spotsLeft is higher. | browser |
| C5 | Participant quantity stepper min is 1; minus disabled at 1. | Any session selected. | 1. Select a session. 2. Click minus button at quantity 1. | Minus button is disabled. Quantity remains 1. | browser |

### D. Booking creation — server-side record

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| D1 | POST /api/v1/bookings is called with `{ sessionId, participantCount }` and returns a BookingRecord with pricing snapshot. | Authenticated user, verified email, bookable session with available capacity. | 1. Select a session and set quantity to 2. 2. Click "Book workshop" / "Continue". 3. Inspect network: verify POST to `/api/v1/bookings` with correct body. 4. Verify response contains `ok: true` and `booking` with `id`, `sessionId`, `status: "requested"`, `pricing.amountVnd`, `pricing.unitPriceVnd`. | Request body matches `{ sessionId: "<uuid>", participantCount: 2 }`. Response BookingRecord has a pricing snapshot with `amountVnd` equal to `unitPriceVnd × participantCount`. `status` is `"requested"`. | API |
| D2 | Server-returned `pricing.amountVnd` replaces the client-side price estimate in the UI. | Booking created successfully. | 1. Note the displayed price estimate before clicking CTA. 2. After booking success, observe the confirmation/redirect state. | If a confirmation view is shown, the total displayed matches `BookingRecord.pricing.amountVnd`, not the client estimate. If redirect occurs, the booking detail page (if V1 scope) shows the server total. | browser + API |
| D3 | Loading state: button shows spinner and is disabled while `createBooking()` is in flight. | Authenticated user, session selected. | 1. Select session. 2. Click CTA. 3. Observe button state before network response. | Button text is replaced by a spinner. Button is not clickable during the request. | browser |
| D4 | On capacity error (409 SESSION_CAPACITY_EXHAUSTED), inline error message appears and button re-enables. | Session becomes full between page load and booking attempt (simulated or natural race). | 1. Select a session. 2. Trigger a booking that returns 409 with `SESSION_CAPACITY_EXHAUSTED`. 3. Observe UI. | Error message: "That session is full. Choose another." (or equivalent per UX contract). Button returns to enabled state. Session list can be refreshed. | browser + API |
| D5 | On conflict error (409 BOOKING_CONFLICT), inline error message appears. | User already has an active booking for the same session. | 1. Attempt to book a session already booked by the same user. | Error message: "This conflicts with another booking." (or equivalent per UX contract). Button re-enables. | browser + API |
| D6 | On generic server error, inline error message appears and button re-enables. | Server returns 500 or `BOOKING_SERVICE_UNAVAILABLE`. | 1. Trigger a booking that results in a generic error. | Error message: "Something went wrong. Please try again." (or equivalent). Button re-enables. User can retry. | browser |

### E. Auth gate

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| E1 | Signed-out user clicking CTA is redirected to `/auth/sign-in?next={encoded current path}`. | No active session (anonymous). | 1. Open workshop detail page while signed out. 2. Click "Book workshop" / "Continue". | Browser redirects to `/auth/sign-in?next=%2Fworkshops%2F{slug}` (URL-encoded path). No booking API call is made. | browser |
| E2 | Signed-in user with unverified email clicking CTA is redirected to `/auth/verify-email?next={encoded current path}` or receives `EMAIL_VERIFICATION_REQUIRED` error. | Authenticated user, email not verified. | 1. Sign in with unverified account. 2. Open workshop detail page. 3. Select session and click CTA. | Either redirect to `/auth/verify-email?next=...` OR POST /api/v1/bookings returns 403 with `EMAIL_VERIFICATION_REQUIRED` and UI shows appropriate message. | browser + API |
| E3 | After auth redirect and return, the workshop detail page loads correctly with session data intact. | User was redirected to sign-in, then returns. | 1. Click CTA while signed out (redirect to sign-in). 2. Complete sign-in. 3. Return to workshop detail page. | Page loads with workshop content and sessions. No stale or broken state. Session picker is functional. | browser |

### F. Free workshop

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| F1 | When `unitPriceVnd = 0`, booking is created with `amountVnd = 0` and no payment is required. | Workshop session with `unitPriceVnd: 0` (or `null` treated as free). | 1. Select free session. 2. Observe price display. 3. Complete booking. 4. Inspect BookingRecord response. | Price display shows "Free" (not "0 đ"). `BookingRecord.pricing.amountVnd` is `0`. `BookingRecord.paymentRequired` is `false` or absent. No payment flow is triggered. | browser + API |
| F2 | Free workshop booking CTA is still enabled and functional. | Free session selected. | 1. Select free session. 2. Verify CTA is enabled (white fill, clickable). 3. Click CTA. | CTA is not disabled for free workshops. Booking proceeds without payment step. | browser |
| F3 | When `unitPriceVnd` is `null` and session is not explicitly free, CTA is disabled with "Price to be confirmed". | Session with `unitPriceVnd: null` and `spotsLeft > 0`. | 1. Select that session. 2. Observe CTA state. | CTA is disabled. Message indicates price is not yet confirmed. Booking cannot proceed. | browser |

### G. Host bookings view

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| G1 | GET /api/v1/me/host-bookings returns only bookings where the caller is the host. | Host has bookings for their workshop sessions. Host also has bookings as a learner for another tutor's session. | 1. Authenticate as host. 2. Call `listHostBookings()`. 3. Inspect response. | All returned BookingRecords have `host.id` matching the authenticated user. Learner bookings for other hosts' sessions are not included. | API |
| G2 | GET /api/v1/me/host-bookings requires authentication; unauthenticated call returns 401. | No auth token. | 1. Call `/api/v1/me/host-bookings` without Authorization header. | Response is 401 with `UNAUTHORIZED` code. No booking data is leaked. | API |

### H. Session filtering — cancelled and full sessions

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| H1 | Sessions with `status: "cancelled"` do not appear in the session picker. | Workshop has at least one cancelled session in the API response. | 1. Open workshop detail page. 2. Open session picker. 3. Look for the cancelled session's date/time. | Cancelled session is not displayed as a selectable pill. If using `sortFutureBookableSessions`, the filter at line 9 (`session.status === "scheduled"`) handles this. | API + browser |
| H2 | Sessions with `spotsLeft === 0` are either hidden or shown as disabled with "Full" label. | Workshop has a session with `spotsLeft: 0`. | 1. Open session picker. 2. Look for the full session. | Session is either not shown, or shown with reduced opacity, non-clickable, and labeled "Full" per UX contract section 2 interaction states. | browser |
| H3 | Past sessions (before current time) do not appear in the picker. | Workshop has a session with `startsAt` in the past. | 1. Open session picker. | Past session is not shown. `sortFutureBookableSessions` filters by `startsAt > now`. | API + browser |

### I. Published-only visibility

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| I1 | Only published listings (`status: "published"`) appear in marketplace listing endpoint. | Listing with `status: "draft"` exists for the same kind. | 1. Call `GET /api/v1/marketplace/event`. 2. Inspect response items. | Draft listings are not included. Only listings with `published_at` set and `status: "published"` appear. The marketplace service query at `marketplace-service.ts:26` filters by `.eq("status", "published")`. | API |
| I2 | Workshop detail page for a draft listing returns 404 or is not routable. | Draft listing exists with a known slug. | 1. Navigate to `/workshops/{draft-slug}`. | Page shows not-found state. Draft content is not leaked. | browser |

### J. Mobile responsive (390x844)

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| J1 | Page renders at 390x844 without horizontal overflow. | Any workshop detail page. | 1. Set viewport to 390x844. 2. Load workshop detail page. 3. Inspect body for horizontal scrollbar. | No `overflow-x` scroll. All content fits within 390px width. `overflow-x: hidden` on page. | browser |
| J2 | Fixed bottom bar with price + "Book workshop" CTA appears at viewport width ≤ 760px. | Viewport set to 390x844. | 1. Scroll to bottom of page. 2. Observe fixed bottom bar. | Bottom bar is visible, fixed to viewport bottom. Shows price on left, session summary, and CTA button on right. CTA is ≥ 44px height. | browser |
| J3 | All tap targets are ≥ 44px height. | Viewport 390x844. | 1. Inspect all interactive elements: session pills, stepper buttons, CTA buttons, nav links, back button. | Every tappable element has at least 44px height/width. No cramped or unreachable controls. | browser |
| J4 | Booking panel flows inline (not sticky sidebar) on mobile. | Viewport 390x844. | 1. Scroll the page. 2. Observe booking panel behavior. | Booking panel scrolls with content. It is not fixed/sticky as it would be on desktop (>1100px). | browser |
| J5 | Section nav is sticky below the top bar on mobile. | Viewport 390x844. | 1. Scroll past the hero section. 2. Observe section nav (About, Schedule, etc.). | Section nav sticks below the top bar (approximately `top: 4rem`). Horizontal scroll within section nav works without visual cutoff. | browser |

### K. Error states and edge cases

| ID | Criterion | Precondition | Steps | Expected result | Evidence |
|----|-----------|-------------|-------|-----------------|----------|
| K1 | When no bookable sessions exist for the workshop, the picker shows an empty state. | Workshop listing exists but has zero sessions via `listBookableSessions()`. | 1. Open workshop detail page. 2. Observe session picker area. | Empty state message (e.g., "No sessions available yet"). CTA is disabled or shows "Sold out" / "No sessions available". | browser |
| K2 | When all sessions are full (`spotsLeft === 0` for every session), CTA shows "Sold out" and is disabled. | All sessions have `spotsLeft: 0`. | 1. Open workshop detail page. 2. Observe CTA. | CTA button is disabled with "Sold out" label. No session can be selected. | browser |
| K3 | Network failure during session fetch shows error state, not stale data. | Simulate network failure for `GET /api/v1/sessions`. | 1. Block the sessions endpoint. 2. Load workshop detail page. | Error state shown for session picker. No mock/cached session data is displayed. User can retry. | browser |
| K4 | Workshop detail page does not use localStorage for any booking flow data. | Any state. | 1. Open DevTools. 2. Search localStorage for keys containing "booking", "session", "workshop". | No booking-related keys in localStorage. All session and pricing data comes from API responses. | browser |

## Forbidden behavior

- F1. No optimistic "booking successful" states before server confirmation.
- F2. No localStorage, JSON files, or seeded demo data used for the booking flow.
- F3. No client-side fabrication of `spotsLeft`, pricing, or session availability.
- F4. No booking creation without server-side validation and persistence.
- F5. No display of auth IDs, private contact data, or service-role credentials in the workshop detail page.
- F6. No demo/simulated payment behavior in the production booking path.

## Regressions that must not occur

- Existing tutor profile booking flow (tutor-profile-frame.tsx pattern) continues to work.
- Existing event detail page (`event-detail-page.tsx`) session selection and booking CTA remain functional.
- `listBookableSessions()` and `createBooking()` in `booking-api.ts` continue to pass their unit tests.
- Backend booking routes (`POST /api/v1/bookings`, `GET /api/v1/sessions`) continue to pass their tests.
- Auth gate (`evaluateAuthGate`) continues to function for all session states.
- `sortFutureBookableSessions` filtering logic is not broken by any workshop-specific changes.

## Evidence required for PASS

1. **Browser verification (desktop 1440px + mobile 390x844):** Workshop detail page loads from server, sessions display correctly, booking CTA flows through all states, auth gate redirects work, mobile bottom bar appears.
2. **API evidence:** Network tab shows correct endpoints called (`/api/v1/marketplace/event`, `/api/v1/sessions`, `/api/v1/bookings`), correct request bodies, correct response shapes.
3. **Auth flow evidence:** Signed-out redirect to `/auth/sign-in?next=...`, unverified email handling (403 or redirect), return-after-auth restores page state.
4. **Free workshop evidence:** Booking of `unitPriceVnd = 0` session creates BookingRecord with `amountVnd = 0`, no payment flow.
5. **Host bookings evidence:** `GET /api/v1/me/host-bookings` returns only host's own bookings.
6. **Filtering evidence:** Cancelled, full, and past sessions excluded from picker (visual + API response comparison).
7. **No-regression evidence:** Existing booking API unit tests pass. Existing event detail page tests pass.
8. **No localStorage evidence:** DevTools localStorage inspection shows no booking-related keys.

## Unresolved — PRODUCT_DECISION_REQUIRED

None. All criteria are derived from the frozen UX contract (`docs/workshop-detail-v1-ux-contract.md`) and verified backend API contracts. The UX contract explicitly defers payment integration to a separate phase, and the booking route returns `status: "requested"` without requiring payment in V1.

## Verification mode (later)

Verification runs against this original contract; any criterion change is recorded (original, reason, authorizer, revised) via `scripts/team-observability.py contract-change` and approved by the orchestrator. QA must not silently weaken this contract during verification.

---

*End of Workshop Booking Flow V1 QA Contract*
