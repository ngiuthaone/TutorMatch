# 02 — Feature Implementation Matrix

Status legend: `NOT_FOUND` / `PLANNED_ONLY` / `SKELETON` / `PARTIAL` /
`IMPLEMENTED_UNTESTED` / `IMPLEMENTED_TESTED` / `PRODUCTION_VERIFIED` / `BROKEN` / `UNKNOWN`

`UI` = discover frontend surface (unless noted). `API` = backend route.
`DB` = Supabase schema/RPC. Evidence citations are paths.

## Feature matrix

| Feature | UI | API | Backend | DB | External Service | Tests | Runtime Verified | Status |
|---|---|---|---|---|---|---|---|---|
| Authentication (email/password) | Partial (client-only) | me, auth plugins | real (JWT verify) | auth.users + profiles | Supabase Auth | yes | login client-side only | PARTIAL (client-only, no server gating) |
| User profiles | tutor profile real; others mock | me, public-tutors | real | profiles | — | me.test.ts | — | PARTIAL |
| Learner accounts | auth signup | me | real | profiles | Supabase Auth | yes | — | PARTIAL |
| Tutor accounts | become-a-tutor (partial) | tutor-cv | real | tutor_profiles(+cluster) | — | yes | — | PARTIAL |
| Host accounts | center (real) | admin/marketplace | real | offerings/offering_hosts | — | yes | — | PARTIAL |
| Tutor profiles (CV) | yes (profile/tutor/[name]) | tutor-cv | real | tutor_profiles.. | storage bucket missing | yes | — | PARTIAL (no avatar bucket) |
| Workshop profiles | real | offerings | real | offerings(kind=workshop) | — | yes | — | PARTIAL (TTL gap) |
| Workshop creation | events/new events-live | offerings POST | real | offerings | — | — | — | PARTIAL (events-live real; events iframe) |
| Workshop editing | not fully | PATCH status | real | offerings | — | — | — | PARTIAL |
| Events | events-live real; events iframe-static | offerings(kind=event) | real | marketplace_listings + offerings | — | — | — | PARTIAL |
| Classes | classes real | offerings(kind=class) | real | offerings | — | — | — | IMPLEMENTED_TESTED |
| Courses | iframe-static | marketplace | real (listing) | marketplace_listings | — | — | — | PARTIAL |
| Communities | static/mock | — | none | — | — | — | — | NOT_FOUND (backend) |
| Discussions | localStorage | — | none | — | — | — | — | DEMO/localStorage |
| Articles | localStorage (TipTap) | — | none | — | — | — | — | DEMO/localStorage |
| Discover | partial (home) | marketplace/:kind | real | — | — | — | — | PARTIAL |
| Search | PLACEHOLDER | — | none | — | — | — | — | NOT_FOUND |
| Filtering | partial | — | — | — | — | — | — | PARTIAL |
| Maps/location | none | — | — | — | — | — | — | NOT_FOUND |
| Availability | tutor slots | — | tutor_availability_slots | — | — | — | — | PARTIAL |
| Sessions | real | booking | real | sessions | — | yes | — | IMPLEMENTED_TESTED |
| Bookings | real | booking | real | bookings | — | yes | — | IMPLEMENTED_TESTED |
| Payments (VNPay) | real (start/return) | payments | real | payments cluster | VNPay | yes | sandbox script | IMPLEMENTED_UNTESTED (no prod runtime) |
| Refunds | worker | payments internal | real | refunds | VNPay | yes | — | IMPLEMENTED_TESTED (unit/integration written) |
| Cancellations | real | booking | real | bookings + obligations | — | yes | — | IMPLEMENTED_TESTED |
| Rescheduling | real | booking | real | reschedule_requests | — | yes | — | IMPLEMENTED_TESTED |
| Payouts | — | payouts GET | real (model) | payout-statement (domain) | none | — | — | PARTIAL (model only) |
| Commission | — | — | real (payout-statement) | — | — | yes | — | PARTIAL (model only) |
| Reviews | demo only | — | none | not in prod DB | — | — | — | NOT_FOUND |
| Messaging | static iframe | — | none | — | — | — | — | NOT_FOUND |
| Notifications | localStorage | — | none | — | — | mock tests | — | DEMO only |
| Admin | dashboard routes | admin | real | — | — | — | — | PARTIAL |
| Moderation | — | — | none | — | — | — | — | NOT_FOUND |
| Analytics | — | — | analytics-events domain | — | — | — | — | PLANNED_ONLY |
| Verification (tutor) | — | enable_tutor | real | tutor role path | — | — | — | PARTIAL |
| Media/storage | — | — | none (no bucket) | no bucket | — | — | — | NOT_FOUND |
| Email | auth verify-email UI | — | none | — | Supabase Auth email | — | — | PARTIAL (auth) |
| Webhooks | — | vnpay/ipn | real (open) | provider events | VNPay | — | — | IMPLEMENTED_UNTESTED |
| Background jobs | — | worker | real | outbox + claims | — | yes | — | IMPLEMENTED_TESTED (with TTL gap) |
| Cron | — | worker loop | real | — | — | — | — | IMPLEMENTED_TESTED (TTL gap) |
| Marketplace listings | public-tutors + marketplace | real | real | marketplace_listings | — | yes | — | IMPLEMENTED_TESTED |

## Notes on "yes" evidence

- **Backend booking/payment**: code at `backend/src/domain/*`, `backend/src/services/*`,
  `backend/src/routes/booking.ts`, `payments.ts`, SQL in `backend/supabase/migrations/*`.
- **Frontend real booking libs**: `discover/src/lib/booking-api.ts`,
  `workshop-booking-api.ts`, `tutor-booking-api.ts`, `event-booking-api.ts`,
  `payment-api.ts`, `tutor-cv-api.ts`, `marketplace-api.ts`.
- **Frontend mock/localStorage**: `discover/src/lib/course-data.ts`,
  `event-data.ts`, `for-you-data.ts`, `storage.ts` (tutoria_* keys), `notifications.ts`.

## Biggest gaps visible in the matrix

1. Messaging, reviews, storage buckets, communities, articles, notifications
   have **no production (DB) implementation** — they are static/mock/localStorage.
2. Payments/payouts/refunds are **modeled and code-tested** but **production
   provider runtime is UNKNOWN/unverified**.
3. Backend is far ahead of the frontend for the "social/community" features.
