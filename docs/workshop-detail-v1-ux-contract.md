# Workshop Detail V1 — UX Contract

**Date:** 2026-08-19
**Branch:** `codex/core-1to1-integrated`
**Scope:** First production vertical slice for Non-Tutor Product Surfaces V1
**Predecessor:** Shared Booking Engine Phase 1 (baselined)

---

## 1. Visual Hierarchy and Layout

### Page structure (top to bottom)

```
[Sticky top bar]          ← back link + share/save
[Hero section]            ← cover image, title, host, category tag, rating
[Booking panel]           ← session selector + participant + price + CTA
[Section nav]             ← sticky anchor tabs
[About]                   ← description/experience
[What's included]         ← checklist cards
[Workshop plan]           ← timeline steps (optional for V1)
[Host card]               ← host identity + bio
[Location/format card]    ← venue or online indicator
[FAQ]                     ← accordion
[Reviews]                 ← placeholder or omit for V1
[Mobile bottom bar]       ← fixed price + CTA (mobile only)
```

### Design tokens (reuse existing from event-detail-page.module.css)

| Token | Value | Usage |
|-------|-------|-------|
| `--canvas` | `#09090b` | Page background |
| `--panel` | `#141416` | Card surfaces |
| `--panel-2` | `#1b1b1e` | Elevated surfaces (booking panel) |
| `--line` | `rgba(255,255,255,0.08)` | Borders, dividers |
| `--text` | `#f5f5f7` | Primary text |
| `--muted` | `#a1a1aa` | Secondary text |
| `--quiet` | `#71717a` | Tertiary/label text |
| `--accent` | `#d6c1ad` | Warm accent (icons, badges) |

### Typography hierarchy

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | `clamp(2.4rem, 14vw, 3.4rem)` on mobile; `clamp(3rem, 6vw, 4.25rem)` on desktop | 650 | Workshop title |
| H2 | `clamp(1.75rem, 3vw, 2.25rem)` | 650 | Section headings |
| Body | `0.95–1rem` | 400 | Descriptions, paragraphs |
| Meta | `0.78–0.9rem` | 600–700 | Booking panel labels, session info |
| Micro | `0.625rem` | 800, uppercase, `0.14em` tracking | Section labels ("ABOUT THIS WORKSHOP") |

### Desktop layout (> 1100px)

Two-column hero grid: `minmax(0, 1fr) 360px`.
Left: cover image + title + meta + gallery.
Right: sticky booking panel at `top: 7rem`.

### Tablet (761–1100px)

Single column. Booking panel becomes static, max-width `36rem`.

### Mobile (≤ 760px, required 390×844)

Single column. Top bar title hidden. Booking panel inline. Fixed bottom bar appears with price + "Book workshop" CTA. Status toasts shift up to `bottom: 5.5rem` to clear the bar.

---

## 2. Session Selection — Interaction Pattern

### Data source

Sessions come from `listBookableSessions()` in `booking-api.ts`. For workshops, the frontend calls:

```ts
listBookableSessions({ offeringId: workshopOfferingId })
// or
listBookableSessions({ kind: "workshop" })
```

Each `BookableSession` provides:
- `id` (UUID)
- `startsAt` / `endsAt` (ISO 8601)
- `spotsLeft` (number | null)
- `maxParticipants` (number | null)
- `unitPriceVnd` (number | null)
- `status` ("scheduled")
- `version` (optimistic lock)
- `offering?` — `{ id, kind, title }`
- `host?` — `{ id, displayName }`

### Presentation

Group sessions by date. Within each date, show time slots as pill buttons.

```
┌─────────────────────────────────────┐
│ Date and time                  [▾]  │  ← collapsed summary
├─────────────────────────────────────┤
│ Sun, 26 Jul 2026                    │  ← date group header
│  [09:00–11:30]  [12:00–14:30]      │  ← time pill buttons
│                                     │
│ Sat, 25 Jul 2026                    │
│  [09:00–12:30]  [14:00–17:30]      │
└─────────────────────────────────────┘
```

### Interaction states

| State | Visual | Behavior |
|-------|--------|----------|
| Available | Pill with border, muted text | Clickable, selects session |
| Selected | White fill, dark text | Active selection |
| Full (`spotsLeft === 0`) | Muted, reduced opacity, "Full" label appended | Disabled, not clickable |
| Cancelled (`status !== "scheduled"`) | Strikethrough or hidden | Filtered out by `sortFutureBookableSessions` |

### Capacity display

After session selection, show remaining spots below the session summary:

```
3 spots remaining
```

When `spotsLeft <= 3`, use warm accent color (`--accent`) for urgency.
When `spotsLeft === null` (unknown), omit the count.

### Server authority

Session availability is fetched on page load and can be refreshed. The booking panel shows the most recently fetched `spotsLeft`. The server re-validates at booking creation time. The UI must not fabricate availability.

---

## 3. Participant Quantity — Interaction Pattern

### Stepper control

```
[−]  1  [+]
```

Circular stepper, same pattern as existing event-detail-page.

### Constraints

| Constraint | Source | UI behavior |
|------------|--------|-------------|
| Minimum = 1 | Business rule | Minus button disabled at 1 |
| Maximum = `spotsLeft` (from selected session) | Server-provided | Plus button disabled at max |
| Maximum fallback = 1 | When `spotsLeft` is null | Only 1 participant allowed |
| Maximum clamp = 100 | `createBookingSchema` in backend | Hard cap, even if `spotsLeft` exceeds it |

### Price estimate

Display a client-calculated estimate:

```
Unit price × quantity = estimated total
```

- Unit price: `unitPriceVnd` from selected `BookableSession`, formatted as Vietnamese dong.
- If `unitPriceVnd` is null, show "Price to be confirmed" and disable the CTA.
- The estimate is a **frontend calculation** — the server-confirmed total is returned after `createBooking()`.

### Format

```
650,000 đ × 2 = 1,300,000 đ
```

Use `Intl.NumberFormat("vi-VN")` for formatting, consistent with existing `formatTotal` in event-detail-page.

---

## 4. Booking Review — Information Hierarchy

The booking review is an inline summary within the booking panel, not a separate page/modal for V1.

### Layout (top to bottom within the panel)

```
┌─────────────────────────────────────┐
│  Workshop title (or offering title) │  ← from offering or page context
│  Host: Thu Ha                       │  ← from session.host or page context
├─────────────────────────────────────┤
│  📅 Sun, 26 Jul 2026               │  ← from selected session
│     09:00 – 11:30                   │
├─────────────────────────────────────┤
│  👥 2 participants                  │  ← from quantity selector
├─────────────────────────────────────┤
│  Subtotal      1,300,000 đ          │  ← unitPrice × quantity
│  Total         1,300,000 đ          │  ← bold, larger
├─────────────────────────────────────┤
│  🛡 Free cancellation up to 24hrs   │  ← from cancellation policy
│     before the start.               │
└─────────────────────────────────────┘
```

### Price breakdown rules

- **Single participant:** Show "Total" only (no subtotal line).
- **Multiple participants:** Show "Unit price × quantity" as subtotal, then "Total".
- **Free workshops:** Show "Free" instead of price. Still show participant count.
- **Server total:** After `createBooking()` succeeds, the returned `BookingRecord.pricing.amountVnd` is the authoritative total. The UI must replace the estimate with the server value.

### Cancellation policy

Source from the workshop's `cancellation` field (array of strings). For V1, show the first policy note as a single line below the total. Use the shield icon (`IconShieldCheck`) and muted text.

---

## 5. Booking CTA — States and Behavior

### Button label

"Book workshop" (mobile bottom bar) or "Continue" (desktop panel).

### States

| State | Button visual | Behavior |
|-------|--------------|----------|
| **Ready** | White fill (`#fff`), dark text (`#09090b`), weight 800 | Clickable |
| **No session selected** | Disabled, muted background | "Choose a session" tooltip or inline message |
| **No auth** | Ready appearance | On click: redirect to `/auth/sign-in?next={currentPath}` |
| **Loading** | Spinner icon replaces text, button disabled | `createBooking()` in flight |
| **Success** | Redirect to booking confirmation or payment page | Server returns `BookingRecord` |
| **Error: capacity** | Button re-enabled, inline error: "That session is full. Choose another." | Refresh session list |
| **Error: conflict** | Button re-enabled, inline error: "This conflicts with another booking." | User adjusts selection |
| **Error: auth** | Redirect to sign-in | `UNAUTHORIZED` code |
| **Error: verification** | Redirect to email verify | `EMAIL_VERIFICATION_REQUIRED` code |
| **Error: generic** | Button re-enabled, inline error: "Something went wrong. Please try again." | User retries |
| **Sold out** (all sessions full) | Disabled, "Sold out" label | No sessions available |

### Auth flow (reuse from tutor-profile-frame.tsx)

```
1. User clicks "Continue" / "Book workshop"
2. ensureSession() — checks Supabase auth
3. If unauthenticated → redirect to /auth/sign-in?next={encodedReturnPath}
4. If email not verified → redirect to /auth/verify-email?next={encodedReturnPath}
5. createBooking(sessionId, participantCount)
6. On success → redirect to booking detail or payment page
7. On error → show inline error, re-enable button
```

### Return path encoding

After auth, return to the workshop detail page with `bookingSessionId` query param set to the newly created booking ID, and `bookingStep=review` to resume into a confirmation view. Same pattern as `tutor-profile-frame.tsx` line 149.

---

## 6. Mobile Viewport Considerations (390×844)

### Non-negotiables

- No horizontal body overflow (`overflow-x: hidden` on page).
- No clipped CTAs — all tap targets ≥ 44px height.
- Booking panel flows inline (not sticky sidebar).
- Fixed bottom bar with price + CTA appears at ≤ 760px.
- Bottom bar accounts for `env(safe-area-inset-bottom)`.
- Section nav scrolls horizontally without visual cutoff.
- Gallery collapses to single-column stack.
- H1 scales down via `clamp(2.4rem, 14vw, 3.4rem)`.

### Mobile bottom bar

```
┌──────────────────────────────────────┐
│  1,300,000 đ    Sun, 26 Jul 09:00   │
│                   [Book workshop]    │
└──────────────────────────────────────┘
```

- Fixed to viewport bottom.
- Backdrop blur + dark background.
- Price on left (bold), session summary below it (muted, small).
- CTA button on right: white fill, 44px min-height, 14px border-radius.
- Status toasts (`role="status"`) shift to `bottom: 5.5rem` to avoid overlap.

### Scroll behavior

- Section nav is sticky below the top bar (`top: 4rem`).
- Booking panel on desktop is sticky at `top: 7rem`.
- On mobile, booking panel is not sticky — it scrolls with content.
- `scroll-margin-top: 9rem` on section anchors to clear sticky nav.

---

## 7. Shared Component Boundaries

### Reuse from existing codebase

| Component | Source | What to reuse | What to change |
|-----------|--------|---------------|----------------|
| Session selector | `event-detail-page.tsx` lines 136–151 | `<details>` expand pattern, pill button layout, selected state | Fetch from `listBookableSessions()` instead of static data; group by date from ISO timestamps; show capacity per slot |
| Participant stepper | `event-detail-page.tsx` lines 153–161 | `−` / `+` buttons, circular stepper, disabled states | Max from `spotsLeft` not a hardcoded value; price-aware |
| Price summary | `event-detail-page.tsx` lines 163–166 | Total display, formatting | Add subtotal line for multi-participant; handle free; format from `unitPriceVnd` |
| Top bar | `event-detail-page.tsx` lines 15–93 | Sticky, blur, back link, share/save | Title from offering data, not hardcoded |
| Mobile bottom bar | `event-detail-page.tsx` lines 294–297 | Fixed bottom, price + CTA | Session summary text from selected session |
| Status toast | `event-detail-page.tsx` lines 1153–1175 | Fixed position, fade transition | Adjust `bottom` for mobile bar overlap |

### New shared components (create for Workshop V1, reuse for Class/Event)

| Component | Purpose | Interface |
|-----------|---------|-----------|
| `SessionDatePicker` | Fetches + renders bookable sessions grouped by date. Handles loading, empty, error, and sold-out states. | `{ offeringId?: string; kind?: string; onSelect: (session: BookableSession) => void; selected?: BookableSession }` |
| `ParticipantQuantity` | Quantity stepper with server-derived max. Shows price estimate. | `{ min?: number; max: number; unitPrice?: number; currency?: string; onChange: (qty: number) => void }` |
| `PriceSummary` | Unit × quantity breakdown with server-total override. | `{ unitPrice?: number; quantity: number; serverTotal?: number; currency?: string; policy?: string }` |
| `BookingCTA` | Button with all loading/error/auth states. | `{ onClick: () => void; loading: boolean; error?: string; disabled: boolean; label?: string }` |
| `HostSummaryCard` | Host avatar, name, bio, rating, actions. | `{ name: string; avatar: string; bio: string; rating?: number; reviewCount?: number; profileUrl?: string }` |
| `WorkshopFactsCard` | Duration, format, level, languages, capacity. | `{ facts: Array<{ label: string; value: string; note?: string }> }` |

### Components NOT in scope for V1

| Component | Reason |
|-----------|--------|
| Review cards | Omit or show placeholder section; no review data from backend yet |
| Gallery grid | Reuse existing pattern but simplify — single hero image + optional thumbnails |
| Workshop plan timeline | Reuse from prototype if workshop has `plan` data; otherwise omit |
| FAQ accordion | Reuse existing `<details>` pattern directly |
| Similar workshops | Omit for V1; add after workshop discovery feed exists |

---

## 8. Data Flow Summary

```
Workshop Detail Page
  │
  ├─ Marketplace listing (GET /api/v1/marketplace/event?slug=...)
  │   └─ Returns: { id, slug, title, payload }  ← workshop content from payload
  │
  ├─ Bookable sessions (GET /api/v1/sessions?offeringId=...)
  │   └─ Returns: BookableSession[]  ← dates, capacity, pricing
  │
  ├─ User selects session + quantity
  │
  ├─ Booking creation (POST /api/v1/bookings)
  │   └─ Body: { sessionId, participantCount }
  │   └─ Returns: BookingRecord  ← server-authoritative pricing + status
  │
  └─ Post-booking
      └─ Redirect to /bookings/{id} or payment flow
```

### What the frontend owns

- Workshop content rendering (from marketplace payload or fetched detail)
- Session selection UI state
- Participant quantity UI state
- Client-side price estimate (derived from `unitPriceVnd × quantity`)
- Auth gate and redirect flow

### What the server owns

- Session availability and `spotsLeft`
- Pricing (`unitPriceVnd`, `amountVnd`)
- Capacity enforcement
- Booking creation and lifecycle
- Cancellation policy
- Authorization

---

## 9. Acceptance Criteria

### Layout
- [ ] Page renders at 390×844 without horizontal overflow
- [ ] Page renders at 1440px desktop with two-column hero grid
- [ ] All tap targets ≥ 44px
- [ ] No clipped CTAs at any breakpoint
- [ ] Mobile bottom bar appears ≤ 760px, hidden above

### Session selection
- [ ] Sessions fetched from `listBookableSessions()` with `offeringId` or `kind`
- [ ] Sessions grouped by date, sorted chronologically
- [ ] Selected session highlights with white fill
- [ ] Full sessions disabled with "Full" label
- [ ] Capacity shown after selection ("N spots remaining")
- [ ] Urgency color when ≤ 3 spots

### Participant quantity
- [ ] Stepper min = 1, max = `spotsLeft` (clamped to 100)
- [ ] Price estimate updates on quantity change
- [ ] Free workshops show "Free" not a number
- [ ] Null price disables CTA with "Price to be confirmed"

### Booking CTA
- [ ] Clicking "Book workshop" when signed out redirects to `/auth/sign-in?next=...`
- [ ] Loading state shows spinner, disables button
- [ ] Server error shows inline message, re-enables button
- [ ] Success redirects to booking detail or payment page
- [ ] Capacity error suggests choosing another session
- [ ] Sold-out state shows "Sold out" and disables CTA

### Server authority
- [ ] No optimistic booking-success states
- [ ] Price estimate clearly labeled as estimate
- [ ] Server-returned total replaces estimate after booking
- [ ] Session list can be refreshed to get current availability
- [ ] No localStorage or mock data used for booking flow

### Accessibility
- [ ] `aria-live="polite"` on status messages
- [ ] `aria-label` on icon-only buttons (share, save, back)
- [ ] `aria-expanded` on accordion/session picker
- [ ] Focus visible on all interactive elements
- [ ] Skip link or logical tab order through booking panel

---

## 10. Out of Scope for V1

- Workshop creation/editing flow
- Workshop discovery/listing page
- Payment integration (booking creates a `requested` record; payment is a separate phase)
- Reviews section (placeholder only)
- Workshop plan timeline (optional, only if data exists)
- Real-time capacity updates (polling or WebSocket)
- Rescheduling flow (backend exists but not wired to Workshop UI in V1)
- Host dashboard for workshop management

---

*End of Workshop Detail V1 UX Contract*
