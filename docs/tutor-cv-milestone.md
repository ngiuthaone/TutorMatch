# Secure tutor CV milestone

Tutors can save a draft, preview it, publish it immediately, edit a published CV, and unpublish it. “Published” means only that the tutor chose to make the profile public. Tutoria does not verify identity, education, experience, or qualifications, and there is no admin approval step.

The production SPA uses `GET/PUT /api/v1/me/tutor-cv`, `POST /api/v1/me/tutor-cv/publish`, `POST /api/v1/me/tutor-cv/unpublish`, `GET /api/v1/tutors`, and `GET /api/v1/tutors/:id`. It never reads or writes tutor CVs through `/api/state`, browser ownership, role metadata, or localStorage. Demo data remains explicitly local-demo-only and is never mixed into an API error state.

## Data and security

Migration `backend/supabase/migrations/0002_create_tutor_cvs.sql` creates the profile, normalized subject/level/region/language/availability/education/experience tables, publication audit events, reference data, indexes, RLS, and narrow RPC functions. Owner functions derive the user exclusively from `auth.uid()`, re-check `profiles.role = tutor`, replace children atomically, and increment an optimistic `version`. Public functions return only published records and explicit public fields. They never return `user_id`, email, phone, exact address, avatar object paths, auth metadata, versions, or audits.

All public text is plain text. Central backend and database validators conservatively reject email, phone, URL, common messaging-app, and social-handle patterns. Detection is imperfect; abuse reporting and moderation remain future work. Published profiles must remain complete after every save. Cursor order is `published_at DESC, id DESC`; cursors are opaque and limits are bounded.

No ID cards, passports, certificates, diplomas, transcripts, criminal records, biometrics, credential files, or verification-provider data are collected. No tutor-controlled verification or approval field exists. The mandatory disclosure is fixed by the API/UI and cannot be edited by tutors.

## Supabase setup

1. Apply `0001_create_profiles.sql`, then `0002_create_tutor_cvs.sql` with `supabase db push` or the SQL editor.
2. Inspect database function grants and confirm anonymous/authenticated direct INSERT, UPDATE, and DELETE on every tutor table fail.
3. Test student denial, tutor draft save, publish, anonymous list/detail, unpublish, and hidden detail.
4. Run local integration tests using the local-only variables documented in `backend/README.md`; the guard refuses non-local Supabase hosts.
5. Confirm browser configuration contains only the Supabase publishable key and no service-role/secret key.

Avatar storage was intentionally omitted. The avatar remains optional and the UI uses initials. A future storage change must use a dedicated `tutor-avatars` bucket, JPEG/PNG/WebP only, 5 MB maximum, server-generated owner paths, post-upload metadata confirmation, and owner-folder Storage RLS. Never create a credential bucket or accept external avatar URLs.

Use the returned `version` for every later save/publish/unpublish. A stale version returns `409 PROFILE_VERSION_CONFLICT`; an incomplete publish returns `422 TUTOR_CV_INCOMPLETE`. Browse with `GET /api/v1/tutors?subject=mathematics&format=online&limit=12`, then pass `nextCursor` unchanged. Detail URLs use the public profile UUID, not an Auth user ID.

## Limits

This milestone does not add moderation/reporting, verification, reviews, ratings, booking, messaging, payments, matching, or introduction video. Contact detection needs ongoing abuse tuning. In-memory rate limiting requires a distributed store before horizontal scaling. Privacy, retention/deletion, monitoring, backup/restore, and a full security review remain required before the whole marketplace can be considered production-ready.
