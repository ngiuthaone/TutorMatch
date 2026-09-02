-- Migration: OUTBOX_PROCESSOR.sql
-- Adds outbox processing columns and index for edge function processing

set search_path = public;

-- Add processing tracking columns
alter table event_outbox add column if not exists processed_at timestamptz;
alter table event_outbox add column if not exists last_error text;
alter table event_outbox add column if not exists retry_count integer not null default 0;

-- Index for efficient polling of unprocessed events
create index if not exists idx_event_outbox_unprocessed 
  on event_outbox(processed_at) 
  where processed_at is null;
