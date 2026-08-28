---
name: tutoria-supabase-persistence
description: Translate accepted Tutoria domain facts into Supabase/PostgreSQL schema, migrations, constraints, indexes, and historical snapshots. Use only after domain policy is sufficiently settled for persistence.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria Supabase persistence

## Before editing
Read accepted domain architecture, current migrations/schema/RLS, applicable `AGENTS.md`, and existing data ownership conventions. Verify current Supabase behavior against official documentation when implementation details may have changed.

## Design principles
- One authoritative persisted source per business fact.
- Stable Booking and Session identities remain stable.
- Session owns scheduled-occurrence snapshots such as times/capacity when accepted architecture says so.
- Preserve historical participant quantity and financial references.
- Use foreign keys, checks, uniqueness, and indexes to enforce structural invariants.
- Do not encode unsettled product policy as irreversible schema when a reversible representation can safely defer it.
- Prefer additive/bounded migrations; never casually rewrite migration history.

## Output
Schema mapping, constraints, migration plan, indexes, RLS coordination needs, rollback/data-migration concerns, tests, and unresolved product decisions.
