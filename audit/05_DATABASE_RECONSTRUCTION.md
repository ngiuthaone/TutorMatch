# 05 — Database Reconstruction

Source: `backend/supabase/migrations/` (26 SQL files) + legacy
`backend/schema.sql` + `backend/supabase/seed.sql`. Verified by reading all
migrations and by querying the **running local Supabase** (Docker, project
`backend`, DB :54322). Nothing was modified.

## 1. Two incompatible schema surfaces

- **A. Legacy `backend/schema.sql`** — old demo-era schema: `users` (with
  `password_hash`), `student_requests`, `cases` + `case_status` enum,
  `confirmation_letters`, `reviews`, `messages`, `payments` keyed to cases.
  **Does not match the migration tree.** Not referenced by any loader found.
  Treat as superseded/historical.
- **B. Migration tree (`0001`…`20260820120000`)** — the authoritative
  production schema: `profiles`, tutor CV cluster, `marketplace_listings`,
  `sessions`, `bookings`, `payments`, `refunds`, outbox, `offerings`.
- **C. `data/state.json`** — root SPA demo state (seeded users with plaintext
  passwords; localStorage/`/api/state`). Not production.

## 2. Tables (key ones)

- `profiles` (0001) — id→auth.users, role, name, phone, avatar_url. RLS: owner READ.
- Tutor cluster (0002): `subjects`, `regions`, `tutor_profiles` (+ version CAS),
  `tutor_subjects`, `tutor_levels`, `tutor_regions`, `tutor_languages`,
  `tutor_availability_slots`, `tutor_education_entries`, `tutor_experience_entries`,
  `tutor_profile_events`.
- `marketplace_listings` (0003) — kind course/event, creator_id, payload jsonb.
- Session/Booking cluster (0004+): `sessions`, `bookings` (heavily extended),
  `booking_history`, `reschedule_requests`, `attendance_facts`, `session_history`.
- `event_outbox` (0006) — durable domain events + claim primitives.
- Payment cluster (0008–0012): `booking_approvals`, `payments`,
  `payment_attempts`, `payment_events`, `payment_provider_events`, `refunds`,
  `payment_provider_operations`.
- `booking_create_attempts` (20260815090000) — rate limiter.
- Offering cluster (20260819120000 + 20260820100000): `offerings` (kind:
  tutor/workshop/class/event; pricing_model hourly_v1 / flat_per_participant_v1;
  booking_mode approval/instant), `offering_hosts`.

## 3. Enums

Authoritative: `user_role` (student/tutor/admin), `tutor_publication_status`
(draft/published/unpublished), `teaching_format` (online/in_person/both),
`language_proficiency`. Booking/payment/session/refund **statuses are text
columns with CHECK constraints, not Postgres enums.**

## 4. RLS

- **Every migration table has RLS enabled** (no table without RLS found).
- Only `profiles` and `marketplace_listings` use row policies directly.
  Everything else is **closed-by-default and reached via `SECURITY DEFINER`
  RPCs**. Financial/bookings tables are fully revoked to client roles; workers
  use service_role grants.
- `20260815150540_tutor_authorization_hardening.sql` hardened
  `handle_new_user_profile` to ignore metadata role (always create as student) —
  role elevation only via service_role `enable_tutor`.

## 5. RPCs (SECURITY DEFINER, `search_path=''`)

Groups: auth/role guards (`assert_tutor_caller`, `assert_attendee_caller`,
`assert_verified_booking_caller`, `consume_booking_create_attempt`,
`can_manage_offering`, `assert_host_of_session`), tutor CV CRUD, session
RPCs, booking RPCs (`create_booking` multi-overload), payment/refund RPCs
(service_role), read models (`booking_json`, `booking_read_json`,
`list_bookable_sessions`, `get_bookable_session`, `get_my_*_bookings`),
worker/outbox claims (`claim_pending_events`, `claim_pending_refund_executions`,
`claim_pending_refund_reconciliations`, `claim_pending_payment_finalizations`,
`expire_stale_workshop_bookings`), policy singletons
(`cancellation_refund_cutoff` = 24h, `refund_provider_max_attempts` = 5).

## 6. Outbox

`event_outbox` with event_type CHECK that evolved across 0006→0008→0011
(booking/session/payment aggregates). At-least-once delivery via `FOR UPDATE
SKIP LOCKED` lease claims. **No SQL outbox consumer** — the financial worker
plays that role for payment/refund events; generic event outflow to a real
notification/analytics consumer is NOT present.

## 7. Storage / views / seed

- **No storage buckets** created by any migration (avatar `object_path` exists
  but no bucket provisioned). `avatar_public_base_url` setting referenced.
- **No views.**
- `seed.sql` is empty; only subject/region seed rows in 0002.

## 8. Migration history / drift — CRITICAL

Repo migrations (26 files) vs **applied** migrations on the running local DB:

| Applied locally | In repo | Match |
|---|---|---|
| 0001…0013, 20260814073312…15150540 | present | ✓ |
| 20260820000000, 20260820100000/100001/100002 | present | ✓ |
| **20260819120000 (shared booking engine)** | present | ✗ **NOT tracked as applied**; `offerings` exists but `offering_hosts` does not → **partial/manual apply** |
| **20260820120000 (host authorization consistency)** | present | ✗ **NOT applied** |
| 20260819130000 (referenced by DISCOVERY_INTEGRITY_FIX_REPORT) | **ABSENT from repo** | ✗ not present |

Consequences (verified live):
- `create_booking` has **two overloads** in local DB:
  `(session_id, participant_count)` and `(session_id, participant_count,
  p_idempotency_key)` → PostgREST PGRST203 ambiguity → integration tests fail.
- `finalize_paid_booking(p_booking_id)` only, missing workshop variants.
- Because the local DB cannot be reproduced cleanly from repo migrations, the
  **integration test suite is currently blocked (26 failed / 24 passed / 99
  skipped)**, with failures attributable to stale schema, not necessarily to
  broken application code.

## 9. Relationship model

```
auth.users → profiles → tutor_profiles → (subjects, regions, levels,
              languages, availability, education, experience, events)
            → marketplace_listings
            → offerings ─→ offering_hosts
                          └→ sessions ─→ bookings ─→ booking_history
                                             ├→ reschedule_requests
                                             ├→ attendance_facts
                                             ├→ booking_approvals
                                             ├→ payments → payment_attempts/events
                                             │         → payment_provider_events
                                             │         → refunds
                                             │         → payment_provider_operations
                                             └→ booking_create_attempts
sessions → session_history
write side → event_outbox
```

## 10. Flagged database issues

1. **Migration drift / non-reproducibility** (P1): local DB not reproducible;
   a referenced fix migration absent from repo.
2. **`.bak` migration draft committed** as untracked file next to `20260820100001`
   (risk of confusion; not applied by Supabase).
3. **Two `create_booking` overloads** add ambiguity.
4. No storage bucket for tutor avatars despite schema referencing one.
5. No real outbox consumer for non-payment events.
