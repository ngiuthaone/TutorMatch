# Workshop Booking Implementation Plan

## Overview
Move Workshop from frontend-only prototype to real backend-backed booking using the shared Tutor booking infrastructure with INSTANT booking policy and flat-per-participant pricing.

## Approved Decisions
1. **Pricing**: Add `flat_per_participant_v1` pricing model. Use `price_per_participant_vnd bigint` column. Preserve `hourly_v1`.
2. **Workshop booking policy**: INSTANT booking. Learner selects real Session UUID and participantCount; capacity held temporarily during payment; payment immediate; Booking confirms only after verified payment. Failed/expired payment releases capacity. Server computes authoritative price snapshot from session/offering pricing × quantity.
3. **Minimum participants**: Session-level viability, not Booking status. Count participant quantity from successfully paid/confirmed, non-cancelled bookings. V1 minimum cutoff is 24 hours before startsAt; if minimum unmet at cutoff, cancel Session and make affected paid bookings eligible for full refunds.
4. **Publishing**: Must create/use real Offering + Session database records. Public Workshop UI must use authoritative Session UUIDs.
5. **Host Center**: Keep one shared Tutoria Center. Add offering-type-aware Workshop listings/session management.
6. **Session API**: Prefer generic sessions-by-offeringId contract unless domain/security evidence requires category-specific RPCs.

---

## Phase 1: Schema Migration

### 1.1 Create `offerings` table
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_offerings.sql`

```sql
create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  offering_type text not null check (offering_type in ('tutor', 'workshop', 'class', 'event')),
  title text not null,
  description text,
  pricing_model text not null check (pricing_model in ('hourly_v1', 'flat_per_participant_v1')),
  price_per_participant_vnd bigint check (price_per_participant_vnd > 0),
  hourly_rate_vnd bigint check (hourly_rate_vnd between 50000 and 10000000),
  currency text not null default 'VND' check (currency = 'VND'),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  metadata jsonb,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Pricing model constraints
  check (
    (pricing_model = 'hourly_v1' and hourly_rate_vnd is not null and price_per_participant_vnd is null)
    or
    (pricing_model = 'flat_per_participant_v1' and price_per_participant_vnd is not null and hourly_rate_vnd is null)
  )
);

-- RLS
alter table public.offerings enable row level security;

-- Grants (access via RPCs only)
revoke all on public.offerings from authenticated;
revoke all on public.offerings from anon;
grant select on public.offerings to authenticated;
grant select on public.offerings to anon;

-- Indexes
create index idx_offerings_host_id on public.offerings(host_id);
create index idx_offerings_status on public.offerings(status);
create index idx_offerings_offering_type on public.offerings(offering_type);
```

### 1.2 Add FK constraint to `sessions.offering_id`
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_sessions_offering_fk.sql`

```sql
-- Add foreign key constraint to sessions.offering_id
alter table public.sessions
  add constraint sessions_offering_id_fk
  foreign key (offering_id) references public.offerings(id)
  on delete set null;

-- Add index for minimum evaluation query
create index idx_sessions_offering_status_starts
  on public.sessions(offering_id, status, starts_at)
  where status = 'scheduled';
```

### 1.3 Extend bookings pricing CHECK constraint
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_extend_bookings_pricing_constraint.sql`

```sql
-- Drop existing constraint
alter table public.bookings
  drop constraint if exists bookings_pricing_check;

-- Add new constraint supporting both pricing models
alter table public.bookings
  add constraint bookings_pricing_check
  check (
    (pricing_amount_vnd is null and pricing_currency is null
     and pricing_hourly_rate_vnd is null and pricing_duration_minutes is null
     and pricing_price_per_participant_vnd is null
     and pricing_model is null and pricing_snapshotted_at is null)
    or
    (pricing_amount_vnd > 0 and pricing_currency = 'VND'
     and pricing_model is not null and pricing_snapshotted_at is not null
     and (
       (pricing_model = 'hourly_v1'
        and pricing_hourly_rate_vnd between 50000 and 10000000
        and pricing_duration_minutes > 0
        and pricing_price_per_participant_vnd is null)
       or
       (pricing_model = 'flat_per_participant_v1'
        and pricing_price_per_participant_vnd > 0
        and pricing_hourly_rate_vnd is null
        and pricing_duration_minutes is null)
     )
    )
  );
```

### 1.4 Add `pricing_price_per_participant_vnd` column to bookings
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_bookings_per_participant_pricing.sql`

```sql
-- Add pricing snapshot column for flat_per_participant_v1
alter table public.bookings
  add column pricing_price_per_participant_vnd bigint;

-- Add comment
comment on column public.bookings.pricing_price_per_participant_vnd
  is 'Price per participant snapshot from offering at booking creation time';
```

### 1.5 Add `minimum_not_met` cause to `cancel_session`
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_extend_cancel_session_cause.sql`

```sql
-- Extend cancel_session to accept 'minimum_not_met' cause
-- This will be done in the RPC modification phase (Phase 2)
```

---

## Phase 2: RPC Modifications

### 2.1 Modify `create_booking` for Workshop INSTANT
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_modify_create_booking_workshop.sql`

**Changes:**
1. Add offering lookup (by session → offering_id → offering)
2. Branch pricing computation by `pricing_model`
3. For INSTANT offerings: auto-insert `booking_approvals` row in same transaction

**Key logic:**
```sql
-- After reading session (FOR UPDATE), read offering
select o.* into offering
  from public.offerings o
  where o.id = s.offering_id
  for share;

-- Branch pricing by model
if offering.pricing_model = 'flat_per_participant_v1' then
  amount := offering.price_per_participant_vnd * participant_count;
  -- Insert booking with flat pricing snapshot
  insert into public.bookings(
    id, session_id, learner_id, participant_count, status,
    pricing_amount_vnd, pricing_currency, pricing_price_per_participant_vnd,
    pricing_model, pricing_snapshotted_at
  ) values (
    bid, session_id, uid, participant_count, 'requested',
    amount, 'VND', offering.price_per_participant_vnd,
    'flat_per_participant_v1', now()
  );
elsif offering.pricing_model = 'hourly_v1' then
  -- Existing hourly rate logic (unchanged)
  ...
end if;

-- For INSTANT offerings: auto-create booking approval
if offering.booking_mode = 'instant' then
  insert into public.booking_approvals(booking_id, approved_by, approved_at)
  values (bid, s.host_id, now());
end if;
```

### 2.2 Add `booking_mode` to offerings
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_offering_booking_mode.sql`

```sql
-- Add booking_mode to offerings
alter table public.offerings
  add column booking_mode text not null default 'approval'
  check (booking_mode in ('approval', 'instant'));
```

### 2.3 Modify `cancel_session` for `minimum_not_met`
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_modify_cancel_session_minimum.sql`

**Changes:**
1. Accept `cause='minimum_not_met'` when called via service_role (auth.uid() is null)
2. Set `cancelled_by='system'` for minimum-not-met cancellations

**Key logic:**
```sql
-- Extend cause validation
if cause is distinct from 'host' and cause is distinct from 'minimum_not_met' then
  raise exception 'INVALID_TRANSITION' using errcode='22023';
end if;

-- For minimum_not_met: require service_role (auth.uid() is null)
if cause = 'minimum_not_met' and auth.uid() is not null then
  raise exception 'UNAUTHORIZED' using errcode='42501';
end if;

-- Set cancelled_by based on cause
if cause = 'minimum_not_met' then
  cancelled_by := 'system';
else
  cancelled_by := 'host';
end if;
```

### 2.4 Create `list_sessions_by_offering_id` RPC
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_list_sessions_by_offering.sql`

```sql
create or replace function public.list_sessions_by_offering_id(
  p_offering_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  -- Return sessions for the offering with capacity info
  return (
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'startsAt', s.starts_at,
        'endsAt', s.ends_at,
        'minParticipants', s.min_participants,
        'maxParticipants', s.max_participants,
        'spotsLeft', s.max_participants - coalesce(public.session_hard_reserved(s.id), 0),
        'status', s.status
      )
    )
    from public.sessions s
    where s.offering_id = p_offering_id
      and s.status = 'scheduled'
    order by s.starts_at
  );
end;
$$;

-- Grant access
grant execute on function public.list_sessions_by_offering_id(uuid) to anon, authenticated;
```

### 2.5 Create `get_offering` RPC
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_get_offering.sql`

```sql
create or replace function public.get_offering(
  p_offering_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return (
    select jsonb_build_object(
      'id', o.id,
      'hostId', o.host_id,
      'offeringType', o.offering_type,
      'title', o.title,
      'description', o.description,
      'pricingModel', o.pricing_model,
      'pricePerParticipantVnd', o.price_per_participant_vnd,
      'hourlyRateVnd', o.hourly_rate_vnd,
      'currency', o.currency,
      'bookingMode', o.booking_mode,
      'status', o.status,
      'version', o.version
    )
    from public.offerings o
    where o.id = p_offering_id
      and o.status = 'published'
  );
end;
$$;

-- Grant access
grant execute on function public.get_offering(uuid) to anon, authenticated;
```

### 2.6 Create `create_offering` RPC
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_create_offering.sql`

```sql
create or replace function public.create_offering(
  p_offering_type text,
  p_title text,
  p_description text default null,
  p_pricing_model text,
  p_price_per_participant_vnd bigint default null,
  p_hourly_rate_vnd bigint default null,
  p_booking_mode text default 'approval'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  offering_id uuid;
begin
  -- Validate caller
  perform public.assert_verified_booking_caller();

  -- Validate pricing model
  if p_pricing_model = 'hourly_v1' and p_hourly_rate_vnd is null then
    raise exception 'MISSING_HOURLY_RATE' using errcode='22023';
  end if;

  if p_pricing_model = 'flat_per_participant_v1' and p_price_per_participant_vnd is null then
    raise exception 'MISSING_PRICE_PER_PARTICIPANT' using errcode='22023';
  end if;

  -- Create offering
  insert into public.offerings(
    host_id, offering_type, title, description,
    pricing_model, price_per_participant_vnd, hourly_rate_vnd,
    booking_mode, status
  ) values (
    uid, p_offering_type, p_title, p_description,
    p_pricing_model, p_price_per_participant_vnd, p_hourly_rate_vnd,
    p_booking_mode, 'draft'
  ) returning id into offering_id;

  return jsonb_build_object(
    'id', offering_id,
    'status', 'draft'
  );
end;
$$;

-- Grant access
grant execute on function public.create_offering(text, text, text, text, bigint, bigint, text) to authenticated;
```

### 2.7 Create `update_offering_status` RPC
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_update_offering_status.sql`

```sql
create or replace function public.update_offering_status(
  p_offering_id uuid,
  p_expected_version bigint,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  o record;
begin
  -- Lock and validate offering
  select * into o
    from public.offerings
    where id = p_offering_id
    for update;

  if not found then
    raise exception 'OFFERING_NOT_FOUND' using errcode='P0002';
  end if;

  if o.host_id <> uid then
    raise exception 'UNAUTHORIZED' using errcode='42501';
  end if;

  if o.version <> p_expected_version then
    raise exception 'STALE_VERSION' using errcode='40001';
  end if;

  if p_status not in ('draft', 'published', 'unpublished') then
    raise exception 'INVALID_STATUS' using errcode='22023';
  end if;

  -- Update status
  update public.offerings
    set status = p_status,
        version = version + 1,
        updated_at = now()
    where id = p_offering_id;

  return jsonb_build_object(
    'id', p_offering_id,
    'status', p_status,
    'version', o.version + 1
  );
end;
$$;

-- Grant access
grant execute on function public.update_offering_status(uuid, bigint, text) to authenticated;
```

---

## Phase 3: Backend Route Updates

### 3.1 Add offering routes
**File**: `backend/src/routes/offering.ts` (new file)

```typescript
import { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase-admin';

export async function offeringRoutes(app: FastifyInstance) {
  // GET /api/v1/offerings/:offeringId
  app.get('/api/v1/offerings/:offeringId', async (req, reply) => {
    const { offeringId } = req.params as { offeringId: string };
    const { data, error } = await supabaseAdmin.rpc('get_offering', {
      p_offering_id: offeringId
    });
    if (error) return reply.code(400).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'OFFERING_NOT_FOUND' });
    return data;
  });

  // POST /api/v1/offerings
  app.post('/api/v1/offerings', async (req, reply) => {
    const body = req.body as any;
    const { data, error } = await supabaseAdmin.rpc('create_offering', {
      p_offering_type: body.offeringType,
      p_title: body.title,
      p_description: body.description,
      p_pricing_model: body.pricingModel,
      p_price_per_participant_vnd: body.pricePerParticipantVnd,
      p_hourly_rate_vnd: body.hourlyRateVnd,
      p_booking_mode: body.bookingMode
    });
    if (error) return reply.code(400).send({ error: error.message });
    return data;
  });

  // PATCH /api/v1/offerings/:offeringId/status
  app.patch('/api/v1/offerings/:offeringId/status', async (req, reply) => {
    const { offeringId } = req.params as { offeringId: string };
    const body = req.body as { expectedVersion: number; status: string };
    const { data, error } = await supabaseAdmin.rpc('update_offering_status', {
      p_offering_id: offeringId,
      p_expected_version: body.expectedVersion,
      p_status: body.status
    });
    if (error) return reply.code(400).send({ error: error.message });
    return data;
  });

  // GET /api/v1/offerings/:offeringId/sessions
  app.get('/api/v1/offerings/:offeringId/sessions', async (req, reply) => {
    const { offeringId } = req.params as { offeringId: string };
    const { data, error } = await supabaseAdmin.rpc('list_sessions_by_offering_id', {
      p_offering_id: offeringId
    });
    if (error) return reply.code(400).send({ error: error.message });
    return data;
  });
}
```

### 3.2 Update booking routes for Workshop
**File**: `backend/src/routes/booking.ts`

**Changes:**
1. Add `GET /api/v1/offerings/:offeringId/sessions` route
2. Update `POST /api/v1/bookings` to handle Workshop INSTANT bookings
3. Add `POST /api/v1/bookings/:bookingId/start-payment` route (if not exists)

### 3.3 Update session routes
**File**: `backend/src/routes/session.ts` (if exists, otherwise in booking.ts)

**Changes:**
1. Add `POST /api/v1/sessions` route for creating sessions
2. Update `GET /api/v1/sessions` to support filtering by offering_id

---

## Phase 4: Frontend Workshop Bridge

### 4.1 Create event booking API client
**File**: `discover/src/lib/event-booking-api.ts` (new file)

```typescript
import { supabase } from './supabase';

export interface WorkshopSession {
  id: string;
  startsAt: string;
  endsAt: string;
  minParticipants: number | null;
  maxParticipants: number;
  spotsLeft: number;
  status: string;
}

export interface WorkshopOffering {
  id: string;
  hostId: string;
  offeringType: 'workshop';
  title: string;
  description: string | null;
  pricingModel: 'flat_per_participant_vnd';
  pricePerParticipantVnd: number;
  currency: string;
  bookingMode: 'instant' | 'approval';
  status: string;
  version: number;
}

export async function getWorkshopOffering(offeringId: string): Promise<WorkshopOffering | null> {
  const { data, error } = await supabase.rpc('get_offering', {
    p_offering_id: offeringId
  });
  if (error) throw error;
  return data;
}

export async function getWorkshopSessions(offeringId: string): Promise<WorkshopSession[]> {
  const { data, error } = await supabase.rpc('list_sessions_by_offering_id', {
    p_offering_id: offeringId
  });
  if (error) throw error;
  return data || [];
}

export async function createWorkshopBooking(
  sessionId: string,
  participantCount: number
): Promise<{ bookingId: string; paymentReady: boolean }> {
  const { data, error } = await supabase.rpc('create_booking', {
    session_id: sessionId,
    participant_count: participantCount
  });
  if (error) throw error;
  return data;
}

export async function startWorkshopPayment(
  bookingId: string,
  idempotencyKey: string
): Promise<{ redirectUrl: string }> {
  const { data, error } = await supabase.rpc('start_payment_attempt', {
    p_booking_id: bookingId,
    p_idempotency_key: idempotencyKey
  });
  if (error) throw error;
  return data;
}
```

### 4.2 Modify `pizza-workshop-frame.tsx`
**File**: `discover/src/components/events/pizza-workshop-frame.tsx`

**Changes:**
1. Add props for `offeringId` and `sessionData`
2. Replace localStorage mock data with real API calls
3. Wire "Continue" button to `createWorkshopBooking` call
4. Add auth interception for logged-out users
5. Add payment flow integration

### 4.3 Modify `published-event-page.tsx`
**File**: `discover/src/components/events/published-event-page.tsx`

**Changes:**
1. Fetch real workshop offering and sessions from API
2. Pass real data to `PizzaWorkshopFrame`
3. Handle auth state and pass to iframe

### 4.4 Add workshop booking bridge
**File**: `discover/src/components/events/workshop-booking-bridge.tsx` (new file)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getWorkshopOffering, getWorkshopSessions } from '@/lib/event-booking-api';
import { createWorkshopBooking, startWorkshopPayment } from '@/lib/event-booking-api';
import { useAuth } from '@/components/auth/auth-provider';

interface WorkshopBookingBridgeProps {
  offeringId: string;
  sessionId?: string;
  participantCount?: number;
}

export function WorkshopBookingBridge({ offeringId, sessionId, participantCount }: WorkshopBookingBridgeProps) {
  const { user } = useAuth();
  const [offering, setOffering] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [offeringData, sessionsData] = await Promise.all([
        getWorkshopOffering(offeringId),
        getWorkshopSessions(offeringId)
      ]);
      setOffering(offeringData);
      setSessions(sessionsData);
    }
    load();
  }, [offeringId]);

  const handleBooking = async (selectedSessionId: string, count: number) => {
    if (!user) {
      // Redirect to auth with return URL
      window.parent.postMessage({
        type: 'tutoria-auth-required',
        returnUrl: window.location.href
      }, '*');
      return;
    }

    setLoading(true);
    try {
      const { bookingId, paymentReady } = await createWorkshopBooking(selectedSessionId, count);

      if (paymentReady) {
        const { redirectUrl } = await startWorkshopPayment(bookingId, crypto.randomUUID());
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Render sessions and booking UI
  // ...
}
```

---

## Phase 5: Host Center Integration

### 5.1 Update center page bridge
**File**: `discover/src/app/center/page.tsx`

**Changes:**
1. Add workshop offering management
2. Add workshop session management
3. Add workshop booking view

### 5.2 Update center.html
**File**: `discover/public/center.html`

**Changes:**
1. Add workshop offering list view
2. Add workshop session management
3. Add workshop booking list view
4. Add workshop-specific tabs/sections

---

## Phase 6: Payment Boundary

### 6.1 Verify `start_payment_attempt` works with auto-created approval
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_verify_payment_flow.sql`

**Test:**
1. Create workshop offering with `booking_mode = 'instant'`
2. Create session for offering
3. Call `create_booking` → should auto-create approval
4. Call `start_payment_attempt` → should succeed
5. Verify payment row created with correct amount

### 6.2 Verify `finalize_paid_booking` handles workshop bookings
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_verify_finalization.sql`

**Test:**
1. Create workshop booking with `pricing_model = 'flat_per_participant_v1'`
2. Simulate payment success via `record_vnpay_observation`
3. Verify booking status updated to `confirmed`
4. Verify pricing snapshot preserved correctly

### 6.3 Implement payment expiration for workshop bookings
**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_payment_expiration.sql`

```sql
-- Create function to expire stale workshop bookings
create or replace function public.expire_stale_workshop_bookings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Cancel workshop bookings older than 30 minutes with pending payment
  update public.bookings b
    set status = 'cancelled',
        cancelled_reason = 'payment_timeout',
        cancelled_by = 'system',
        updated_at = now()
    from public.sessions s
    where b.session_id = s.id
      and s.offering_id is not null
      and b.status = 'requested'
      and b.created_at < now() - interval '30 minutes'
      and exists (
        select 1 from public.payments p
        where p.booking_id = b.id
          and p.status = 'pending'
      );

  -- Release capacity for cancelled bookings
  -- (handled by existing trigger/logic)
end;
$$;

-- Grant access to service role
grant execute on function public.expire_stale_workshop_bookings() to service_role;
```

---

## Phase 7: Security Review

### 7.1 RLS on `offerings` table
**Verified in Phase 1:** RLS enabled, fully revoked, access via RPCs only.

### 7.2 Auto-approval path in `create_booking`
**Verified in Phase 2:** Auto-approval happens inside `create_booking` RPC, never from client.

### 7.3 Service_role authorization for minimum-not-met
**Verified in Phase 2:** `cancel_session` checks `auth.uid() is null` for `minimum_not_met` cause.

### 7.4 Public session visibility
**Verified in Phase 2:** `list_sessions_by_offering_id` grants to `anon` and `authenticated`.

### 7.5 Offering ownership enforcement
**Verified in Phase 2:** `create_offering` and `update_offering_status` check `host_id = uid`.

### 7.6 Price never client-controlled
**Verified in Phase 2:** `create_booking` reads price from `offerings` table, ignores client-provided price.

---

## Phase 8: QA Testing

### 8.1 Unit Tests
**File**: `backend/test/workshop-booking.test.ts` (new file)

**Test cases:**
1. Workshop booking happy path (INSTANT)
2. Workshop booking with capacity enforcement
3. Workshop booking pricing computation
4. Workshop booking payment flow
5. Workshop booking cancellation
6. Minimum-not-met session cancellation
7. Payment expiration for workshop bookings
8. Concurrent workshop bookings

### 8.2 Integration Tests
**File**: `backend/test/workshop-booking-integration.test.ts` (new file)

**Test cases:**
1. End-to-end workshop booking flow
2. Workshop booking with payment success
3. Workshop booking with payment failure
4. Workshop booking with session cancellation
5. Workshop booking with minimum-not-met

### 8.3 Browser E2E Tests
**File**: `discover/src/e2e/workshop-booking.spec.ts` (new file)

**Test cases:**
1. Desktop viewport: Workshop booking flow
2. Mobile viewport (390px): Workshop booking flow
3. Auth interception: Logged-out user redirected to sign-in
4. Payment flow: VNPay redirect and callback
5. Host Center: Workshop booking appears in host view

### 8.4 Concurrency Tests
**File**: `backend/test/workshop-booking-concurrency.test.ts` (new file)

**Test cases:**
1. Last-seat booking
2. Multi-seat booking
3. Over-capacity rejection
4. Concurrent minimum evaluation

---

## Phase 9: Final Verification

### 9.1 Exit Gate Checklist
- [ ] Workshop offering created via API
- [ ] Workshop sessions created with real UUIDs
- [ ] Workshop booking creates real DB records
- [ ] Pricing is server-computed from offering
- [ ] Instant booking skips approval gate
- [ ] Capacity is serialized
- [ ] Payment flow works end-to-end
- [ ] Minimum-not-met cancels session + creates refund obligations
- [ ] Workshop cancellation triggers refunds for paid bookings
- [ ] Frontend displays real sessions with UUIDs
- [ ] RLS enforced on offerings table
- [ ] Desktop viewport E2E passes
- [ ] Mobile viewport (390px) E2E passes
- [ ] Concurrency tests pass
- [ ] Security review passes

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Schema Migration | 1 day | None |
| Phase 2: RPC Modifications | 2 days | Phase 1 |
| Phase 3: Backend Routes | 1 day | Phase 2 |
| Phase 4: Frontend Workshop Bridge | 2 days | Phase 3 |
| Phase 5: Host Center Integration | 1 day | Phase 4 |
| Phase 6: Payment Boundary | 1 day | Phase 3 |
| Phase 7: Security Review | 1 day | Phase 6 |
| Phase 8: QA Testing | 2 days | Phase 7 |
| Phase 9: Final Verification | 1 day | Phase 8 |
| **Total** | **12 days** | |

---

## Risk Mitigation

1. **Schema migration risk**: Test migrations on staging before production
2. **RPC modification risk**: Backward compatible changes only; preserve existing hourly_v1 logic
3. **Frontend integration risk**: Use feature flag for workshop booking; fallback to demo mode
4. **Payment flow risk**: Test VNPay sandbox integration thoroughly
5. **Concurrency risk**: Load test with concurrent workshop bookings

---

## Success Criteria

1. Workshop booking creates real database records (not demo data)
2. Pricing is server-computed and immutable
3. Capacity enforcement works correctly
4. Payment flow completes successfully
5. Minimum-not-met cancellation works correctly
6. Host Center shows real workshop bookings
7. Desktop and mobile E2E tests pass
8. Security review passes
