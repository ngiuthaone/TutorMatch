# Tutoria Center — Repo Leverage Map

Status: P0 in progress · Last update: 2026-09-02

This document records what was learned and reused from each reference repository, what we built ourselves, and why. Per Tutoria's OSS policy, every external repository is inspected only as much as needed to inform Tutoria-native design. We do not copy source code without license clearance; we mine patterns, then implement them on Tutoria's existing backend primitives.

---

## Reference repositories inspected

| Repo | URL | License | Classification | Action |
| --- | --- | --- | --- | --- |
| Hi.Events | https://github.com/HiEventsDev/hi.events | AGPL-3.0 + additional terms | `STUDY_ONLY` | Architectural reference only; **no source copied** into Tutoria |
| OpenEvents | https://github.com/Eyevinn/openevents | MIT | `STUDY` + selective pattern reuse with attribution | Architectural and dashboard patterns |
| OpenLuma | https://github.com/Nishitbaria/openluma | (no LICENSE file at HEAD inspected) | `STUDY_ONLY` | Modern dashboard UX inspiration |

License classification per `docs/OSS_POLICY.md`:
- **AGPL-3.0 (Hi.Events)**: cannot be copied into Tutoria (BSL/AGPL class — even with attribution). Patterns can be reimplemented from public behavior.
- **MIT (OpenEvents)**: patterns can be adapted; any code copied would be attributed in `THIRD_PARTY_NOTICES.md` and `oss/EXTERNAL_SOURCES.json`. We have not copied code in this PR.
- **OpenLuma**: no LICENSE file at HEAD; we treat it as inspiration only and do not incorporate source.

---

## Tutoria subsystem ↔ reference ↔ reuse map

| Tutoria subsystem | Reference repo | Relevant implementation mined | What we reused/adapted | What we built ourselves | License impact |
| --- | --- | --- | --- | --- | --- |
| **Center shell + sidebar nav** | Hi.Events (`OrganizerShell`), OpenLuma | Multi-section host shell with grouped nav, badge counters, persisted last-viewed tab | Grouped nav with badge counts (existing in `center.html`); we kept the prototype IA verbatim and preserved it through the bridge layer | Bridge in `discover/src/app/center/page-client.tsx`; native route tree deferred to P2 | None — IA preserved from existing prototype, no code copied |
| **Host authorization primitive** | Hi.Events (`PermissionService`), OpenEvents (`requireOrganizer`) | Server-side host/organizer role check on every dashboard query | Reused existing `public.can_manage_offering(actor, offering_id, capability)` (`20260819120000_shared_booking_engine.sql:80`) as the canonical gate; every new RPC re-checks this | None — primitive already exists | None |
| **Host dashboard summary** | Hi.Events (`DashboardController::overview`), OpenEvents (`/dashboard/stats`) | Server-aggregated KPIs (today/upcoming/pending/earnings/rating) computed once, returned as a single JSON | Pattern: single `SECURITY DEFINER` RPC returning a `jsonb` document with `tutorProfile`, `todayCount`, `upcomingCount`, `monthEarningsVnd`, `pendingBookingsCount`, etc. Adapted from `20260907000003_tutor_dashboard_rpcs.sql` shape | New `public.get_host_dashboard(p_user_id)` returning the same shape but scoped via `can_manage_offering` (multi-offering) instead of `tutor_profiles.user_id` | None — pattern reimplemented in Tutoria SQL |
| **Host offerings list** | Hi.Events (`EventRepository::listForOrganizer`), OpenEvents (`/organizer/events`) | Server-paginated offerings with status filter, kind filter, computed session/booking counts | Pattern: `list_host_offerings(p_user_id, p_status, p_kind, p_limit, p_offset)` returning `id, kind, slug, title, publication_status, session_count, booking_count, last_session_at` | New RPC + service | None |
| **Host sessions list / calendar** | Hi.Events (`EventScheduleService`), OpenEvents (`/organizer/schedule`) | Server-side date-range filter, status filter, per-session booking count and capacity remaining | Pattern: `list_host_sessions(p_user_id, p_from, p_to, p_offering_id, p_status, ...)` returning sessions joined with `offerings`, capacity from `max_participants` minus active bookings | New RPC + service | None |
| **Host attendees** | Hi.Events (`AttendeeController::index`), OpenEvents (`/organizer/attendees`) | Search + offering filter + pagination, distinct learner aggregation, LTV/booking count | Pattern: `list_host_attendees(p_user_id, p_query, p_offering_id, p_limit, p_offset)` returning distinct learners with `bookings_count`, `completed_count`, `ltv_vnd`, `last_booking_at` | New RPC + service | None |
| **Host earnings / payouts** | Hi.Events (`PayoutService`), OpenEvents (`/organizer/earnings`) | Server-computed earnings breakdown (gross, refunded, fees, host_net, pending) with date filter | Pattern: `get_host_earnings(p_user_id, p_from, p_to)` aggregating `payments.amount_vnd` − `refunds.amount_vnd` for bookings the host manages. **No client-side aggregation.** Returns `grossVnd`, `refundedVnd`, `hostFeeVnd`, `hostNetVnd`, `pendingVnd`, `currency` | New RPC + service; payouts list deferred until manual payout feature is designed | None |
| **Check-in / QR redemption** | Hi.Events (`CheckInController`, `TicketRepository::checkIn`), OpenEvents (`/check-in/scan`) | Server-issued opaque token → atomic redemption with duplicate-scan protection, scan log per staff identity | Pattern (not code): `tickets(id, booking_id)` 1-1, `check_in_tokens(token_hash, ticket_id, expires_at, revoked_at)`, `check_in_logs(id, ticket_id, actor_user_id, outcome, scanned_at)`. `redeem_check_in_token` is `SECURITY DEFINER` and uses `INSERT ... ON CONFLICT DO NOTHING` on a unique `(ticket_id, session_id, outcome='attended')` to make duplicate scans a no-op returning the existing log | Tutoria-native schema, RLS, and atomic SQL — none of Hi.Events source copied. AGPL forbids that anyway. | None — independent implementation |
| **Analytics** | Hi.Events (`AnalyticsService`), OpenEvents (`/organizer/analytics`) | Server-side aggregates (bookings, revenue, conversion, capacity utilization) returned as flat time-bucketed series | Pattern: `get_host_analytics(p_user_id, p_from, p_to)` returning `{totals, daily[], topOfferings[], capacityUtilization}`. Only computed from existing data; no new analytics events in this PR | Deferred to P1 (current P0 RPCs are sufficient for the Overview tile) | None |
| **Audit log / history** | Hi.Events (`AuditLogService`), OpenEvents | Append-only host-side audit trail of decisions | Reused existing `public.booking_history` and `public.session_history` tables; new check-in log serves the same purpose for attendance events | None — primitives exist | None |
| **Bulk actions + CSV export** | Hi.Events, OpenEvents | Server-issued CSV streaming | Reused existing `downloadCSV(...)` helper already shipped in `center.html`; no backend change needed | None | None |
| **Filter / search UX** | Hi.Events, OpenEvents | Server-side `q` parameter + status / date / offering filters on every list endpoint | Reused: every list RPC accepts a typed `p_query` (trigram-able name/email lookup) and explicit filter args | None | None |

---

## Hi.Events (AGPL-3.0) — what we mined, what we did not

We did **not** read Hi.Events source into Tutoria's tree. We mined the public UX and data model only at the conceptual level:

- **Organizer dashboard shape** (single RPC returning aggregated KPIs) — adopted as a pattern; SQL is fully Tutoria-native.
- **Check-in flow** (booking → ticket → token → atomic redeem with log) — adopted as a pattern; SQL is fully Tutoria-native and uses `SECURITY DEFINER` + `ON CONFLICT` for duplicate protection.
- **Refund + payout reconciliation** — Tutoria already has `payment_events`, `refunds`, `payment_recovery_worker`; no Hi.Events code reused.

If Hi.Events code were ever considered for reuse, the AGPL-3.0 license would require either dual-licensing or AGPL-compatible distribution of Tutoria. Tutoria's policy explicitly forbids AGPL incorporation without explicit resolution — see `oss/REPO_POLICY.json`. We chose independent implementation. This decision is recorded here.

---

## OpenEvents (MIT) — what we mined, what we did not

OpenEvents is MIT-licensed but we still did not copy source. The architectural patterns below were independently reimplemented in Tutoria SQL/TypeScript:

- Server-paginated dashboard list endpoints with explicit `limit/offset` and typed filter args.
- Single-document response shape for summary endpoints (`{ ok: true, dashboard: {...} }`).
- `postMessage` bridge in the prototype (already shipped) maps cleanly to MIT-style dashboard conventions.

If we later copy any OpenEvents code verbatim, we will:
1. Add the upstream commit SHA to `oss/EXTERNAL_SOURCES.json`.
2. Regenerate `THIRD_PARTY_NOTICES.md`.
3. Run `python3 scripts/oss_guard.py ci`.

---

## OpenLuma — what we mined

OpenLuma's LICENSE was not located at HEAD; we treat it as visual/UX inspiration only. We did not read source into Tutoria.

Patterns mined from public product surface (openluma.dev):
- Clean white-cards-on-dark-shell dashboard layout (already matches Tutoria's charcoal direction).
- Sidebar with grouped navigation and badge counters (already in `center.html`).

No code reused.

---

## Why we built the following from scratch

| Component | Why built from scratch |
| --- | --- |
| `get_host_dashboard` | Tutoria's existing `get_tutor_dashboard` is scoped to `tutor_profiles.user_id`; we need a host-agnostic variant using `can_manage_offering` so workshop/event organizers without a tutor profile are included |
| `list_host_offerings` / `list_host_sessions` / `list_host_attendees` / `get_host_earnings` | Tutoria backend previously exposed these only via tutor-side endpoints; no equivalent host-side aggregates existed |
| `tickets` / `check_in_tokens` / `check_in_logs` schema | Tutoria has `attendance_facts` (outcome recording) but no token-based check-in primitive; we need the QR token for the prototype's planned mobile check-in flow |
| `host-center-service.ts` + `routes/host.ts` | Tutoria had `tutor-dashboard.ts` route + service but no host-side aggregation surface |
| `host-center-api.ts` (frontend client) | Tutoria had `tutor-dashboard-api.ts` but no host-side client for the Center pages |

---

## Outstanding reference work

- Mining OpenEvents for server-side CSV streaming (relevant if we ever support 10k+ row exports — out of scope for P0/P1).
- Mining Hi.Events' refund reconciliation worker for Tutoria's existing `financial-recovery-worker.ts` (Tutoria already has a worker; no change planned in this PR).

---

## Verification

- `python3 scripts/oss_guard.py ci` should continue to pass (no new external source incorporated in this PR).
- Tutoria repository remains an independent implementation of the patterns above; no AGPL code present.