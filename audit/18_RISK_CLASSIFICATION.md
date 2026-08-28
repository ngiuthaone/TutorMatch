# Risk Classification

Phase 19. P0 = launch blocker (financial loss / security breach / broken core
marketplace transaction / inability to book-pay / corrupted data / severe
outage). P1 = serious. P2 = moderate. P3 = improvement.

## P0 — Launch blockers
None confirmed as *present in the code path* today, because the product is not
deployed; but the following would become P0 if shipped unreviewed:
- **N/A — not deployed.** The absence of any verified production surface is the
  effective blocker, though it classifies as P1/UNKNOWN rather than a live P0 bug.

## P1 — Serious
| ID | Finding | Impact |
|---|---|---|
| R1 | Financial worker never dispatches `expire_stale_workshop_bookings` | pending-payment workshop bookings hold capacity → inability to book/fill; financial leak |
| R2 | Local dev DB not reproducible from migrations (missing `20260819120000`/`20260820120000`; `create_booking` overload) | integration verification blocked; unsafe deploys |
| R3 | `/bookings/[id]` route missing after booking redirect | learner completion flow 404 → broken core booking journey |
| R4 | Referenced fix migration `20260819130000` absent from repo | prior hosted-only fixes unverifiable; DB may differ from repo |
| R5 | No confirmed production deployment (frontend/API/worker); live domain serves unrelated scaffold | nothing is truly "production-ready" |
| R6 | VNPay production runtime / webhook / refund / payout unverified | financial correctness unproven in production |

## P2 — Moderate
| ID | Finding |
|---|---|
| R7 | Messaging, reviews, community/articles/notifications, storage bucket absent from DB |
| R8 | Auth client-side only (no server route protection) |
| R9 | Notifications read localStorage even in live mode (demo leaks to live) |
| R10 | Doc-vs-code drift (React-19 claim, deleted-state.json claim) |
| R11 | Legacy `schema.sql` + demo `data/state.json` coexist (confusion risk) |
| R12 | `app.legacy-ui.js`, v3–v15, iframe shells, orphaned components (maintenance burden) |
| R13 | Root SPA `/api/state` unauthenticated + CORS `*` (demo, but risky if mistaken for prod) |

## P3 — Improvement / debt
| ID | Finding |
|---|---|
| R14 | Discover lint fails (react-hooks set-state-in-effect, any, unescaped); `.vercel/output` in lint scope |
| R15 | Duplicated frontend booking-api aliases; redundant `'system'` actor migrations; `.bak` migration file |
| R16 | No CI workflow committed; OSS gate not continuously enforced |
| R17 | `session_hard_reserved` capacity summation semantics undocumented/unverified |
| R18 | Stray artifacts (`dist/test-hero-animation.gif`, `discover-dev.log`, `.DS_Store`) |

## Recommended fix order
1. Add `expire_stale_workshop_bookings` to the financial worker sweeps (R1, P1).
2. Make local DB reproducible — resync/migrate from repo; reconcile
   `create_booking` overload and missing migrations; restore `20260819130000`
   fix or document its removal (R2, R4).
3. Add `/bookings/[id]` route (R3).
4. Verify production deployment + VNPay sandbox→production (R5, R6).
5. Decide/front a production backend for messaging/reviews/notifications/storage.
6. Add server-side auth gating for protected pages.
