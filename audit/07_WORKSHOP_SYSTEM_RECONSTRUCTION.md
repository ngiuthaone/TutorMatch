# 07 — Workshop System Reconstruction

Host/workshop lifecycle. Derived from `offerings`/`offering_hosts` schema +
SQL RPCs (`20260820100000*/20260820120000`) and discover frontend
(`workshops/*`, `components/workshop/workshop-detail-page.tsx`,
`lib/workshop-booking-api.ts`, `lib/tutor-workshop-booking-api.ts`).

## Lifecycle stage-by-stage

| Stage | Implementation | State |
|---|---|---|
| Host | `profiles` role + `offerings.creator_id` + `offering_hosts` | real |
| Create workshop | `POST /api/v1/offerings` (kind=workshop) | real |
| Configure content/location/duration/pricing/capacity | `offerings.config` jsonb + `unit_price/price_per_participant` + `sessions` (min/max participants) | real |
| Pricing | `flat_per_participant_v1` (20260820100000) | real |
| Booking mode | `instant` or `approval` | real |
| Publish | `update_offering_status` (draft→published) | real |
| Learner discovers | `marketplace/:kind` + `list_bookable_sessions` (offering kind workshop) | real |
| Learner books | `create_booking` (flat per-participant, idempotency) | real |
| Payment | `start_payment` VNPay | real (see 08) |
| Host sees/manages booking | `/center` (real) `get_my_host_bookings` / `get_my_workshop_bookings` | real |
| Manage attendees | booking accept/reject; cancel | real |
| Workshop occurs | `complete_session` / `record_attendance` | real |
| Completion | `completed` | real |
| Cancellation | `cancel_workshop_booking` / `cancel_booking` | real |
| Payment-TTL auto-cancel | `expire_stale_workshop_bookings` RPC | **IMPLEMENTED but NOT dispatched (BROKEN/GAP)** |
| Payout | domain model only; no provider disbursement | PARTIAL |
| Host refund | obligations + execution/reconciliation | real (model + worker) |
| Review | **NOT FOUND** | not implemented |
| Editing | PATCH status exists; rich edit UI not confirmed | PARTIAL |

## Key frontend observations

- `workshops` listing + `workshops/[slug]` detail are real (marketplace-api +
  booking-api + session picker).
- `workshop-detail-page.tsx:214` does `window.location.assign('/bookings/${id}')`
  after booking → **there is no `/bookings/[id]` route → 404** (BROKEN flow).
- Workshop host management lives behind `/center` via an iframe bridge
  (`center-bridge`) → `tutor-workshop-booking-api.ts`.

## Gap summary

1. Workshop is the most complete new offering end-to-end, **except**:
   - payment-TTL expiry not dispatched by worker;
   - post-booking detail page missing (404);
   - review flow absent;
   - payout provider integration unverified.
2. Host authorization consistency was deliberately hardened in
   `20260820120000` (co-host model) but that migration is **not applied** to
   the local dev DB (drift).
