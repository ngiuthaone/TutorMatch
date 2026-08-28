# 30 — RUNTIME VERIFICATION CONTRACT (RTM2)

**Purpose:** evidence that the Alpha loops work under real actors on the deployed shell (not just unit/integration). Complements E2E (#29); uses the 5-way ladder with RUNTIME/COMPLETENESS evidence.
**Current truth:** `REAL-012` — prod deploy previously demo-mode; prod payment runtime off-limits/UNVERIFIED this audit.

---

## 30.1 Runtime scenarios to verify at release (RTM2-*)

| RTM2-0xx | Scenario | Tool |
|---|---|---|
| RTM2-001 | Anonymous discover/detail renders live public data | browser |
| RTM2-002 | Sign-in across surfaces persists; auth guards block unauth'd book | browser+api |
| RTM2-003 | Workshop detail capacity matches server (no client assertion) | browser |
| RTM2-004 | Booking state reflects server after payment | browser |
| RTM2-005 | `/bookings/[id]` reachable and reflects state (`BLK-001`) | browser |
| RTM2-006 | Host create+publish appears publicly | browser |
| RTM2-007 | Mobile viewport (375px) for all Alpha pages | browser |
| RTM2-008 | No console errors / failed network on Alpha journeys | browser network |
| RTM2-009 | Expired payment releases capacity observable | integration |
| RTM2-010 | Real VNPay paid smoke test (production gate — separate `PAY-060`) | provider |

## 30.2 Evidence standards

- `RTM2-020` — Each verified scenario records: environment, viewport(s), steps, observed state, screenshots/network where tooling permits (`qa_browser`).
- `RTM2-021` — Any scenario that cannot run is reported `UNVERIFIED`, never implied PASS.
- `RTM2-022` — Mobile + a11y smoke (keyboard/focus) per changed controls (`tutoria-browser-qa`).

## 30.3 ACCEPTANCE

- `AC-RTM2-001` — RTM2-001..009 evidenced before declaring Private Alpha loop DONE; RTM2-010 gated separately.
- `AC-RTM2-002` — No `UNVERIFIED` treated as PASS in the release report.
