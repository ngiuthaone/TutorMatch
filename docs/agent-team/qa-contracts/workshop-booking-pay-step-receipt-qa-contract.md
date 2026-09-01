# QA Acceptance Contract — Workshop booking: Pay step + in-sheet receipt

- Run: workshop-booking-pay-step-receipt
- Surface: `discover/` Next.js app, workshop booking flow
- Primary file: `discover/src/components/workshop/workshop-booking-sheet.tsx`
- Parent: `discover/src/components/workshop/workshop-detail-page.tsx`
- QA mode: PREFLIGHT (acceptance contract only — no code modified)
- Date: 2026-08-30

## 1. Authority sources (ranked)

1. **Explicit user instruction (approved scope):** (a) keep the existing request-based, server-authoritative flow; (b) add a "Pay" step after Review — payment-method selection (VNPay / Credit Card) + policy-terms checkbox, request-based only, NO real payment provider, final CTA "Pay now" / booking-request confirmation; (c) add an in-sheet receipt state — booking ID/reference, date/time, participants, QR-code placeholder, "View booking" + "Add to calendar"; (d) parent must stop hard-navigating to the non-existent `/bookings/{slug}` — receipt surfaces in-sheet, "View booking" must target an existing route; (e) no real money is charged and copy must NOT claim a payment/deposit was captured — it must honestly say the request was sent and payment is handled later.
2. **Tutoria product policy** — `docs/agent-team/TUTORIA_PRODUCT_BRAIN.md`: principles (trust before transaction, progressive disclosure, demo ≠ production); production data rules (production truth never depends on simulated payments); booking prerequisite (requested+confirmed hard-reserve capacity; Payment never mutates capacity); payments prerequisite (provider-hosted collection etc.); UX expectations (desktop/mobile, loading/empty/error, keyboard/focus, touch targets, locale-aware VND/dates, Safari incl. iOS); engineering truthfulness labels (PASS/PARTIAL/UNVERIFIED/BLOCKED).
3. **Verified repository evidence** (see §2).
4. **Prior accepted contracts in this domain** — `docs/agent-team/qa-contracts/workshop-booking-v1-qa-contract.md`: V1 booking route returns `status: "requested"`, payment deferred to a later phase; **F6: "No demo/simulated payment behavior in the production booking path."**

## 2. Verified context (evidence)

| Fact | Evidence |
|---|---|
| Only `/bookings` list route exists; **no `/bookings/[id]` route** | `discover/src/app/bookings/` contains only `page.tsx`, `page-state.ts`, `page-state.test.ts` (glob) |
| Parent hard-navigates to the missing route | `workshop-detail-page.tsx:183` — `window.location.assign(\`/bookings/${booking.id}\`)` in `handleBooked` |
| Identical broken nav exists OUTSIDE this scope | `class-detail-page.tsx:198` (same pattern) — flagged, not in scope |
| `createBooking()` contract | `booking-api.ts:184-192` — POST `/api/v1/bookings`, Bearer, body `{ sessionId, participantCount, learnerName, learnerEmail, learnerPhone, learnerNote? }`, returns `BookingRecord` |
| `BookingRecord` shape | `booking-api.ts:53-102` — `id`, `status: "requested"\|"confirmed"\|"cancelled"\|"rejected"\|"completed"`, `participantCount`, `pricing: BookingPricing \| null`, `session.startsAt/endsAt`, `paymentRequired?`, `paymentReady?`, `payment?`, `cancellation?` |
| Auth gates in current submit | `workshop-booking-sheet.tsx:187-222` — sign-in redirect on unauthenticated, verify-email redirect on `EMAIL_NOT_CONFIRMED`, `ensureSession()` before create, `AUTH_REDIRECT_SIGN_IN / AUTH_REDIRECT_VERIFY` on `BookingApiError`, inline error + re-enable otherwise, `submitting` guard blocks close/double-submit |
| Error codes mapped | `SESSION_CAPACITY_EXHAUSTED`, `BOOKING_CONFLICT`, `LEARNER_PHONE_INVALID`, `LEARNER_NAME_REQUIRED`, `LEARNER_EMAIL_INVALID`, `UNAUTHORIZED`, `EMAIL_VERIFICATION_REQUIRED` (`workshop-booking-sheet.tsx:37-57`) |
| Steps/progress wiring | `STEPS` array, `STEP_INDEX`, `LAST_STEP="Review"`, header "Step X of N", progressbar `aria-valuenow` = `STEP_INDEX/(stepCount-1)` — adding a step must update all |
| Real payment surfaces exist but are OFF-limits for this change | `payment-api.ts:43` `startPayment` → POST `/api/v1/payments/start` (used by `/bookings` page); `workshop-booking-api.ts:116` `startWorkshopPayment` (used only by `events/workshop-booking-bridge.tsx`) — the sheet under change uses `booking-api.ts` only |
| Free workshops | V1 contract F1/F2: `unitPriceVnd=0` → "Free", booking created, no payment flow; `PriceSummary` and Review already branch on free/unknown price |
| `--accent` ambiguity | `globals.css:25` defines `--accent:#f4f4f2` (near-white) at `:root`; `workshop-detail-page.module.css:9` and `event-detail-page.module.css:9` redefine `--accent:#d6c1ad` on `.page`; sheet uses `var(--accent,#d6c1ad)` — the `#d6c1ad` fallback is dead wherever `--accent` resolves, and the resolved color depends on mount context |
| No QR/ICS/calendar dependency present | `discover/package.json` deps verified — no `qrcode`, `ics`, `ical` |
| Unit-test tooling limits | `vitest.config.ts`: environment `node`, includes only `src/**/*.test.ts` — no jsdom/component rendering; UI behavior is browser-verification territory; pure helpers are unit-testable |

## 3. Scope

**In scope:** Pay step (method selection + terms checkbox), request-confirmation CTA, in-sheet receipt state, receipt actions, parent `handleBooked` navigation removal, truthful copy, step-count/progress consistency, a11y/responsive compliance of the touched UI.

**Out of scope (must NOT appear):** backend/API changes, real payment-provider wiring or redirects, `/bookings/[id]` route creation, changes to the `/bookings` list page, changes to `class-detail-page.tsx` (identical bug — flag only), simulated payment state of any kind, new dependencies without a license gate.

## 4. Criteria

### C1 — Steps and progress stay consistent with a 5th step
- PASS: `STEPS` = When→Guests→Contact→Review→Pay; `LAST_STEP`, `STEP_INDEX`, header "Step X of 5", and progressbar `aria-valuenow` all agree; Pay appears after Review and before any submit CTA.
- Verify: Unit (if helpers extracted) + browser + code inspection.

### C2 — Pay step validation: terms required, method selectable
- PASS: Both "VNPay" and "Credit Card" options render and are selectable with the chosen method reflected in state/submit. Submitting is impossible while the terms checkbox is unchecked (CTA disabled, or blocked with an inline, announced error). Checking terms enables the CTA.
- Verify: Browser (primary) + unit for gating logic if extracted pure.

### C3 — Request-based honesty: no payment call, no payment-capture claim
- PASS: The final CTA triggers ONLY the existing `createBooking()` POST `/api/v1/bookings` (plus the pre-existing sessions GET). No request is made to `/api/v1/payments/start` and no provider redirect occurs anywhere in the Pay step. Rendered copy contains none of: "paid", "payment received", "deposit captured", "charge successful", "Payment complete". Copy states the request is sent, the host confirms, and payment happens later in a secure step (preserving the existing "You won't be charged yet" pattern).
- Verify: Browser (network tab) + code/grep.

### C4 — Auth, error, and submit handling preserved on the new submit path
- PASS: On Pay-step submit, unauthenticated → `/auth/sign-in?next=<currentPath>`; `EMAIL_NOT_CONFIRMED` → `/auth/verify-email?next=...`; `UNAUTHORIZED` `BookingApiError` → sign-in redirect; capacity-exhausted/conflict/learner-field errors render the existing inline `role="alert"` error, stay on the Pay step, reset `submitting`, re-enable the CTA. `submitting` guard still prevents close and double-submit (exactly one POST in network).
- Verify: Browser + unit (error mapping already testable as pure fn).

### C5 — In-sheet receipt state appears only after server success
- PASS: After `createBooking` resolves, the sheet body is replaced by a receipt (no step UI, no footer Continue/Pay CTA). Receipt shows: booking ID/reference (from `BookingRecord.id`), session date/time (from `booking.session.startsAt`, endsAt where shown), participant count (from server `participantCount`), a QR placeholder visually present and labeled as a placeholder, and both "View booking" and "Add to calendar" actions. On any failure, the sheet shows the inline error and NO receipt.
- Verify: Browser (primary).

### C6 — Receipt is server-authoritative; no invented paid/confirmed state
- PASS: Every receipt value derives from the returned `BookingRecord`. For the request-based flow the server returns `status: "requested"` and no `payment` object — the receipt copy must say "Request sent — awaiting host confirmation" (or equivalent) and must NOT render success/paid/confirmed-in-the-payment-sense UI. If `pricing.amountVnd` is 0 the receipt says Free; if null it shows an unconfirmed/placeholder amount — never a fabricated total. No payment-success, payment-pending, or QR-check-in state is invented client-side.
- Verify: Code inspection + browser with live API + unit (formatting helpers).

### C7 — Navigation fixed: parent no longer navigates to a non-existent route
- PASS: `handleBooked` in `workshop-detail-page.tsx` contains no `window.location.assign(\`/bookings/${id}\`)` / no navigation to `/bookings/{id}` at all (grep-able). "View booking" in the receipt navigates to `/bookings` (verified existing route) and the page loads without 404. Sheet close/backdrop still respects `submitting` guard.
- Verify: Code/grep + browser (click through, assert no 404 and no client-side error).

### C8 — No regression to When / Guests / Contact / Review
- PASS: Step validators (`whenValid`, `guestsValid`, `contactValid` incl. EMAIL/VN_PHONE regexes, note ≤ 500) and Continue gating unchanged; Review still shows summary rows, Total (client estimate → `serverTotal` override), shield "You won't be charged yet" note; `createBooking` call payload unchanged (no new fields); free-session behavior from V1 contract F1/F2 unaffected (subject to PD1 resolution).
- Verify: Browser (full happy path) + unit (validators) + code inspection.

### C9 — Responsive: mobile bottom sheet + desktop modal for Pay step and receipt
- PASS: At ~390px and ≥1280px widths: Pay step and receipt render inside the sheet (max-h 92vh, safe-area padding), no horizontal scroll, CTA visible and tappable, receipt scrolls within the sheet, body scroll-lock preserved.
- Verify: Browser (both viewports).

### C10 — Keyboard and focus basics
- PASS: Existing Escape-to-close and first-control focus-on-open preserved; method radios and the terms checkbox are operable with keyboard alone (native inputs); visible focus on new controls; when the sheet transitions to the receipt, focus moves to a receipt landmark (e.g., heading) rather than remaining on a removed control; new actions reachable by Tab.
- Verify: Browser (keyboard walkthrough).

### C11 — Accessibility of new controls
- PASS: Method radios live in a labelled group (fieldset/legend or equivalent `role="radiogroup"`); the terms checkbox has a programmatic label (ideally linking the policy text); CTA disabled state is conveyed beyond color (text/aria); inline validation uses `role="alert"`/`aria-live`; the QR placeholder carries an `aria-label`; receipt status transition is announced (`aria-live` or focus move to an announced heading).
- Verify: Browser (DOM + a11y basics).

### C12 — Build, type, and lint
- PASS: `npm run build` and `npm run lint` in `discover/` exit 0 with no new errors; step union/props/types compile.
- Verify: Build.

### C13 — No new dependencies without license gate
- PASS: `discover/package.json` gains no `qrcode`/`ics`/calendar dependency; OR, if a dependency is added, the OSS gate is complete: `oss/EXTERNAL_SOURCES.json` entry, `THIRD_PARTY_NOTICES.md` regenerated, `python3 scripts/oss_guard.py ci` passes. Hand-rolled ICS string / CSS QR placeholder avoids the gate entirely.
- Verify: Build + code inspection + license evidence.

### C14 — No demo/simulated payment promoted to the production path
- PASS: Consistent with product brain §Production data rules and V1 contract F6 — there is no simulated "payment succeeded/pending" state, no localStorage payment truth, and no client-asserted financial outcome anywhere in the Pay step, receipt, or parent handler.
- Verify: Code/grep + browser session.

### Negatives
| ID | Case | PASS | Verify |
|---|---|---|---|
| N1 | Unauthenticated user opens flow | Existing parent auth gate redirects to `/auth/sign-in?next=...` before the sheet opens (unchanged) | Browser + code |
| N2 | Terms unchecked on Pay step | CTA inert with explanation; no submit possible | Browser |
| N3 | `createBooking` returns capacity/conflict error | Inline error on Pay step, no receipt, CTA re-enabled | Browser (stubbed/live) |
| N4 | Free session (`unitPriceVnd = 0`) | No payment-method requirement blocks a free booking; no charge copy (final behavior subject to PD1) | Browser + code |
| N5 | Unknown price (`unitPriceVnd = null`) | No fabricated amount on Pay step; copy stays honest (subject to PD1) | Browser + code |
| N6 | Rapid double-click on final CTA | Exactly one POST; `submitting` blocks second call and close | Browser |
| N7 | Close attempted while submitting | Close is prevented (existing guard) | Browser + code |

## 5. PRODUCT_DECISION_REQUIRED (await product/orchestrator; QA makes no call)

- **PD1 — Pay step for free (`unitPriceVnd = 0`) and unknown-price sessions.** Should the Pay step (method selection, "Pay now" semantics) appear at all when nothing is payable, or be skipped with a no-payment message? Unknown-price sessions: proceed request-style with "Send request" copy? Blocks C2/C3/C8/C14 final wording.
- **PD2 — Persistence of the selected payment method (VNPay / Credit Card).** `createBooking` has no field for it and no backend change is in scope — is the selection purely presentational this change (copy must then not promise "you'll pay by VNPay"), or must it be stored (→ separate backend work, out of scope)?
- **PD3 — CTA and receipt wording.** Literal "Pay now" risks implying an immediate charge; "Send booking request" (or similar) is the honest label for request-based flow. Receipt heading: "Request sent — awaiting host confirmation" vs any "confirmed" wording. QA will assert honesty regardless, but the exact copy is a product choice.
- **PD4 — "Add to calendar" mechanism.** ICS file download (hand-rolled string = no dependency) vs Google Calendar deep link vs enabled placeholder. A new `ics`/calendar dependency triggers the license gate (C13).
- **PD5 — QR placeholder vs real QR.** A static placeholder (user's stated intent) needs no dependency; a real scannable QR of the booking ID would require a `qrcode` library → license gate, and would imply a check-in capability that does not exist (truthfulness risk).
- **PD6 — Parent toast after booking.** Keep the toast with truthful copy ("Booking request sent · amount") or drop it since the receipt is in-sheet. Either way it must not navigate and must not claim payment. (If kept, the existing "Booking created · ₫…" copy is currently truthful.)

## 6. Risks and notes

- **R1 — Broken `/bookings/{id}` navigation.** Confirmed 404 today in `workshop-detail-page.tsx:183`; same pattern in `class-detail-page.tsx:198` (out of scope, flag to orchestrator). This change must remove the workshop one; `/bookings` list page shows inline cards and does not deep-link to a specific booking, so the user lands on the list — acceptable per scope.
- **R2 — Auth paths.** The Pay step must preserve all three gates (sign-in, verify-email, UNAUTHORIZED→sign-in). Regression here would strand users in a submitting state.
- **R3 — `--accent` token ambiguity.** `globals.css` (near-white `#f4f4f2`) vs module-scoped beige `#d6c1ad`; the sheet's `var(--accent,#d6c1ad)` fallback is dead and the resolved color depends on mount context. Any accent-colored element added to Pay/receipt will inherit a context-dependent color — decide a token strategy (e.g., sheet-scoped token) before implementing; QA will verify the resolved value in both the detail-page mount and any other mount.
- **R4 — QR/ICS license gate.** Verified absent from `package.json`. Any added dependency must pass the mandatory external-source gate (AGENTS.md) with ledger entry, notices regeneration, and `oss_guard.py ci`. Hand-rolled implementations avoid it entirely.
- **R5 — Step-count/progress consistency.** `aria-valuenow` denominator `(stepCount-1)` and header "Step X of N" must move to 5 in sync (C1); easy silent regression.
- **R6 — Parallel payment-capable workshop surface.** `workshop-booking-api.ts` (`startWorkshopPayment`) already exists and is used by `events/workshop-booking-bridge.tsx`. The sheet under change must continue to use `booking-api.ts`; the Pay step must not accidentally import the payment-capable client (C3/C14).
- **R7 — Unit-test reach.** Vitest is node-only and cannot render components; UI behaviors (C2, C5, C9–C11) rest on browser verification. If browser tooling (agent-browser) is unavailable at verification time, browser criteria are reported UNVERIFIED — not assumed passed. Extracting pure helpers (step gating, receipt formatting, honesty-copy guard) would move part of C2/C5/C6 to unit coverage.

## 7. Verification prerequisites

- Live-mode backend reachable (or local Supabase/dev server) so `POST /api/v1/bookings` returns a real `BookingRecord` for C3/C5/C6; otherwise those criteria are UNVERIFIED.
- Signed-in learner session for the happy path; signed-out check for N1.
- Desktop (≥1280px) and mobile (~390px) viewports; network tab; console monitoring; keyboard-only walkthrough.
- `npm run build` + `npm run lint` in `discover/`.