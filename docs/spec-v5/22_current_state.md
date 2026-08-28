# 22 — FEATURE-BY-FEATURE CURRENT STATE + EVIDENCE REGISTRY (REAL / EVID)

**Surface:** current per-feature truth (EXISTENCE/FUNCTIONALITY/CONNECTIVITY/RUNTIME/COMPLETENESS — the 5-way ladder) + the evidence registry referenced by every RTM.
**Primary evidence:** `docs/TUTORIA_MASTER_TECHNICAL_INVENTORY.md` (full ledger) + verified runtime/test evidence.

> **Ladder definition (applied to every feature):** EXISTENCE (does the code/route/schema exist) → FUNCTIONALITY (does it do what it claims in isolation) → CONNECTIVITY (does it reach its real data/authorization) → RUNTIME (does it work under real actors on the deployed shell) → COMPLETENESS (does the whole loop close with authoritative state).

---

## 22.1 Per-feature current state (workshop-dominant Alpha)

| Feature | EX | FU | CO | RT | C | Evident gap |
|---|---|---|---|---|---|---|
| Auth (Supabase) | ✔ | ✔ | ✔ | demo-gated | ✘ | demo gate `REAL-006` |
| Discover/catalog listing | ✔ | ✔ | ✔ | unverified | partial | server listing RPC |
| Workshop listing | ✔ | ✔ | partial/legacy | — | ✘ | live data path |
| Workshop detail | ✔ | ✔ | ✔ | broken | ✘ | `offeringType`/`kind` (`REAL-009`) |
| Post-booking route | ✘/404 | — | — | — | ✘ | `BLK-001` |
| Workshop creator | partial | ✘ | ✘ (localStorage) | — | ✘ | `WORK-003-BUG-1` |
| Shared booking engine | ✔ | ✔ | ✔ | unverified | partial | capacity/wiring |
| create_booking | ✔ | ✔ | ambiguous (2/3 arg) | — | ✘ | `REAL-004` |
| Payment adapter | ✔ | ✔ | partial | ✘ | ✘ | provider/keys `PAY-060` |
| Refund path | ✔ | partial | partial | — | ✘ | policy `DEC-*` |
| Worker expiry sweep | DB+svc | ✔ | ✘ not dispatched | — | ✘ | `REAL-007`/`BLK-002` |
| Host Center | ✔ | partial | hybrid | — | ✘ | native rewrite |
| Learner bookings | ✔ | ✔ | ✔ | — | partial | detail missing |
| Tutor booking | partial | partial | fixture | — | ✘ | P1 |
| Events/classes/courses | ✔ | embed/mock | ✘ | — | ✘ | defer |
| Social/MSG/Notif/LMS/Rev/Photo | ✔ | mock | ✘ | — | ✘ | defer |
| Admin/analytics | — | — | — | — | ✘ | defer |
| Storage buckets | — | — | ✘ not provisioned | — | ✘ | `REAL-010` |

## 22.2 Evidence registry (EVID)

`EVID-001` — backend unit tests 337/337 PASS (SOURCE/TEST). `REAL-011`.
`EVID-002` — discover unit 165/165 PASS. `REAL-011`.
`EVID-003` — root auth 100/100 PASS (prior). `REAL-011`.
`EVID-004` — integration suite blocked by local DB drift (26F/24P/99S prior) — `UNVERIFIED`, not re-run. `REAL-011`.
`EVID-005` — migration diff local 22/27, prod 24/27; `20260817160000/01` remote-only content UNKNOWN. `REAL-002`/`UNK-003`.
`EVID-006` — `20260820100000` replay defect (SQLSTATE 42710). `REAL-003`.
`EVID-007` — `create_booking` 2-arg vs 3-arg ambiguity. `REAL-004`.
`EVID-008` — Expiry sweep: service method `sweepExpiredWorkshopBookings` (`payment-service.ts:206`) calls RPC `expire_stale_workshop_bookings`, but **neither is dispatched** by `runFinancialWorkerIteration` (only 3 sweeps). `REAL-007`.
`EVID-009` — `/bookings/[id]` missing → 404. `REAL-008`/`BLK-001`.
`EVID-010` — `events-live/[slug]/page.tsx:30` checks `offeringData.offeringType !== "event"` but the surface serves `workshop` offerings → detail shows "Event not found". `REAL-009`.
`EVID-011` — `discover/src/lib/auth/config.ts:45` demo gate. `REAL-006`.
`EVID-012` — `discover/src/proxy.ts` no-op. `REAL`/`SEC-003`.
`EVID-013` — creator writes localStorage `published-event-store.ts`, not `create_offering`/`create_session`. `REAL`/`WORK-003-BUG-1`.
`EVID-014` — `/api/events`+/api/tutors` use `server-verify.ts`; page routes unprotected. `REAL`.
`EVID-015` — no storage bucket provisioned. `REAL-010`.
`EVID-016` — live deploy previously demo-mode; prod payment runtime off-limits/UNVERIFIED. `REAL-012`.

## 22.3 Contradictions / unknowns (index; full in §39 master + `33_product_decisions.md`)

`UNK-001` — `events/[slug]` runtime data path (shared detail + fixture) to confirm.
`UNK-002` — `session_hard_reserved` per-participant vs 1:1 semantics → `PRODUCT DECISION REQUIRED` (`DEC-*`).
`UNK-003` — `20260817160000/01` remote-only content unknown.
`UNK-004` — Prod deployment/payment runtime off-limits/UNVERIFIED.
`UNK-005` — `20260819130000` fix migration provenance.

`REAL` Id list resolved in `docs/TUTORIA_MASTER_TECHNICAL_INVENTORY.md`.
