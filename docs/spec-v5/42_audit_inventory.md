# 42 — SURFACE INVENTORY & COVERAGE MAP (42-AUDIT)

**Status:** VERIFIED component-by-component audit of `discover/` + `backend/` (28 Aug 2026). Read-only; no code/DB changed.
**Method:** every `discover/src/app/**/page.tsx` (58), `discover/src/components/**/*.tsx` (108), `discover/src/lib/*.ts` (29 non-test), `backend/src/**` (45), and `backend/supabase/migrations/*.sql` (27) mapped to LIVE / DEMO / STATIC-IFRAME and to the v5.0 spec surfaces. Cross-checked with `vitest run` (165 tests pass).

**Purpose:** state the plan's confidence honestly. A surface marked VERIFIED had its implementation inspected against its spec surface; UNVERIFIED means the claim in the spec could **not** be confirmed from the inspected artifact. This map is the authority for which spec surfaces are grounded.

---

## 42.1 The one production-critical, confirmed UX gap

> **The booking flow does not collect any customer contact (phone/email).**
> - `create_booking(session_id, participant_count, p_idempotency_key)` — NO phone/contact param (`20260820100001_workshop_booking_v1_rpcs.sql:9-13`; original 2-arg `0005_create_booking_session_rpcs.sql:163`).
> - `bookings` table columns: `id, session_id, learner_id, participant_count, status, rescheduled_from_session_id, cancelled_reason, cancelled_by, cancelled_by_session_id, version, created_at, updated_at` — **no phone/contact column** (`0004_create_sessions_and_bookings.sql:23-35`).
> - `phone` exists ONLY on `profiles` (`0001_create_profiles.sql:11,16`) and is never collected at booking time.
> - Frontend `createBooking(sessionId, participantCount)`/`createWorkshopBooking(...)` send no contact (`booking-api.ts:177`, `workshop-booking-api.ts`).
> - The tutor profile booking is a postMessage bridge into a 3,425-line static iframe (`tutor-profile-frame.tsx:162-213` → `/public/tutor-profile-exact.html`); price falls back to `hourlyRateVnd || 0` (`tutor-profile-frame.tsx:121`).

**Impact:** a host/tutor cannot reach the learner after booking → blocks ordering/confirmation. This is a **P0 production-readiness gap**, not cosmetic.

## 42.2 Surface → live/demo/static → spec coverage

| # | Surface | Live (backend/Supabase) | Demo (localStorage/static) | Spec surface | Coverage |
|---|---|---|---|---|---|
| 1 | Booking (create/list/cancel) | ✅ (`booking-api`, `/bookings`, `bookings/page.tsx`) | — | `06_learner`, `11_api_contract`, `25_impl_requirements` | **VERIFIED** |
| 2 | Payments (VNPay) | ✅ (`payment-api`, `payment-return-view`, backend routes+adapter+workers) | — | `16_payment_contract`, `17_worker_async` | **VERIFIED** |
| 3 | Workshops / classes / events-live (list+detail) | ✅ `listBookableSessions`/`listBookableEvents` | card **images** are picsum placeholders | `01_workshop`, `08_events_classes_courses` | **VERIFIED** (image placeholder = UNVERIFIED visual) |
| 4 | Tutor Center | ✅ iframe→postMessage bridge (`center.html`) | fallback `tutoria-center-demo` | HOST surfaces | **VERIFIED** |
| 5 | Auth (sign-in/up, verify-email, update-password, callback, require-auth) | ✅ real Supabase | demo paths | `00_auth`, `15_security` | **VERIFIED** (several UX gaps, §42.3) |
| 6 | Tutor onboarding (`/become-a-tutor`) | ✅ PUT `/api/v1/me/tutor-cv` | localStorage | `10_admin_analytics`/tutor-cv | **VERIFIED — LIVE DATA LOSS** (§42.3) |
| 7 | Tutor profile (`/tutor/[name]`) | ✅ `getTutor`/`listBookableSessions` | iframe shell + `|| 0` price | `40_uiux_tutor_profile` | **VERIFIED** |
| 8 | Learner profile `/user/[name]` | ❌ hardcoded + localStorage | ✅ | social surfaces | **VERIFIED (demo)** |
| 9 | Profile versions `/u /v2..v15` | ❌ all re-export one hardcoded demo | ✅ | — | **VERIFIED (13 dead alias routes)** |
| 10 | Posts/Articles/Comments/Courses publish | ❌ localStorage (`storage.ts`, `course-data.ts`) | ✅ | content-creation | **VERIFIED (not production)** |
| 11 | Notifications | ❌ localStorage in BOTH modes | ✅ | `18_events_notifications` | **VERIFIED (not production)** |
| 12 | Communities, discussions, people, saved, search, for-you, skills | ❌ hardcoded arrays | ✅ | `09_social_messaging_notifications` | **VERIFIED (demo)** |
| 13 | `/courses /events /messages /learning /people` | ❌ static reference iframes | ✅ | — | **VERIFIED (demo references)** |
| 14 | Backend Fastify services/routes/migrations | ✅ (booking/payment/payout/compliance/tutor-cv/workers) | — | `11`-`20`, `12_backend_service`, `13_database`, `14_rpc` | **VERIFIED (spot; see §42.4)** |

## 42.3 High-value UX/production findings

Ranked (file:line evidence):

1. **P0 — no customer contact collected at booking** (see §42.1).
2. **High — live-mode onboarding data loss:** only ~10 of ~40 collected fields persist to the backend (`tutor-onboarding.tsx:692-726` vs `tutor-cv-mapper.ts:162-220`); photo/video/credentials/FAQs/policies/consultation/visibility silently dropped, no warning.
3. **High — sign-up wizard is decorative in live mode:** roles/interests/preferences never persisted when live (`sign-up-flow.tsx:96-118`).
4. **High — RequireAuth infinite spinner + wrong copy + query-state loss:** `unavailable` → permanent spinner (`require-auth.tsx:38-44`, `gate.ts:22-24`); "Loading your messages…" on non-messages pages (:`41`); redirect keeps `pathname` only, drops `?slot=` state (:`21`).
5. **High — notifications are localStorage in live mode too:** live bell always 0, no sync (`notification-center.tsx`, `notifications.ts:26-28`).
6. **Med — dead links:** `/saved`, `/dashboard`, `/settings`, `/help`, `/terms`, `/privacy` (`user-menu.tsx:70-75`, `sign-in-form.tsx:235-237`); Create-menu + mobile Notifications + "Become a Creator" inert (`create-menu.tsx:73-82`, `mobile-navigation.tsx:145-158`).
7. **Med — 13 dead `/v3..v15` profile routes + inert Follow/Message buttons** (`community-user-profile.tsx:481`) + verified badge shown for all profiles (:`468`).
8. **Med — avatar/rating/reviews/lessons all hardcoded 0 or initials on live tutor profile** (`tutor-profile-frame.tsx:115-118`); backend `BackendTutorProfile` has NO photo field (`tutor-cv-api.ts:49-63`).
9. **Med — `hourlyRateVnd || 0` price fallback** = tutor without a rate appears FREE (`tutor-profile-frame.tsx:121`, mapper `:164-168`).
10. **Med — require-auth/onboarding `unavailable` + publish `UNAUTHORIZED` dead-ends** with no actionable retry/sign-in (`tutor-onboarding.tsx:714-715,919-921`).
11. **Med — inconsistent password policy (8 vs 12) + weak email validation + no confirm-password** (`sign-up-flow.tsx:43-46`, `update-password`/`password.ts:1-5`).
12. **Low — sanitizer is client-only allowlist; render-path coverage UNVERIFIED.**
13. **Low — demo ID can masquerade as signed-in in live header** (`discover-header.tsx:58`).

## 42.4 Spec-coverage truth labels

- **Total route-files:** 58; **components:** 108; **lib:** 29 (+~20 tests); **backend src:** 45; **migrations:** 27; **static demo html:** 12 (+2 root SPA).
- Spec surfaces pages (`01_workshop` … `40/41_uiux`) map 1:1 to inventory rows above. Every row is labeled VERIFIED or UNVERIFIED by actual read.
- **Remaining UNVERIFIED** (checked, not groundable from repo alone): Supabase project-side settings (OAuth/callback allowlists, email templates, RLS), sanitizer render-path full coverage, `/skills`→topic filtering (target is a static iframe), any live notifications producer.
- **Not production (spec must not claim otherwise):** posts, articles, comments, course publish, event publish (writes `data/published-events.json`, not a DB), communities, discussions, people, saved, search, profile versions — all localStorage/static.

## 42.5 Plan implication

The comprehensive plan must sequence these into phases, highest first:
- **P0:** contact capture at booking (RPC + `bookings` column + form) + server-total price (never `||0`).
- **P1:** live-mode onboarding/sign-up persistence parity; require-auth robustness; notifications out of localStorage.
- **P2:** native tutor booking component (replace iframe), profile data completeness (photo/rating), dead-link/route cleanup.
- **P3:** demo/social surfaces (posts/articles/courses/events/communities) promoted or explicitly deferred as not production.

## 42 RTM (audit traceability)

| Audit ID | Finding | Evidence (file:line) | Spec anchor | Status |
|---|---|---|---|---|
| AUD-001 | No phone/contact at booking | RPC `:9-13`, table `:23-35`, `booking-api.ts:177` | `TUT-UX-002`, `BOOK-UX-002`, `GAP-023` | VERIFIED |
| AUD-002 | Price `|| 0` → free | `tutor-profile-frame.tsx:121` | `TUT-UX-003` | VERIFIED |
| AUD-003 | Onboarding live data loss | `tutor-onboarding.tsx:692-726`, `tutor-cv-mapper.ts:162-220` | `10_admin_analytics` | VERIFIED |
| AUD-004 | Sign-up wizard decoration | `sign-up-flow.tsx:96-118` | `00_auth` | VERIFIED |
| AUD-005 | RequireAuth spinner/copy/query-loss | `require-auth.tsx:38-44,:41,:21` | `00_auth` | VERIFIED |
| AUD-006 | Notifications localStorage live | `notification-center.tsx`, `notifications.ts:26-28` | `18_events_notifications` | VERIFIED |
| AUD-007 | Dead links CTAs | `user-menu.tsx:70-75`, `create-menu.tsx:73-82` | route registry | VERIFIED |
| AUD-008 | Profile version sprawl + inert CTAs | `user-profile*.tsx` re-exports, `community-user-profile.tsx:481,:468` | `09_social_messaging_notifications` | VERIFIED |
| AUD-009 | Live profile data gaps (photo/rating) | `tutor-profile-frame.tsx:115-118`, `tutor-cv-api.ts:49-63` | `40_uiux_tutor_profile` | VERIFIED |
| AUD-010 | Sanitizer render coverage | `sanitize.ts` allowlist | `15_security` | UNVERIFIED |
