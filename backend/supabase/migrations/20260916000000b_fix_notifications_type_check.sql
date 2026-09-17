-- 20260916000000_fix_notifications_type_check.sql
-- The notifications.type CHECK constraint has been rebuilt several times as new
-- notification types were added (new_message, session_published, mention). Each
-- rebuild dropped previously-allowed values, so the live constraint rejected
-- message notifications with:
--   "new row for relation \"notifications\" violates check constraint \"notifications_type_check\""
--
-- This migration restores the full set of known notification types in one
-- place so future additions only touch this file.
set search_path = '';

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'like',
    'comment',
    'reply',
    'repost',
    'follow',
    'new_message',
    'session_published',
    'mention'
  )) not valid;

-- Validate so the constraint is enforced going forward.
alter table public.notifications validate constraint notifications_type_check;