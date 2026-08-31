# 07/09 — SOCIAL, MESSAGING, NOTIFICATIONS, LEARNING, REVIEWS, PROFILES, PHOTOBOOTH (SOC / MSG / NOTIF / LRN / REV / PROF / SCH)

**Surface:** communities, discussions, articles, messaging, learning center, reviews, profiles/avatars, photobooth.
**Alpha status:** Post-Alpha (`PURPLE`) except where noted (transactional notifications `NOTIF-010`, public profile `PROF-*` seed, avatar upload when storage provisioned).
**Primary evidence:** routes exist as `communities`, `discussions`, `articles`, `messages`, `learning`, `profile`, `people`, `u`, `user`, `year-review`, `become-a-tutor`, photobooth (global). Mostly mock/localStorage/embed.

---

## 09.1 Social (communities/discussions/articles) — POST-ALPHA

- `SOC-010` — Communities: server-authoritative membership + RLS; moderation surfaces; no client-fabricated membership.
- `SOC-011` — Discussions: threaded, moderated, RLS-gated by community.
- `SOC-012` — Articles/CMS: authored publishing workflow; distinct authoring surface; RLS.

## 09.2 Messaging — PROMOTED to ALPHA (1:1 booking-context core) via `DEC-015`

- `MSG-010` — Direct host↔learner context messages; server-authoritative conversation+membership+RLS; idempotent send; moderation. (Reuse `18_events_notifications.md` `MSG-*`.). **`DEC-015` RESOLVED (31 Aug 2026):** promotes the direct 1:1 host↔learner message core to Alpha. Groups/communities, file/attachment storage, polls/tasks/announcements, and realtime push (WebSocket/SSE) remain Post-Alpha (`DEC-015`, `AC-EVT2-003`, `NOTIF-011`).

## 09.3 Notifications — ALPHA: transactional only

- `NOTIF-020` — Transactional notification derived from `event_outbox` (`EVT2-*`/`NOTIF-010`). In-app realtime + push Post-Alpha.

## 09.4 Learning Center — POST-ALPHA (with ALPHA booking tab)

- `LRN-010` — Full LMS (courses/content/progress) Post-Alpha.
- `LRN-011` — The learner-facing "My learning" booking list (upcoming/past sessions) can be surfaced at Alpha via `LEARN-*`/`06_learner.md`; full learning content is deferred.

## 09.5 Reviews — POST-ALPHA default (RECORDED, not signed off)

- `REV-010` — Reviews after completed sessions. Domain/policy `DEC-*` (rating scale, eligibility, moderation, incentivization). Alpha does **not** ship reviews unless `DEC-*` promotes them; the review architecture must attach to the booking/session domain, never to a parallel model.

## 09.6 Profiles & avatars

- `PROF-010` — Public profile (avatar, bio, name) Alpha-seeded via storage when bucket provisioned (`19_storage.md`). Full rich profiles Post-Alpha.
- `PROF-011` — Privacy: never expose auth id/private contact/exact address in public profile (`SEC-010`).

## 09.7 Photobooth — POST-ALPHA

- `PROF-020`/photobooth — production infra `TDEC-*`; clearly demo until then.

## 09.8 ACCEPTANCE CRITERIA

- `AC-SOC-001` — Deferred social surfaces never take real money/identity and are labeled appropriately.
- `AC-SOC-002` — No review built on a parallel model; reviews attach to booking/session domain.
- `AC-SOC-003` — Transactional notifications derive from events; realtime/messaging deferred.
- `AC-SOC-004` — Public profiles never leak private data.

---

## 09 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| SOC-010..012 | communities/discussions/articles | — | — | `AC-SOC-001` | SCOPE-004 |
| MSG-010 | messaging (1:1 booking-context promoted via `DEC-015`) | — | — | `AC-SOC-003` | DEC-015 |
| NOTIF-020 | transactional notif | events→notif | `TST-notif` | `AC-SOC-003` | EVT2/NOTIF |
| REV-010 | reviews domain | — | — | `AC-SOC-002` | DEC-* |
| PROF-010/011 | profiles+privacy | storage+api | `TST-leak` | `AC-SOC-004` | SEC-010 |
