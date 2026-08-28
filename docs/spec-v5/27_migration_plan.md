# 27 — MIGRATION PLAN (MIG)

**Purpose:** authoritative plan to reach clean, parity, auto-applied migrations. This is a **owner-gated** plan — migrations that alter schema on prod require owner approval (per audit rule). The plan records current reality and the exact steps; it does **not** self-execute.

---

## 27.1 Current reality (REAL-002/003/004)

- Local: 22/27 (reported blocked by `20260820100000` replay defect — **reproduce at apply to confirm**, see note).
- Prod: 24/27 (has remote-only `20260817160000`/`20260817160001` absent from repo, content UNKNOWN `UNK-003`).
- In-repo but not on prod: `20260819120000`, `20260820000000`, `20260820100000/01/02`, `20260820120000`, `20260820130000`.

## 27.2 Principles

- `MIG-001` — Migrations are idempotent/replayable from a clean seed; no hand-patched DB as source of truth.
- `MIG-002` — Repo is authoritative for shared history; prod-only changes without repo source are resolved either by extracting them into the repo (`MIG-xxx`) or documented as known divergent state (`UNK-003`) before replay.
- `MIG-003` — Schema/money correctness changes require owner approval (audit never applies destructive/schema changes on prod).
- `MIG-004` — No silent prod DDL; every applied migration is recorded and tested on a staging clone first.

## 27.3 Plan steps

| MIG-0xx | Step | Gate | Owner |
|---|---|---|---|
| MIG-010 | Reproduce + fix any `20260820100000` replay defect (it adds `ADD CONSTRAINT offerings_pricing_model_check`; no in-repo partner found — confirm whether a remote-only migration supplied it) so local head replays cleanly | owner | database_engineer |
| MIG-011 | Re-extract/determine `20260817160000/01` content; bring into repo parity or document divergence | ops/owner | database_engineer+ops |
| MIG-012 | Apply remain-in-repo corrective migrations on prod in order (including `20260820130000` canonical `create_booking`) | owner | database_engineer |
| MIG-013 | Reset local to seed and verify head replays 27/27 cleanly (add `ITST-mig`) | — | database_engineer+qa |
| MIG-014 | After parity, re-run integration suite on clean DB (replace `UNVERIFIED` `REAL-011`) | — | qa_engineer |

## 27.4 Sequencing constraints

- `MIG-020` — `IMPL-001..003`/`GAP-001..004` all block on `MIG-010..012`.
- `MIG-021` — `create_booking` canonical signature must land before booking/payment integration is re-verified.

## 27.5 ACCEPTANCE

- `AC-MIG-001` — Local head replayable cleanly (27/27); integration suite re-runs.
- `AC-MIG-002` — Repo ≈ prod migration set documented/reconciled (`UNK-003` resolved or explicitly recorded).
- `AC-MIG-003` — No unapproved prod DDL.

---

## 27 RTM

| Req ID | Req | Link | Test | Acceptance |
|---|---|---|---|---|
| MIG-010 | local replay fix | GAP-001 | `ITST-mig` | `AC-MIG-001` |
| MIG-011 | remote parity | UNK-003 | — | `AC-MIG-002` |
| MIG-012 | apply corrective on prod (gated) | GAP-004 | — | `AC-MIG-003` |
| MIG-013 | clean-seed replay | — | `ITST-mig` | `AC-MIG-001` |
