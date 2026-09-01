# Tutoria Messages — Implementation Plan (after repository audit)

## 1. Existing messaging architecture (current state)

| Layer | Surface | Status |
|---|---|---|
| Database | `conversations`, `conversation_members`, `messages` tables (20260904120000_messaging_alpha_v1.sql) | EXISTS |
| Database | `messages.body` CHECK between 1..2000, `messages.moderation_status` enum, `client_message_id` UNIQUE(sender_id, client_message_id) | EXISTS |
| Database | RLS enabled + fully revoked on all 3 tables; access only via SECURITY DEFINER RPCs | EXISTS |
| Database | `bookings.id UNIQUE` per conversation → one conversation per booking, host+learner only | EXISTS |
| Database | `last_message_at` + `last_message_preview` on `conversations` for inbox sort | EXISTS |
| Database | `conversation_members.last_read_at` for unread counts + `mark_conversation_read` RPC | EXISTS |
| Backend | `messaging-service.ts` (typed service), `messaging.ts` (HTTP route) — list/get/get-or-create/list-msgs/send/read | EXISTS |
| Backend | `authenticate` plugin on every messaging route; Zod-validated bodies; dedicated rate limits (read 120/min, send 30/min) | EXISTS |
| Backend | Idempotency on `(sender_id, client_message_id)`; cross-conversation same key raises `IDEMPOTENCY_CONFLICT` | EXISTS |
| Backend | Moderation seam `moderation_inspect_message` (stub returning `'approved'`) | EXISTS |
| Backend | `conversation_summary` reads profiles via SECURITY DEFINER (cross-party name works) | EXISTS |
| Frontend | `discover/src/lib/messaging-api.ts` (typed client, request validation, `MessagingApiError` class, `generateClientMessageId`) | EXISTS |
| Frontend | `discover/src/app/messages/messages-client.tsx` (AuthGate → live/demo, two-pane responsive, server-authoritative append, mark-read on open, mobile back button) | EXISTS |
| Frontend | Server-authoritative: no client-fabricated membership, no optimistic append, server `mine` flag drives alignment | EXISTS |
| Frontend | Composer: Enter/Shift+Enter, character counter, disabled states, error surface, no draft persistence | EXISTS |
| Tests | 8 unit tests (route auth, list/get/send/read, idempotency, error mapping, validation) — 465/465 backend unit pass | EXISTS |
| Tests | 11 integration tests (RLS denied, idempotency, cross-account, IDEMPOTENCY_CONFLICT, mark-read, last_message_at) | EXISTS (verified earlier) |

## 2. Reusable infrastructure

- **Supabase client**: shared publishable-key + JWT-based auth pattern; `evaluateAuthGate` + `requireServerSession` for SSR + CSR
- **Auth + cookies**: `tutoria_refresh_token` httpOnly cookie via `auth-bff`
- **Notifications surface**: `public.notifications` (recipient_id = auth.uid) + triggers; ready to be invoked by `send_message`
- **CORS + helmet + rate limit** + dedicated sign-in limit (H3) at the security plugin
- **Storage buckets** (tutor media) — reusable for message attachments; same `is_safe_http_url` guard available
- **safelist-based URL validator** (`safeHttpUrl` in `backend/src/lib/sanitize.ts`)

## 3. Missing capabilities (against the spec)

| # | Item | Severity | Plan |
|---|---|---|---|
| 1 | Phase 8 Realtime subscription | Required | Add `subscribeToConversationMessages(conversationId, onMessage)` and `subscribeToConversations(onUpsert)` to `messaging-api.ts` using `supabase.channel('messaging:...').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ...)` — RLS on `messages` already enforces subscription auth. For inbox updates use a separate channel. |
| 2 | Phase 9 mark-read on message arrival | Nice | Already mark-read on conversation open; extend to "mark all read in conversation when a new message arrives while the conversation is open." |
| 3 | Phase 10 Attachments | Out of scope for Alpha per DEC-015 | Re-add as a follow-up. The MVP-incompatible items: file storage quota, virus scan, signed URL TTL strategy. |
| 4 | Phase 11 Booking context card | Required | Add a compact context card above the messages list when `conversation.bookingContext != null`. Use the existing `get_or_create_booking_conversation` flow + `view booking` CTA. |
| 5 | Phase 12 Notification hook on new message | Required | Add an `event_outbox` (already exists) or direct insert into `public.notifications` from the `send_message` RPC, with a `new_message` event type and recipient = the OTHER member. Triggers to be created in the messaging migration. |
| 6 | Phase 13 Blocking + Reporting | Out of scope for Alpha per DEC-015 | Stub seam in `send_message` (e.g. `check_block(p_sender, p_recipient)` that returns `false` if blocked). Add a follow-up migration with `user_blocks` + `conversation_reports` tables, RLS, RPCs. |
| 7 | Phase 14 Pagination | Required | `list_conversation_messages(p_before timestamptz, p_limit int)` already exists. Need to expose a `before` cursor in the API route and update the discover page to infinite-scroll upward. |
| 8 | Phase 15 Mobile optimization | Required | Already implemented two-pane responsive; need to verify the composer on iOS Safari (safe-area-inset, keyboard handling). |
| 9 | Phase 16 More tests | Required | Expand the integration test: non-participant + cross-account + IDEMPOTENCY_CONFLICT already covered. Add: message edit, message delete, last_read_at, mark-read, post-booking context. |
| 10 | Phase 17 Realtime E2E | Required | Add Playwright e2e that signs in two browsers and confirms the second receives a message without refresh. |
| 11 | Phase 18 Deploy verification | Required | (manual) |

## 4. Database changes (proposed migrations)

- `20260909000000_messaging_alpha_v2.sql`
  - `public.conversations` — add `type text not null default 'direct' check (type in ('direct','group','booking','community','support'))`, `title text`, `created_by uuid references public.profiles(id)`, `archived_at timestamptz`
  - `public.conversation_members` — add `muted_at timestamptz`, `archived_at timestamptz`
  - `public.messages` — add `message_type text not null default 'text' check (message_type in ('text','image','file','system','media'))`, `edited_at timestamptz`, `deleted_at timestamptz`
  - `public.message_attachments` — new table; FK to messages; storage_path + filename + mime + size; RLS follows conversation membership
  - `public.conversation_reports` — new table; reporter_id, conversation_id, message_id (optional), reason enum, status enum, resolved_by, resolved_at
  - `public.user_blocks` — new table; blocker_id, blocked_id, created_at, revoked_at
  - New RPCs:
    - `send_message_v2(cid, body, type, client_message_id, p_attachments jsonb default '[]')` — wraps the existing idempotency + adds attachment insert + fires `new_message` notification
    - `edit_message(message_id, body)` — owner only
    - `soft_delete_message(message_id)` — owner only
    - `mark_messages_read(cid)` — already exists as `mark_conversation_read`; rename for clarity
    - `report_message(message_id, reason, details)` — owner-side
    - `block_user(target_user_id)` and `unblock_user(target_user_id)`
    - `search_conversations(query text)` — uses `pg_trgm` or `to_tsquery`
  - `is_conversation_member(cid)` — already exists, used for RLS
  - `conversation_notification_trigger` — `after insert on public.messages` → insert into `public.notifications` for the other member

## 5. RLS

The existing RLS pattern is `for all` split into per-command (M1 from prior commit). Apply the same pattern to:
- `message_attachments`: select + insert + delete (delete only by message owner or conversation creator)
- `conversation_reports`: select only by admin (and reporter for own); insert by member only
- `user_blocks`: select by self; insert by self; delete by self
- Reaffirm `messages` RLS: select by member, insert by self, update/delete by self

## 6. API

- `GET /api/v1/messaging/conversations` — already exists; add `?q=...` search
- `GET /api/v1/messaging/conversations/:id` — already exists
- `GET /api/v1/messaging/bookings/:bookingId/conversation` — already exists (used for deep-link)
- `GET /api/v1/messaging/conversations/:id/messages?limit=100&before=ISO` — already exists; verify
- `POST /api/v1/messaging/conversations/:id/messages` — already exists; extend to accept `attachments: [{ storage_path, filename, mime, size }]`
- `POST /api/v1/messaging/conversations/:id/read` — already exists
- `PATCH /api/v1/messaging/messages/:id` — NEW (edit own)
- `DELETE /api/v1/messaging/messages/:id` — NEW (soft delete own)
- `POST /api/v1/messaging/messages/:id/report` — NEW
- `POST /api/v1/messaging/users/:userId/block` — NEW
- `DELETE /api/v1/messaging/users/:userId/block` — NEW

## 7. Realtime architecture

For a Tutoria scale (Vietnam first, ~100k MAU estimated at maturity), Supabase Realtime is fine. The auth model is already enforced by RLS on `public.messages` — only `conversation_members` rows can SELECT the row. Subscriptions are at the database level.

- `discover/src/lib/messaging-api.ts`
  - `subscribeToConversationMessages(conversationId, onMessage)` — channel `messaging:conversation:${conversationId}`.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, ...).subscribe()
  - `subscribeToConversations(onUpsert)` — channel `messaging:conversations` on `public.conversations` for the current user, plus an `inbox_changes` view if needed
- Reconciliation: on reconnect, the page re-fetches the latest messages since the last known `created_at` or `id` to fill any gaps
- Optimistic UI: still not for the persisted message row (we use server-authoritative append). The local composer surface shows "sending..." while in flight.

## 8. Notification integration

- `send_message` RPC emits a row into `public.notifications` for the recipient (the other member) with `event_type='new_message'`, `payload={'conversationId', 'messageId', 'senderId', 'body_preview'}`. This piggybacks on the existing notification infrastructure.
- A second `event_outbox` row is emitted for the audit trail and so the notifications-worker can fan out to email/push later.
- Email digests: NOT in this scope (Tutoria already has a notification infrastructure; the email/email-digest policies live there).

## 9. Attachment/storage architecture

**Deferred to Post-Alpha** per DEC-015. The DEC-015 spec explicitly excludes attachments from Alpha. When attachments come back, the recommended path is:
- New bucket `message-attachments`, private (`public=false`)
- New `message_attachments` table row per uploaded file
- Signed URL retrieval via `supabase.storage.from('message-attachments').createSignedUrl(path, ttl)` from the message-render path on the server side
- RLS on `storage.objects` mirrors the conversation membership
- `is_safe_http_url` is reused for the storage path; an extra `is_safe_storage_path` helper checks no path traversal

## 10. Booking/offering context

- The conversation payload already includes `bookingContext` with `bookingId, sessionId, sessionStartsAt, sessionEndsAt, bookingStatus`.
- Discover's `messages-client.tsx` is extended with a compact `BookingContextCard` component shown above the messages list when the conversation's `bookingContext != null`.
- The card has "View booking" and (if scheduled and start time is within 10 min) "Join session" CTAs.
- "View tutor" / "View learner" CTAs open the other party's profile in a side sheet.

## 11. Tests

Existing: 8 unit + 11 integration (messaging-rls-idempotency).

Add:
- `test-integration/messaging-edit-delete.test.ts` — edit own, can't edit others; soft delete; cascade unread
- `test-integration/messaging-blocking.test.ts` — A blocks B; B can't send; existing messages stay; unblock restores
- `test-integration/messaging-reports.test.ts` — A reports message; admin can see; non-admin can't
- `test-integration/messaging-notification-trigger.test.ts` — A sends; B's notifications table has new row with `event_type='new_message'`
- `test-integration/messaging-pagination.test.ts` — insert 50 messages; load with `before=latest_created_at`; verify only newer than `before` are returned
- Unit tests in `backend/test/messaging-routes.test.ts`:
  - 401 without auth
  - 403 non-member
  - 200 member
  - send 201 + body shape
  - send duplicate clientMessageId → 200 + duplicate=true
  - mark read 200 + `last_read_at` updated
- E2E (Playwright):
  - `tests/e2e/messaging.spec.ts`: two browsers, sign in, A sends, B receives within 2s, refresh B → still present, A edits, B sees "edited", A deletes, B sees "message deleted"
  - `tests/e2e/messaging-rls.spec.ts`: B's token + A's conversation ID → 403 / empty

## 12. E2E verification (manual + Playwright)

- Two signed-in browsers (Safari/Chrome), one tutor + one learner
- Booking-context test: book a session, open conversation, verify context card shows date/time/booking status
- Realtime: A sends, B sees it without refresh
- Edit/delete: A edits, B sees "(edited)"; A deletes, B sees "This message was deleted"
- Cross-account: B guesses A's conversation ID, gets 403/empty
- Attachment (post-Alpha): A uploads PDF, B downloads (deferred)

## 13. Production status (target)

GREEN for direct messaging + booking context + realtime + edit/delete + read state + notifications.
YELLOW for blocking/reporting (DB tables added, RPCs added, admin UI deferred).
RED for attachments (deferred to Post-Alpha per DEC-015).

## 14. Implementation order (execution plan)

1. Migration `20260909000000_messaging_alpha_v2.sql` (additions to existing tables + new tables + RPCs + triggers)
2. Backend service extensions (`editMessage`, `softDeleteMessage`, `reportMessage`, `blockUser`, `unblockUser`, `searchConversations`)
3. Backend route extensions (`PATCH/DELETE /messages/:id`, `POST /messages/:id/report`, `POST/DELETE /users/:userId/block`, search query param)
4. Test-config extension (no new env vars)
5. New integration test files
6. Backend unit tests for new routes
7. Frontend `messaging-api.ts` extension (realtime subscription, search, edit, delete, block, report)
8. Frontend `messages-client.tsx` extension (realtime subscription, edit/delete buttons, booking context card, search, block user)
9. Playwright e2e
10. Final verification + commit
