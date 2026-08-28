# 24 — GAP SPECIFICATION (GAP)

**Purpose:** exhaustive, ID'd gap between CURRENT and TARGET for the Alpha loop. Each gap states who closes it (agent role), which contract/section it belongs to, and its link to `BLK-*`/`REAL-*`/`AC-*`. This is the engineering handoff: no consumer should rediscover these gaps.

---

## 24.1 Migration / DB gaps

| GAP-0xx | Gap | Belongs | Blocker/link | Closer |
|---|---|---|---|---|
| GAP-001 | Local 22/27 not replayable to head — `20260820100000` adds `ADD CONSTRAINT offerings_pricing_model_check`; reported 42710 requires reproduction at apply (no in-repo partner; likely remote-only `20260817160000/01`) | 27_migration | `REAL-003`/`BLK-003` | database_engineer + owner gate |
| GAP-002 | Prod 24/27: repo ≠ prod; remote-only `20260817160000/01` content unknown | 27_migration | `UNK-003` | database_engineer + ops |
| GAP-003 | `create_booking` has 2-arg (`(uuid,int)`) and 3-arg (`(uuid,int,text)`) overloads in repo; `20260820130000` (committed) drops 2-arg; prod-side state UNVERIFIED | 14_rpc | `REAL-004`/`BLK-003` | database_engineer + owner |
| GAP-004 | Corrective `20260820130000` (canonical create_booking, pricing/ACL) not applied on prod | 27_migration | gated | database_engineer + owner |

## 24.2 Alpha loop gaps

| GAP-0xx | Gap | Belongs | Blocker/link | Closer |
|---|---|---|---|---|
| GAP-010 | `/bookings/[id]` missing (404) but post-booking redirects there | 06_learner | `BLK-001`/`REAL-008` | frontend+backend |
| GAP-011 | Workshop pending-payment TTL never sweeps → capacity leak | 17_worker | `BLK-002`/`REAL-007` | worker+db |
| GAP-012 | Workshop detail `offeringType` vs `kind` mismatch → false "Event not found" | 01_workshop | `REAL-009` | frontend+backend |
| GAP-013 | Creator persists to localStorage not Offering/Session | 01_workshop | `WORK-003-BUG-1` | frontend+backend |
| GAP-014 | Live vs demo separation not enforced for transactions | 00_auth/15_sec | `REAL-006`/`SEC-031`/`BLK-006` | backend+security |
| GAP-015 | Incomplete payment path (provider/keys/return truth) | 04_pay/16_pay | `BLK-005`/`PAY-060` | payments+browser |
| GAP-016 | Proxy no-op leaves page-route auth unclear | 15_sec/11_api | `SEC-003` | backend+security |
| GAP-017 | Tutor booking still fixture-based (P1) | 07_tutor | — | backend+frontend |
| GAP-018 | Host Center hybrid/iframe → native server-backed | 05_host | — | frontend |

## 24.3 Surface / infra gaps

| GAP-0xx | Gap | Belongs | Blocker/link | Closer |
|---|---|---|---|---|
| GAP-020 | No storage buckets provisioned | 19_storage | `REAL-010`/`BLK-008` | infra+security |
| GAP-021 | No production notifications/messaging/analytics | 18/21/10 | `REAL-010` | defer Post-Alpha |
| GAP-022 | `20260817160000/01` unknown content blocks exact migration parity reasoning | 27_migration | `UNK-003` | ops |
| GAP-023 | **Booking flow captures NO learner phone/contact** — `create_booking(session_id,count,idempotency)` has no phone param; booking-cta is a button only. Hosts cannot reach learners for 1:1/workshop. | 40_uiux_tutor_profile / 41_uiux_workshop_booking | `DEC-013`/`TUT-UX-000`/`BOOK-UX-000` | **`DEC-013` RESOLVED (28 Aug) — `bookings.learner_phone`, host-only RLS; backend+frontend** |
| GAP-024 | **Live-mode tutor onboarding data loss** — only ~10 of ~40 collected fields persist to backend; photo/video/credentials/FAQs/policies/consultation/visibility silently dropped, no warning | 10_admin | `AUD-003` | backend+frontend |
| GAP-025 | **Sign-up wizard decorative in live mode** — roles/interests/preferences never persisted when live | 00_auth | `AUD-004` | backend+frontend |
| GAP-026 | **RequireAuth infinite spinner on `unavailable` + wrong copy + query-state loss after sign-in** (drops `?slot=…`) | 00_auth | `AUD-005` | frontend |
| GAP-027 | **Notifications are localStorage in live mode too** — live bell always 0, no cross-device sync | 18_events | `AUD-006` | backend+frontend |
| GAP-028 | **Dead nav links/CTAs** — `/saved /dashboard /settings /help /terms /privacy`; Create-menu + mobile Notifications + "Become a Creator" inert | route registry / header | `AUD-007` | frontend |
| GAP-029 | **Profile version sprawl** — 13 identical `/v3..v15` routes + inert Follow/Message + verified-badge-for-all | social | `AUD-008` | frontend (cleanup) |
| GAP-030 | **Live tutor profile data gaps** — avatar initials-only (no photo field in backend schema), rating/reviews/lessons hardcoded 0 | 40_uiux | `AUD-009` | backend+frontend |

## 24.4 Gaps by requirement area (from RTM across surfaces)

All `✘`/`partial` rows in `22_current_state.md` are gaps owned by their surface contract's RTM. Aggregated Alpha-blocking set:

- `GAP-010..015` are **Alpha-blocking** (`BLK-001..007`).
- `GAP-020` blocking avatar/thumbnail upload (Alpha-seeded only, not money-blocking).
- `GAP-017` blocking second Alpha loop (tutor) — P1.

## 24.5 Gap → phase mapping

- `GAP-001..004` → `PH-0` migration reconciliation (owner-gated).
- `GAP-012,013,014,016` → `PH-1` workshop vertical slice (dev/demo-loops).
- `GAP-010,011,015` → `PH-2/3` booking+payment+detail for real-money correctness (against authorized provider).
- `GAP-025,026` → `PH-1` auth integrity (P0).
- `GAP-023` (contact capture) + price integrity → `PH-2` (P0).
- `GAP-017` → `PH-4` tutor loop.
- `GAP-018` → `PH-4/5`.
- `GAP-020` → `PH-4` storage.
- `GAP-024` (onboarding live-data loss) + `GAP-030` (profile data gaps) → `PH-4` (P0).
- `GAP-028` (dead links/CTAs) → `PH-5` (P1, cheap alpha cleanup).
- `GAP-021,022,027` (notifications), `GAP-029` (profile sprawl) → Post-Alpha by default.

---

## 24 RTM

| Req ID | Req | Belongs | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| GAP-001 | local replay fix | 27 | `ITST-mig` | `AC-RPC-001` | REAL-003 |
| GAP-010 | booking detail route | 06 | `TST-learn-detail` | `AC-LEARN-001` | BLK-001 |
| GAP-011 | expiry sweep dispatch | 17 | `ITST-sweep` | `AC-RPC-003` | REAL-007 |
| GAP-012 | detail kind bug | 01 | `TST-work-bug` | `AC-WORK-005` | REAL-009 |
| GAP-013 | real creator | 01 | `TST-work-create` | `AC-WORK-004` | WORK-003 |
| GAP-014 | live/demo separation | 00/15 | `TST-demo-gate` | `AC-SEC-005` | REAL-006 |
| GAP-015 | payment path | 04 | `E2E-pay` | `AC-PAY-001` | BLK-005 |
