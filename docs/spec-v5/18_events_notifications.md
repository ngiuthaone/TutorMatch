# 18 — EVENT / NOTIFICATION / SOCIAL-PUSH CONTRACT (EVT2 / NOTIF)

**Surface:** durable domain events (event_outbox) and their downstream effects (notifications, messaging). Messaging ≠ notifications.
**Alpha status:** notifications minimal (transaction-triggered, e.g. booking paid/confirmed/cancelled email or in-app placeholder); full realtime messaging Post-Alpha.
**Primary evidence:** `event_outbox`, worker `WORKER-003`, no production messaging/notification backend (`REAL-010`).

---

## 18.1 Domain events (durable, in `event_outbox`)

| EVT2-0xx | Event | Producer | Consumers |
|---|---|---|---|
| EVT2-010 | `booking.created` | create_booking RPC | notification, learner/host views |
| EVT2-011 | `payment.succeeded` | webhook ingest | booking confirm, notification, receipt |
| EVT2-012 | `booking.cancelled` | cancel RPC | refund obligation, capacity release, notification |
| EVT2-013 | `session.completed` | worker | history, payout eligibility |
| EVT2-014 | `booking.confirmed` (instant on pay / approval) | engine | notification |
| EVT2-015 | `refund.succeeded/failed/ambiguous` | refund worker | notification, ops |

- `EVT2-020` — Events are durable and replayable; consumers idempotent.
- `EVT2-021` — Notifications are derived from events, not emitted ad-hoc (`NOTIF-*`).

## 18.2 Notifications (Alpha scope = transactional only)

- `NOTIF-010` — Transactional notifications (in-app + email placeholder): booking confirmed, payment received, booking cancelled, refund result, session join reminder.
- `NOTIF-011` — Real-time push (WebSocket/SSE) **not Alpha**; Alpha uses event-driven refresh / email. Mark `PRODUCT DECISION` if in-app realtime is wanted at Alpha.
- `NOTIF-012` — No notification for messages (messaging is Post-Alpha).

## 18.3 Messaging contract (Post-Alpha default, `PURPLE`)

- `MSG-001` — Direct host↔learner messaging about a booking: Post-Alpha (`SCOPE-004`). Record design intent here but do not implement at Alpha.
- `MSG-002` — When implemented: server-authoritative conversation+membership+RLS; no client fabrication; idempotent send; moderation hooks.

## 18.4 ACCEPTANCE CRITERIA

- `AC-EVT2-001` — Every Alpha booking/payment/cancellation/refund transition emits a durable, replayable event.
- `AC-EVT2-002` — Notifications derive from events; no ad-hoc notification writes.
- `AC-EVT2-003` — Realtime messaging is explicitly deferred (documented, not shipped).

---

## 18 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| EVT2-010..015 | durable events | RPC/worker | `ITST-outbox` | `AC-EVT2-001` | — |
| NOTIF-010 | transactional notif | events→notif | `TST-notif` | `AC-EVT2-002` | — |
| NOTIF-011/012 | realtime deferred | — | — | `AC-EVT2-003` | SCOPE-004 |
| MSG-001 | messaging Post-Alpha | — | — | `AC-EVT2-003` | SCOPE-004 |
