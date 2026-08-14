# Agent Team → End Product Map

```text
CAPACITY + CONCURRENCY
  backend_engineer + verifier
        ↓
DOMAIN V1 FREEZE
  backend_engineer + verifier
        ↓
SUPABASE SCHEMA / MIGRATIONS
  database_engineer
        ↓
RLS / AUTHORIZATION
  database_engineer + security_reviewer
        ↓
TRANSACTIONS / CAPACITY SERIALIZATION
  database_engineer + backend_engineer + qa_engineer
        ↓
APPLICATION SERVICES / PRODUCTION API
  integration_engineer + backend_engineer
        ↓
EVENT OUTBOX
  integration_engineer + database_engineer
        ↓
PAYMENT PROVIDER / WEBHOOKS / REFUNDS / PAYOUTS
  payments_engineer + integration_engineer + security_reviewer + qa_engineer
        ↓
NOTIFICATIONS
  integration_engineer + reliability_engineer when durable delivery is introduced
        ↓
REAL FRONTEND VERTICAL SLICE
  frontend_engineer + integration_engineer + qa_browser
        ↓
BACKEND + BROWSER E2E HARDENING
  qa_engineer + qa_browser + security_reviewer
        ↓
OBSERVABILITY / RECOVERY / STAGING
  reliability_engineer + verifier
        ↓
PRIVATE ALPHA
        ↓
PRODUCTION MVP
```

The orchestrator selects only the specialists required for each arrow. `context_scout` is a pre-step only when evidence is actually missing.
