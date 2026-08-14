---
name: tutoria-payment-integration
description: Integrate a real payment provider with Tutoria while preserving the separate Payment/Refund/Payout domain. Use for checkout/payment intents, provider adapters, refunds, payouts, reconciliation, and financial auditability.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria payment integration

## Hard boundaries
- BookingStatus does not become payment status.
- Payment success does not by itself guarantee booking confirmation or capacity.
- Remote provider calls are not atomic with PostgreSQL transactions.
- Provider identifiers, amounts, currency, fee components, refund/payout records, and idempotency keys must be auditable.

## Procedure
1. Confirm accepted payment sequencing policy or mark unresolved decisions.
2. Define provider-independent internal Payment/Refund/Payout facts.
3. Map provider objects/events into those facts.
4. Define idempotency and ambiguous-outcome recovery.
5. Define reconciliation between provider truth and local records.
6. Route any resulting booking action through normal Booking/Session/capacity orchestration.
7. Add financial failure-path tests.

If Stripe is chosen, use the official Stripe skill/plugin only after exact-current verification and existing security/license policy.
