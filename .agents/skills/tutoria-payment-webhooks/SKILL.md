---
name: tutoria-payment-webhooks
description: Handle payment-provider webhooks securely and idempotently for Tutoria. Use when provider events can arrive duplicated, delayed, reordered, forged, or after client/network failures.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria payment webhooks

Required flow:
1. Receive raw provider request through the supported endpoint.
2. Verify authenticity/signature using the provider's current official requirements.
3. Parse provider event and stable event identifier.
4. Deduplicate durably.
5. Map to a provider-independent internal payment/refund/payout fact.
6. Persist internal effect transactionally with any local outbox record.
7. Trigger booking orchestration only through accepted application-service rules.
8. Respond according to provider retry semantics.

Test duplicate events, reordered events, invalid signatures, stale events, unknown object IDs, partial local failures, and ambiguous previous provider outcomes. Never log secrets or raw sensitive payment payloads unnecessarily.
