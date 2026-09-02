# Tutoria Center — Data Sources

Status: P0/P1 in progress · Last update: 2026-09-02

For every Center screen, this document records: data source, API/RPC, database table(s), authorization rule, loading state, error state, empty state.

**Rule:** No Center screen may depend on localStorage, fixture JSON, or hardcoded values as authoritative state. Every value the Center displays must trace to a Supabase table via a `SECURITY DEFINER` RPC that re-checks `can_manage_offering`.

---

## Index

1. Overview (`page-home`)
2. Bookings (`page-bookings`)
3. Offerings / Listings (`page-listings`)
4. Calendar / Sessions (`page-calendar`)
5. Learners / Attendees (`page-learners`)
6. Earnings (`page-earnings`)
7. Analytics (`page-analytics`)
8. Quality & Trust (`page-quality`)
9. Check-in (P1 — new surface)
10. Marketing / Partners / Opportunities (`page-marketing`, `page-partners`, `page-opportunities`)
11. Settings / Academy (deferred P2)

---

## 1. Overview (`page-home`)

| Field | Value |
| --- | --- |
| **Data source** | Supabase RPC `public.get_host_dashboard(p_user_id)` |
| **Route** | `GET /api/v1/host/dashboard` |
| **Tables read** | `public.offerings`, `public.offering_hosts`, `public.sessions`, `public.bookings`, `public.payments`, `public.refunds`, `public.tutor_profiles`, `public.attendee_engagement_summaries` (if present) |
| **Authorization** | `auth.uid() = p_user_id OR auth.uid() IN (admin profiles)`; if user has zero managed offerings, returns `{ isHost: false }` |
| **Loading state** | Center skeleton (4 KPI tiles + 3 to-do cards + 1 chart placeholder) |
| **Error state** | Amber banner: "Tutoria Center is temporarily unavailable." with retry button |
| **Empty state** | "Welcome to Tutoria Center. Create your first offering to start receiving bookings." with CTA → `/become-a-tutor` or `/listings/new` |

Server-computed values returned: `todayCount`, `upcomingCount`, `monthEarningsVnd`, `monthCompletedCount`, `pendingBookingsCount`, `rating { count, average }`, `tutorProfile { id, displayName, headline, publicationStatus, hourlyRateVnd }`. **No client-side aggregation.**

---

## 2. Bookings (`page-bookings`)

| Field | Value |
| --- | --- |
| **Data source** | Existing RPC `public.get_my_host_bookings()` (returns host's bookings across all offerings they manage) |
| **Route** | `GET /api/v1/me/tutor-bookings` (existing) — to be aliased at `GET /api/v1/host/bookings` in a follow-up |
| **Tables read** | `public.bookings`, `public.sessions`, `public.offerings`, `public.profiles` |
| **Authorization** | RPC is `SECURITY DEFINER`; uses `can_manage_offering` per booking's offering |
| **Mutations** | `POST /api/v1/tutor/bookings/:id/cancel` (existing); `POST /api/v1/workshops/:id/cancel` (existing) — both kept, host aliases added in P1 |
| **Loading state** | Table rows replaced with 6 skeleton rows |
| **Error state** | Inline "Could not load bookings. Retry" with refresh action |
| **Empty state** | "No bookings yet." |

Filters the prototype applies client-side (status, type, date) must become server-side query parameters in P1 (`?status=requested&kind=workshop&from=&to=`). Until then, filter in-memory after the RPC returns the host's complete bookings list (which is bounded by `limit 200`).

---

## 3. Offerings / Listings (`page-listings`)

| Field | Value |
| --- | --- |
| **Data source** | New RPC `public.list_host_offerings(p_user_id, p_status, p_kind, p_limit, p_offset)` |
| **Route** | `GET /api/v1/host/offerings` |
| **Tables read** | `public.offerings`, `public.offering_hosts`, aggregate counts from `public.sessions` and `public.bookings` |
| **Authorization** | Filters to offerings where `offering_hosts.user_id = p_user_id` and `revoked_at is null`; admin sees all |
| **Loading state** | Table skeleton |
| **Error state** | Amber banner |
| **Empty state** | "You haven't created any listings yet. Create your first offering." |

Returned shape per row:
```
{
  id, kind, slug, title, publicationStatus, unitPriceVnd, currency,
  sessionCount, bookingCount, lastSessionAt, createdAt, updatedAt
}
```

Single-offering detail: `GET /api/v1/host/offerings/:id` → `public.get_host_offering(p_user_id, p_offering_id)`.

---

## 4. Calendar / Sessions (`page-calendar`)

| Field | Value |
| --- | --- |
| **Data source** | New RPC `public.list_host_sessions(p_user_id, p_from, p_to, p_offering_id, p_status, p_limit, p_offset)` |
| **Route** | `GET /api/v1/host/sessions` |
| **Tables read** | `public.sessions`, `public.offerings`, `public.offering_hosts`, `public.bookings` (counts) |
| **Authorization** | Joins on `can_manage_offering(actor, offering_id, 'host')` |
| **Loading state** | Month grid skeleton |
| **Error state** | Inline banner with retry |
| **Empty state** | "No sessions scheduled for this period." |

Returned shape per row:
```
{
  id, offeringId, offeringTitle, offeringKind,
  startsAt, endsAt, status,
  minParticipants, maxParticipants, bookedCount, remainingCapacity
}
```

`bookedCount` = active bookings (`status IN ('requested','confirmed','completed')`).
`remainingCapacity` = `max_participants - bookedCount` (clamped ≥ 0).

---

## 5. Learners / Attendees (`page-learners`)

| Field | Value |
| --- | --- |
| **Data source** | New RPC `public.list_host_attendees(p_user_id, p_query, p_offering_id, p_limit, p_offset)` |
| **Route** | `GET /api/v1/host/attendees` |
| **Tables read** | `public.bookings`, `public.sessions`, `public.offerings`, `public.profiles` |
| **Authorization** | Only learners whose bookings touch offerings the host manages; aggregate via DISTINCT on `learner_id` |
| **Loading state** | Table skeleton |
| **Error state** | Inline banner |
| **Empty state** | "No learners have booked your offerings yet." |

Returned shape per row:
```
{
  learnerId, displayName, avatarObjectPath,
  bookingsCount, completedCount, lastBookingAt,
  upcomingCount, ltvVnd, currency
}
```

---

## 6. Earnings (`page-earnings`)

| Field | Value |
| --- | --- |
| **Data source** | New RPC `public.get_host_earnings(p_user_id, p_from, p_to)` |
| **Route** | `GET /api/v1/host/earnings` |
| **Tables read** | `public.payments`, `public.refunds`, `public.bookings`, `public.sessions`, `public.offerings`, `public.offering_hosts` |
| **Authorization** | Server filter: bookings must point to offerings `can_manage_offering(actor, offering_id, 'host')` |
| **Loading state** | Card skeleton |
| **Error state** | Inline banner with retry |
| **Empty state** | "No earnings yet. Payouts will appear here once your bookings are completed." |

Returned shape (single document):
```
{
  currency: 'VND',
  totals: {
    grossVnd, refundedVnd, hostFeeVnd, hostNetVnd,
    pendingVnd, paidVnd
  },
  transactions: [
    { bookingId, paymentId, occurredAt, amountVnd, refundedAmountVnd, status }
  ]
}
```

`hostFeeVnd` is derived server-side as a placeholder `0` until the commission engine is wired; the field is present and accounted for in the schema so the UI doesn't have to assume the value client-side. When the engine ships, the field changes without UI changes.

**No client-side aggregation.** All numbers come from `payments.amount_vnd - payments.refunded_amount_vnd` joins.

---

## 7. Analytics (`page-analytics`)

| Field | Value |
| --- | --- |
| **Data source** | New RPC `public.get_host_analytics(p_user_id, p_from, p_to)` (P1) |
| **Route** | `GET /api/v1/host/analytics` |
| **Tables read** | `public.bookings`, `public.sessions`, `public.offerings`, `public.payments` |
| **Authorization** | Host-scoped via `can_manage_offering` |
| **Loading state** | Chart skeleton |
| **Error state** | Inline banner |
| **Empty state** | "Not enough data yet — analytics appear after your first session completes." |

Returned shape:
```
{
  totals: { bookings, revenueVnd, cancelled, completed, attendees },
  daily: [ { day, bookings, revenueVnd } ],
  topOfferings: [ { offeringId, title, bookings, revenueVnd } ],
  capacityUtilization: { averagePct, sessionsBelowMin: number }
}
```

Until the P1 RPC ships, the analytics page renders server-computed values from `get_host_dashboard` only — not fabricated numbers.

---

## 8. Quality & Trust (`page-quality`)

| Field | Value |
| --- | --- |
| **Data source** | Existing `public.get_tutor_rating_summary(tutor_id)` for rating; cancellations + completions derived in `get_host_dashboard` |
| **Route** | `GET /api/v1/host/dashboard` (rating field); no dedicated route yet |
| **Tables read** | `public.tutor_reviews`, `public.bookings` |
| **Authorization** | Same as dashboard |
| **Loading state** | Score tile skeleton |
| **Error state** | Inline banner |
| **Empty state** | "No reviews yet." |

Score computation rules (server-side only):
- `rating` = average from `tutor_reviews` (existing function)
- `response` / `cancel` / `completion` / `refund` metrics: derived from `bookings.status` history until dedicated `host_quality_metrics` table is added (P2)

---

## 9. Check-in (P1 — new surface)

| Field | Value |
| --- | --- |
| **Data source** | New tables `public.tickets`, `public.check_in_tokens`, `public.check_in_logs`; RPCs `public.issue_check_in_token`, `public.redeem_check_in_token`, `public.undo_check_in`, `public.list_session_check_in_logs` |
| **Routes** | `POST /api/v1/host/check-in/tokens`, `POST /api/v1/host/check-in/redeem`, `POST /api/v1/host/check-in/undo`, `GET /api/v1/host/check-in/logs` |
| **Tables read/written** | `public.tickets` (1-1 with `public.bookings`), `public.check_in_tokens` (1-many with tickets), `public.check_in_logs` (append-only) |
| **Authorization** | Issue: host via `can_manage_offering(actor, offering_id, 'host')`. Redeem: any authenticated host who passes the session-scoped authorization; tokens expire; duplicate redemption is a no-op that returns the existing log (idempotent). Undo: original actor or admin |
| **Loading state** | Scan page skeleton |
| **Error state** | Inline banner with retry; specific codes: `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_NOT_FOUND`, `BOOKING_NOT_CONFIRMED`, `SESSION_MISMATCH` |
| **Empty state** | "Scan a QR code or search attendees by name." |

Token format: 32-byte random `base64url` value; we store `sha256(token)` in `check_in_tokens.token_hash` (the raw value never persists). The token resolves server-side to the ticket, then to the booking, then to the session. The QR encodes only the token — **never** any user-identifying info.

Duplicate scan protection: `redeem_check_in_token` performs a single SQL transaction:
1. `INSERT INTO check_in_logs (...) ON CONFLICT (ticket_id, outcome='attended') DO NOTHING RETURNING *`
2. If conflict: `SELECT` the existing log and return its outcome. **Idempotent.**

---

## 10. Marketing / Partners / Opportunities (`page-marketing`, `page-partners`, `page-opportunities`)

These pages render fixture-only content today. They will keep rendering placeholder content (no fake numbers) until the corresponding backend is implemented in P2.

`page-opportunities` will be backed by `public.list_host_opportunities(p_user_id)` which derives insights from real data (sessions below `min_participants`, low conversion offers, high-demand search terms once `analytics_events` are wired). Until then, the page renders a "Coming soon" panel instead of fake numbers.

---

## 11. Settings / Academy (deferred P2)

Settings tabs render placeholder copy. No fake data. The Account tab will reuse `GET /api/v1/me` (existing). Branches/team/security tabs are deferred to P2 — they require new tables (`host_branches`, `host_team_members`, `host_team_permissions`) and a permission check primitive beyond `can_manage_offering`.

Academy is a static content surface and remains placeholder-only until the curriculum ships.

---

## Authorization matrix (recap)

| Screen | Authorization rule | Server-side check |
| --- | --- | --- |
| Overview | Self (or admin) | `auth.uid() = p_user_id OR admin` |
| Bookings | Host of offering | `can_manage_offering(actor, offering_id, 'host')` |
| Offerings | Owner/host | `can_manage_offering(actor, offering_id, 'host')` |
| Calendar | Host | same |
| Learners | Host | same |
| Earnings | Owner/host | same |
| Analytics | Host | same |
| Quality | Self | `auth.uid() = p_user_id OR admin` |
| Check-in issue | Host | `can_manage_offering(actor, offering_id, 'host')` |
| Check-in redeem | Host of session | `can_manage_offering(actor, offering_id, 'host')` |
| Check-in undo | Original actor or admin | application check |

Hosts **cannot** access another host's data — enforced server-side in every RPC; the iframe bridge and the native pages cannot bypass this because they only call these RPCs through the bearer-token-authenticated route layer.

---

## Loading / error / empty state implementation

Every page in `center.html` already has skeleton, error, and empty states defined in the prototype. The bridge layer in `discover/src/app/center/page-client.tsx` already emits `tutoria-center-{resource}-error` postMessages on failure and `tutoria-center-demo` in demo mode. We extend the bridge to also pass through `loading` (initial state) and `empty` (no rows) signals — but the prototype's `if (!data) loading` branches already cover this; we only need to ensure `data` is the empty array (not undefined) when there are no rows.

---

## What we deliberately did NOT add

- localStorage caches for any Center data (auth token caching is the only client-side persistence; it stays in `discover/src/lib/auth/session.ts` and is not Center data).
- Hardcoded `₫` currency strings — the prototype uses `Intl.NumberFormat("vi-VN")` for display, but the source value comes from `payments.amount_vnd` and `unit_price_vnd`.
- Mock user names — Linh Nguyen, Mai Anh, etc. from the prototype are removed wherever a real data path exists. They remain only on the Settings → Team page, which is explicitly placeholder content until P2.