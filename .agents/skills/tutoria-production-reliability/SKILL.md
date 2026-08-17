---
name: tutoria-production-reliability
description: Make Tutoria production failures observable, diagnosable, retryable where safe, and recoverable. Use for outbox workers, notifications, payment reconciliation, background jobs, deployment/runtime health, and incident readiness.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria production reliability

Design from concrete failure modes:
- authoritative DB mutation succeeded but downstream event delivery failed;
- provider call timed out with ambiguous result;
- duplicate/reordered events;
- stuck outbox/notification job;
- worker crash/redeploy;
- reconciliation mismatch;
- repeated poison event;
- partial deployment/config failure.

Provide structured correlation identifiers, bounded retries/backoff, idempotent consumers, durable retry state where needed, reconciliation, and incident diagnostics. Never log secrets/private addresses/payment credentials. Logs are evidence, not business truth. Avoid adding queues/distributed infrastructure without a concrete requirement.
