# Discovery Integrity Fix — Final Report

**Date:** 2026-08-19
**Branch:** `codex/core-1to1-integrated`
**Starting HEAD:** `8b64738`
**Final HEAD:** `8b64738` (no commit — pending user request)

---

## 28-Item Report

| # | Item | Result |
|---|------|--------|
| 1 | Starting HEAD | `8b64738` |
| 2 | Exact discovery root cause | 7 orphan Tutor Sessions (host_id=512b40b0...) with no `tutor_profiles` row appeared in `list_bookable_sessions` and `get_bookable_session` because LEFT JOIN did not filter them out |
| 3 | Migration added | `20260819130000_discovery_integrity_fix.sql` — additive `CREATE OR REPLACE FUNCTION` only |
| 4 | list_bookable_sessions fix | Added `AND (o.kind != 'tutor' OR (tp.user_id IS NOT NULL AND tp.hourly_rate_vnd IS NOT NULL))` |
| 5 | get_bookable_session fix | Same WHERE clause applied |
| 6 | Pricing safety net preserved | `resolve_booking_pricing` untouched. Still raises `BOOKING_PRICE_NOT_SNAPSHOTTED` for orphan |
| 7 | Orphan count before | 7 orphan Tutor Sessions discoverable |
| 8 | Orphan discoverable count after | 0 |
| 9 | Valid Tutor discovery result | 1 valid session visible with tutorProfileId and hourlyRateVnd |
| 10 | Workshop discovery result | 1 session visible (unaffected) |
| 11 | Class discovery result | 1 session visible (unaffected) |
| 12 | Event discovery result | 1 session visible (unaffected) |
| 13 | Focused tests (12/12) | ALL PASS |
| 14 | Backend full tests (261/261) | ALL PASS |
| 15 | Serial integration result | N/A (no local reset — production migration applied) |
| 16 | Frontend regression (157/157) | ALL PASS |
| 17 | TypeScript/backend | PASS |
| 18 | TypeScript/frontend | PASS |
| 19 | git diff --check | PASS |
| 20 | Hosted migration result | Applied successfully (empty response = no errors) |
| 21 | Hosted RPC verification | list_bookable_sessions: 0 orphans, 1 valid tutor. get_bookable_session(orphan): null. get_bookable_session(valid): session data |
| 22 | Security review | **PASS** — no authorization widening, no cross-host exposure, no data deletion |
| 23 | Independent verifier | **VERIFIED** — all 12 verification items pass |
| 24 | Files changed | `backend/supabase/migrations/20260819130000_discovery_integrity_fix.sql` (NEW) |
| 25 | Commit | Not committed — pending user request |
| 26 | Final HEAD | `8b64738` (same as starting) |
| 27 | Final git status | 1 new file (migration), 8 modified files (from prior phases) |
| 28 | Historical orphan data left intact? | **YES** — 7 orphan sessions preserved in DB, just hidden from discovery |

---

## Remaining NEEDS_WORK Items

| ID | Item | Status |
|----|------|--------|
| FE-005 | `tutor-booking-api.ts` not generalized | DEFERRED — backward-compat alias preserves function. No engine impact |

No remaining Shared Booking Engine gaps.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/supabase/migrations/20260819130000_discovery_integrity_fix.sql` | **NEW** — additive fix for list_bookable_sessions and get_bookable_session |

---

## Final Classification

```
PASS — SHARED BOOKING ENGINE SUPPORTS TUTOR + WORKSHOP WITH DISCOVERY INTEGRITY
```
