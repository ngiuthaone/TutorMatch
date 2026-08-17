---
name: tutoria-idempotency-outbox
description: Design idempotent Tutoria commands and durable outbox/event handoff. Use for retries, duplicate API delivery, payment webhooks, notifications, and any mutation whose side effects may be delivered asynchronously.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria idempotency and outbox

## Idempotency
Define the operation identity, deduplication scope, replay result, conflict semantics, and durable uniqueness needed to prevent duplicate business effects. A retry after an ambiguous network outcome must not double-confirm, double-reschedule, double-refund, double-payout, or double-release/acquire capacity.

## Outbox
Persist the authoritative local mutation and the durable event/outbox record within the same local transaction when atomicity is required. Delivery may be eventual; durable recoverability may not be optional.

Events should carry stable identifiers and enough version/context for consumers without turning events into a second mutable truth store. Consumers must be idempotent where duplicate delivery is possible.
