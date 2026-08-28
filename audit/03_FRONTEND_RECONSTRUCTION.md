# 03 — Frontend Reconstruction

Surfaces: `discover/` (Next.js 16.2.10) is the primary; the root `src/` auth
layer and the legacy root SPA are secondary. Derived by reading route files,
`discover/src/lib/*`, and running the test/lint/build suite.

## discover route inventory & classification

Legend: REAL = calls backend API; MOCK = hard-coded data; IFRAME-STATIC = serves
a static HTML sheet; LOCALSTORAGE = demo persistence; ORPHAN = not nav-linked.

| Route | Component | Data source | Class |
|---|---|---|---|
| `/discover` | DiscoverHome | mixed (mock for-you + real session fetch) | MIXED |
| `/discover/for-you` | ForYouPage | for-you-data.ts | STATIC-MOCK |
| `/workshops`, `/workshops/[slug]` | WorkshopsListing / WorkshopDetailPage | marketplace-api + booking-api | REAL |
| `/classes`, `/classes/[slug]` | ClassesListing / ClassDetailPage | marketplace-api + booking-api | REAL |
| `/events`, `/events/new` | EventsEmbed / EventNewFrame | iframe events-exact.html, event-creator-reference.html | IFRAME-STATIC |
| `/events-live`, `/events-live/[slug]` | EventsLiveListing / EventDetailPage | event-booking-api | REAL |
| `/people` | PeopleBrowser | iframe browse-tutors.html | IFRAME-STATIC |
| `/profile/[name]`, `/tutor/[name]` | TutorProfileFrame | tutor-cv-api + booking-api | REAL |
| `/courses**` | CoursesEmbed / CourseProfileFrame | iframe courses-reference.html, course-profile.html | IFRAME-STATIC |
| `/bookings` | BookingsPage | booking-api | REAL |
| `/payments/return` | PaymentReturnView | polls booking state | REAL |
| `/center` | CenterPage + iframe | postMessage bridge → tutor-booking-api, tutor-workshop-booking-api | REAL |
| `/become-a-tutor` | TutorOnboarding | supabase gate + form | PARTIAL |
| `/messages` | iframe messages-exact.html | static | IFRAME-STATIC (not implemented) |
| `/learning**` | iframe learning-exact.html | static | IFRAME-STATIC |
| `/discussions**` | PostsPage/Saved/Tag/ArticleView | localStorage | DEMO-local |
| `/communities` | CommunitiesPage | mock + filter | STATIC-MOCK |
| `/articles**` | Article editor (TipTap) | localStorage | DEMO-local |
| `/search` | SearchResults | placeholder | NOT_FOUND |
| `/skills`, `/year-review` | static | static demo | ORPHANED-demo |
| `/u`, `/user`, `/v3`–`/v15` | UserProfile / re-exports | hard-coded mock + localStorage follow | ORPHANED-mock |
| `/auth/*` | auth components | Supabase live + localStorage demo | dual-mode |

## Data source provenance (lib/)

- **Real `/api/v1` backend (Bearer):** `booking-api`, `tutor-booking-api`,
  `tutor-workshop-booking-api`, `event-booking-api`, `workshop-booking-api`,
  `payment-api`, `tutor-cv-api`, `marketplace-api`.
- **Supabase (auth only in this app):** `lib/auth/*`.
- **Session:** storage keys *tutoria-*`, demo users, mock notifications,
  discussions/articles, following.

## Key findings

1. **Auth client-side only.** `RequireAuth` client gate; bypasses in demo mode;
   **no Next middleware/route-handler server protection** for `/center`,
   `/bookings`, etc. Backend APIs are authoritative (Bearer), but pages are
   client-reachable.
2. **Booking completion flow broken.** After `createBooking` in
   `workshop-detail-page.tsx:214`, app does `window.location.assign('/bookings/${id}')`
   but **no `/bookings/[id]` route exists** → 404 (verified glob; bookings/ only
   has `page.tsx`).
3. **Messaging not implemented** — `/messages` static iframe; no conversations lib.
4. **Notifications localStorage even in live mode** — `lib/notifications.ts`
   reads `tutoria_notifications_{mode}_{userId}` always.
5. **Many iframe/mock shells** for courses/events/people/messages/learning.
6. **v3–v15 + u/user/year-review/skills/search** are unlinked demo/iteration
   artifacts (`page.tsx` re-exporting shared profiles).
7. **Lint fails**: on `src/**` only → **42 errors + 100 warnings** (react-hooks
   set-state-in-effect, no-explicit-any, no-unescaped-entities). `eslint.config.mjs`
   ignores `.next/**` but **not `.vercel/output/**`, so compiled launcher `.cjs`
   files are linted (~26 more errors). TypeScript `tsc --noEmit` passes.
8. **Build succeeds** — `npm run build` completed (57 routes emitted).

## Frontend test results

`pnpm test` (vitest): **165/165 PASS** (25 files). `npm run build`: PASS.

## Root SPA / `src/` frontend

- `src/auth/*` real Supabase client + `/api/v1` API client (bundled auth.bundle.js).
- Root `app.js` runs full demo when `demoMode:true`; when `demoMode:false` only
  auth + tutor-CV are real; chat/booking/payment/messaging are stubs
  (`alert("...next backend milestone.")`).

## Bottom line

The discover shell and the booking/workshop/class/event/tutor surfaces are real;
the social/community/content surfaces are demo/iframe/localStorage; the booking
completion redirect and workshop TTL are broken; messaging is absent.
