---
name: tutoria-server-authoritative-ui
description: Keep Tutoria frontend state subordinate to server-authoritative booking, capacity, payment, permissions, and lifecycle facts. Use when connecting prototype UI to production APIs or handling conflicts/retries.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria server-authoritative UI

The client may submit intent such as target Session, requested participant quantity, or cancellation/reschedule action. The server owns availability, capacity, actor permissions, lifecycle state, payment truth, and conflict outcomes.

UI requirements:
- render canonical server state after mutations;
- handle stale/insufficient-capacity/conflict errors explicitly;
- avoid optimistic updates that fabricate successful booking/payment states;
- refresh/retry must not duplicate commands;
- loading, error, empty, unauthorized, cancelled, sold-out, and payment-pending/failure surfaces remain distinct;
- prototype/localStorage/demo state must never become production business truth.
