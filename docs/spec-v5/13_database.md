# 13 — DATABASE CONTRACT (DB)

**Surface:** authoritative schema, columns, constraints, indexes, migration history, and the current-vs-target DB state.
**Alpha status:** Alpha core. The DB is the transactional source of truth for money/booking/capacity; RLS enforced at DB layer.
**Primary evidence:** `backend/supabase/migrations/`, `docs/TUTORIA_MASTER_TECHNICAL_INVENTORY.md` §13, `docs/PRIVATE_ALPHA_REMEDIATION_BASELINE.md`.

> **Reality (REAL-002/003/004):** local 22/27, prod 24/27. `20260820100000` replay defect blocks clean reset. Several corrective migrations in-repo but not on prod. See `27_migration_plan.md`.

---

## 13.1 Migration ledger (current truth)

| Migration | Local | Prod | Note |
|---|---|---|---|
| `20260815150540` (init+roles+profiles+auth) | ✔ | ✔ | — |
| `20260815180000` (marketplace/tutors) | ✔ | ✔ | — |
| ... (core shared engine migrations) | ✔ | ✔ | — |
| `20260817160000` | ✘ (absent) | ✔ | remote-only, content UNKNOWN (`UNK-003`) |
| `20260817160001` | ✘ (absent) | ✔ | remote-only, content UNKNOWN (`UNK-003`) |
| `20260819120000` | ✔ | ✘ | corrective in-repo |
| `20260820000000` | ✔ | ✘ | corrective |
| `20260820100000` | ✔ (reported replay defect — reproduce to confirm) | ✘ | WORKSHOP booking v1 schema; adds `offerings_pricing_model_check` (no in-repo partner; 42710 reported) |
| `20260820100001` | ✔ | ✘ | — |
| `20260820100002` | ✔ | ✘ | — |
| `20260820120000` | ✔ | ✘ | — |
| `20260820130000` | ✔ | ✘ | alpha contract cleanup (not applied on prod) |

## 13.2 Authoritative entity/column contracts (owner of `DOM-*`)

### `offerings`
- Required columns: `id uuid, creator_id, offering_kind, pricing_model, booking_mode, publication_status, slug, title, description`.
- `pricing_model` CHECK = `hourly_v1 | flat_per_participant_v1` (`fixed_v1` excluded — `REAL-005`).
- `offering_kind` CHECK covers `tutor | workshop | class | event`.
- `publication_status` ∈ {draft, published} (+ use-lifecycle states per `DEC-*`).

### `sessions`
- `id, offering_id (NOT NULL), starts_at, ends_at, min_participants, max_participants, status`.
- `status` ∈ {scheduled, cancelled, completed}.
- Capacity is on the session; participant counts derived server-side/recounted in create_booking.

### `bookings`
- `id, session_id, offering_id, attendee_id, participant_count, pricing_model, unit_price, subtotal_amount, status TEXT + CHECK, version int (CAS), cancelled_by, created_at, updated_at`.
- `status` CHECK ∈ {requested, confirmed, cancelled, rejected, completed} (`DOM-010`).
- **Paid state does NOT live here** — separate `payments` (`PAY-*`).

### `payments` cluster
- `payments(id, booking_id(s), payer_id, provider, status, amount_minor_units, currency, created_at)`.
- `payment_attempts(id, payment_id, idempotency_key UNIQUE, status, provider, metadata)`.
- `payment_provider_events(provider_event_key PK, payment_id, raw, canonical, status)`.
- `payment_provider_operations(operation_key PK, payment_id, op_type, status, result)`.
- `refunds(id, payment_id, operation_key, amount_minor_units, status, reason)`.

### `booking_history` / `session_history` / `event_outbox`
- Append-only history rows for audit; durable `event_outbox` for notifications/payout domain events.
- `event_outbox(id, event_type, payload, status, attempts, next_attempt_at)`.

### `tutor cluster`
- `tutor_profiles(id, user_id, slug, headline, bio, price_minor_units, availability... , version CAS, publication_status)`.
- `tutor_availability_slots(id, tutor_id, starts_at, ends_at, status)`.
- `tutor_education_entries`, `tutor_experience_entries`, `tutor_subjects/levels/regions/languages`.

### `profiles`
- `id → auth.users PK, name, phone, avatar_url, role, is_host`.
- Role is not client-authoritative (`ROLE-003`).

### `booking_create_attempts`
- Rate-limiter/abuse table keyed by attendee+session (see `15_security.md`, `SEC-*`).

## 13.3 DB invariants (must be DB-enforced, not just client)

- `DB-001` — Capacity: recomputed reliably in the create_booking RPC transaction; no over-capacity confirmed.
- `DB-002` — Amounts integer minor units; no float money columns.
- `DB-003` — Version/CAS on mutable booking/tutor rows.
- `DB-004` — `payment_attempts.idempotency_key` UNIQUE; `payment_provider_events.provider_event_key` PK; `payment_provider_operations.operation_key` PK.
- `DB-005` — FKs with ON DELETE behavior defined (no orphaning of transactional rows).
- `DB-006` — Indexes on hot lookup paths (session_id, attendee_id, offering slug, tutor slug).

## 13.4 Target DB state (authoritative)

- Reconcile migrations so repo = prod and both error-free. Fix `20260820100000` replay defect; restore outbox/worker-backed expiry (`REAL-007`); unify `create_booking` to canonical 3-arg (`REAL-004`). All via `27_migration_plan.md`.

---

## 13 RTM (select)

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| DB-001 | Capacity invariant in RPC tx | 20260820100000+ | `ITST-capacity` | `AC-BOOK-002` | DOM-013 |
| DB-002 | Integer money | migrations | `TST-db-money` | `AC-PAY-004` | — |
| DB-003 | CAS on mutable rows | migrations | `ITST-cas` | `AC-BOOK-003` | — |
| DB-004 | Idempotency keys | migrations | `ITST-idem` | `AC-PAY-002` | — |
