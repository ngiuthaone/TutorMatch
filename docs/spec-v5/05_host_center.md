# 07/05 — HOST CENTER CONTRACT (HOST)

**Surface:** host management of their workshops/offerings, bookings, attendees, earnings, profile/onboarding to become host.
**Alpha status:** ALPHA CORE — the host side of the workshop money loop (create/publish, manage bookings, confirm/reject, view earnings).
**Primary evidence:** `discover/src/app/center` (exists, hybrid), `published-event-store.ts`, host list RPCs.

---

## 05.1 PAGES

### HOST-001 — Host Center overview (`/center`)
- Current: iframe/hybrid. Target: native server-backed surface (`DEC-*` for exact route/refactor).
- Tabs: My Workshops / Bookings / Attendees / Earnings / Settings.
- **States:** `INITIAL`, `LOADING`, `EMPTY` (no listings yet + CTA to create), `ERROR`, `AUTH REQUIRED`, `AUTH FORBIDDEN` (non-host).

### HOST-002 — My workshops (managed via WORK-004/`01_workshop.md`)
- List host-owned workshops with status (draft/published/live/past), capacity, bookings count, computed earnings.
- Row actions: view public, edit, publish/unpublish, manage attendees.

### HOST-003 — Host bookings (incoming)
- Bookings against host's sessions: attendee name, participant count, price snapshot, status, payment state.
- Actions: for approval-mode → confirm/reject; for instant → view; cancel (per policy).
- **States per booking row:** `REQUESTED`, `CONFIRMED`, `PAID`(view), `CANCELLED` (+ by whom), `PAYMENT PENDING`, `COMPLETED`.
- Never expose learner's auth id or private contact beyond contact policy (`SEC-*`).

### HOST-004 — Attendees list
- Authenticated attendees per session, with participant count + booking ref.
- Download/summary for host operations.

### HOST-005 — Earnings
- Summarized payout-eligible earnings from completed sessions (derived from payments/payout domain, `04_payment.md`). Always server-computed; never a client sum.
- **States:** `EMPTY`, `LOADING`, `AVAILABLE`, `PAID`, `PENDING`.

## 05.2 COMPONENTS

| HOST-0xx | Component | States | Data |
|---|---|---|---|
| HOST-010 | CenterTabNav | overview/workshops/bookings/attendees/earnings | — |
| HOST-011 | HostWorkshopRow | draft/published/live/past | offering |
| HOST-012 | HostBookingRow | requested/confirmed/cancelled/paid/completed | booking |
| HOST-013 | AttendeeTable | adults/children count | bookings |
| HOST-014 | EarningsSummary | available/paid/pending | payments |

## 05.3 INTERACTIONS

- `HOST-030` — Onboarding: learner opts in to become host (`enable_tutor`/role elevation via service-role) → reach Host Center.
- `HOST-031` — Confirm/reject request in approval mode updates booking state atomically; capacity released on reject.
- `HOST-032` — Publish/unpublish reflects immediately in public list.
- `HOST-033` — Earnings always pulled server-side; no client aggregation.

## 05.4 API / RPC / DB (owner refs)

| Req | Contract owner | Notes |
|---|---|---|
| `HOST-040` | `GET /host/workshops` | host-owned offerings |
| `HOST-041` | `GET /host/bookings` | incoming bookings |
| `HOST-042` | `POST /bookings/[id]/confirm` | confirm (approval) |
| `HOST-043` | `POST /bookings/[id]/reject` | reject → capacity released |
| `HOST-044` | `GET /host/earnings` | server-computed earnings |

## 05.5 ACCEPTANCE CRITERIA

- `AC-HOST-001` — A host sees their own workshops with correct status/capacity/earnings (server data).
- `AC-HOST-002` — A host can confirm/reject a request-mode booking; reject releases capacity.
- `AC-HOST-003` — A host never sees another host's attendee PII (RLS).
- `AC-HOST-004` — Earnings are server-computed; client cannot alter them.

---

## 07/05 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| HOST-001 | Host Center overview | `app/center` | list RPCs | `E2E-host` | `AC-HOST-001` | exists |
| HOST-030 | Onboarding to host | auth, center | enable_tutor | `TST-host-role` | `AC-HOST-001` | AUTH-004 |
| HOST-031 | Confirm/reject request | host svc | confirm/reject RPC | `ITST-approval` | `AC-HOST-002` | §03 |
| HOST-033 | Server earnings | earnings view | pay rpc | `TST-earn` | `AC-HOST-004` | §04 |
| HOST-034 | PII isolation | attendees view | RLS | `TST-host-acl` | `AC-HOST-003` | §15 |
