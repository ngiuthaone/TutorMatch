# 35 — IMPLEMENTATION PHASES (PH)

**Purpose:** sequenced, dependency-respecting phases from current state to Private Alpha (and beyond). Each phase ends with a go/no-go and evidence gate. Aligns with v4.0 P0→P9 intent and `GAP→phase` map. **Updated 28 Aug 2026:** folds in the audited surface findings (`GAP-023..030`, `AUD-001..010`, `42_audit_inventory.md`) so P0/P1 release-blockers are explicit, not implied.

---

## PH-0 — Migration & DB reconciliation (owner-gated)
- Output: local head replays cleanly; repo≈prod; canonical `create_booking`.
- Deliverables: `MIG-010..013`, `IMP-001..004`.
- Test: `ITST-mig`; re-run integration suite (`REAL-011` → resolved).
- Go/no-go: clean replay + suite status. Depends on owner approval for prod DDL.

## PH-1 — Auth integrity + workshop vertical slice
- Output: workshop discoverable, detail correct, creator persists real Offering/Session, live/demo separation on dev, **and auth/live data paths are truthful**.
- Deliverables: `IMP-031,032,033`; `WORK-*`; `DISC-*`; AUTH demo gate.
- **Audited auth/data gaps (P0):**
  - `GAP-025` — sign-up wizard no longer decorative in live mode: roles/interests/preferences really persist (`sign-up-flow.tsx:96`).
  - `GAP-026` — RequireAuth: no infinite spinner on `unavailable` (friendly error+retry), correct per-page copy (not "Loading your messages…"), preserve `?query` (e.g. preselected `?slot=`) across sign-in return (`require-auth.tsx:38-44,:41,:21`, `gate.ts:21`).
  - Consistent password policy (8 vs 12), email-format client check, errors styled through `ui/input` (`password.ts:1`, `sign-up-flow.tsx:43`).
- Test: `TST-work-*`, `E2E` basic, `AC-WORK-0xx`, `AC-AUTH-0xx` (new).
- Go/no-go: all `AC-WORK` + `AC-DISC` + `AC-AUTH` pass in dev.

## PH-2 — Shared booking engine + capacity + worker expiry + contact capture
- Output: authoritative create_booking, capacity atomicity, version/CAS, expiry sweep dispatched, **and the booking record carries the learner's contact so the host can reach them; price is never a fake `0`.**
- Deliverables: `IMP-010,011,012,020`; `BOOK-*`, `WORKER-*`.
- **Audited P0 gaps (fix here, they block release):**
  - `GAP-023` (AUD-001) — **customer contact at booking (P0).** `DEC-013` RESOLVED: phone on the booking row `bookings.learner_phone`, host-of-session-only RLS (snapshot at booking). Adds `bookings` column + RLS, extends `create_booking` RPC with the contact param, adds contact step to the booking form (phone VN-format, name, email). `DEC-014` RESOLVED: booking form is an **inline sheet/modal** on the detail page (not a `/bookings/new` route).
  - `AUD-002` — **price integrity:** never `hourlyRateVnd || 0`; server-total surfaces as `UNSET`→"price on confirmation" / `RESOLVED` server value (`tutor-profile-frame.tsx:121`, `price-summary.tsx`).
- Test: `ITST-capacity`, `ITST-cas`, `ITST-sweep`, `TST-contact` (new), `TST-price` (new).
- Go/no-go: `AC-BOOK-002/003/004`, `AC-WORKER-001`, `AC-TUT-UX-002/003` (contact + server price).

## PH-3 — Payment + booking detail (real-money correctness path)
- Output: learner pays, sees `/bookings/[id]` confirmed, can view/cancel/receipt; worker reconciles; picked contact shown + editable pre-payment.
- Deliverables: `IMP-013,030,034,022,013`; `LEARN-*`, `PAY-*`, `ADM-012`(reconciled).
- Test: `E2E-pay`, `ITST-refund`, `ITST-webhook`, `TST-learn-detail`.
- Go/no-go: `AC-PAY-001..005`, `AC-LEARN`, `AC-PAYD`, `AC-BOOK-UX-002/003/004` — but **real-money gate `PAY-060`** remains: provider keys live, worker deployed, webhook secured, reconciliation runbook, paid smoke test against authorized provider.

## PH-4 — Host native + second loop (tutor) + onboarding/identity parity
- Output: Host Center native; tutor bookings via shared engine (hourly); **onboarding actually persists what it shows; live tutor profile is data-complete.**
- Deliverables: `IMP-035`; `HOST-*`; `TUT-*`; storage buckets `STG-*`.
- **Audited gaps:**
  - `GAP-024` (AUD-003) — **onboarding live-data loss (P0):** persist the ~30 dropped fields (photo, video, credentials, FAQs, policies, consultation, visibility) to `/api/v1/me/tutor-cv` or clearly label demo-only; no silent discard (`tutor-onboarding.tsx:692-726`, `tutor-cv-mapper.ts:162-220`).
  - `GAP-030` (AUD-009) — **live tutor profile data-complete:** real photo (add schema field; today avatar is initials only), rating/reviews/lessons sourced not hardcoded 0 (`tutor-profile-frame.tsx:115-118`, `tutor-cv-api.ts:49-63`).
  - Replace the booking iframe/postMessage bridge with a **native booking component** (`40_uiux_tutor_profile`) that uses the PH-2 contact+price flow.
- Test: `E2E-host`, `E2E-tut-book`, `ITST-slot`, `TST-cv-cas`, `TST-onboard` (new).
- Go/no-go: `AC-HOST`, `AC-TUT`, `AC-TUT-UX-001/005`.

## PH-5 — Alpha release hardening + cheap cleanup
- Output: Private Alpha live: both money loops trustworthy; operational reconciliation; observability; runbook; release-blocking dead-ends removed.
- Deliverables: `ADM-*`, `ANL-011`, `RTM2-*` evidence, security review.
- **Cheap release-blocking cleanup (`GAP-028`, AUD-007):** fix the 6 dead nav links (`/saved, /dashboard, /settings, /help, /terms, /privacy`) + inert Create-menu / mobile Notifications / "Become a Creator" (`user-menu.tsx:70-75`, `create-menu.tsx:73-82`, `mobile-navigation.tsx:145-158`) — either point them at real routes or remove them so no primary CTA is a dead-end at alpha.
- Go/no-go: security_reviewer + independent_verifier PASS on Alpha loop; no dead-end primary CTAs on alpha surfaces.

## PH-6+ — Post-Alpha (PURPLE/deferred)
- Events/classes/courses on shared engine (`08`), social/communities/discussions/articles (`09`), messaging+realtime (`MSG`), full LMS (`CRS`), reviews (`REV`), broad admin/CMS, analytics SDK (`license_guard`). Each promoted only via explicit `DEC-*`.
- **Notified from the audit (deferred, not alpha blockers):**
  - `GAP-027` (AUD-006) — Notifications are localStorage in live mode too; live bell always 0. Requires backend event→notification producer before it can be truthful; defer to `18_events_notifications` scope.
  - `GAP-029` (AUD-008) — profile version sprawl: 13 identical `/v3..v15` routes + inert Follow/Message + verified-badge-for-all. Cleanup with social surface consolidation; not on the alpha money path.
  - `AUD-010` — sanitizer render-path full coverage confirmation (client-only allowlist currently).

## Phase gate table

| PH | Primary ACs | Depends on | Gate |
|---|---|---|---|
| 0 | AC-MIG, AC-RPC-001 | owner migration approval | clean replay |
| 1 | AC-WORK*, AC-DISC, AC-AUTH | PH-0 | auth truthful + dev demo loops |
| 2 | AC-BOOK*, AC-WORKER, AC-TUT-UX-002/003 (contact+price) | PH-1 | authz+capacity+contact+price |
| 3 | AC-PAY*, AC-LEARN, AC-PAYD, AC-BOOK-UX-004 | PH-2 + provider | real-money readiness |
| 4 | AC-HOST, AC-TUT, AC-TUT-UX-001/005 (onboard parity, native profile) | PH-2/3 | second loop + identity parity |
| 5 | Alpha DoD (incl. GAP-028 cleanup) | PH-4 | security+verifier PASS, no dead-end CTA |
| 6+ | deferred (GAP-027/029, AUD-010) | any | explicit DEC per surface |

## P0/P1 release-blocker register (from audit)
- **P0 (blocks Alpha core path):** `GAP-023` contact capture · `AUD-002` price `||0`→free · `GAP-024` onboarding live-data loss · `GAP-025` decorative sign-up · `GAP-026` RequireAuth dead-end.
- **P1 (blocks clean alpha):** `GAP-028` dead links/CTAs · `GAP-030` live profile data gaps.
- **Deferred:** `GAP-027` notifications · `GAP-029` profile sprawl · `AUD-010` sanitizer coverage.
