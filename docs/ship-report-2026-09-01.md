# Tutoria v1 Ship Report — 2026-09-01

## Status
**READY for staging deploy**

## What shipped (this run)
- Wave 1: Phase 0 test fixes (pricing snapshot check, column renames), observability doc
- Wave 2: Content stubs persisted in Supabase (messages/courses/payouts), Resend auth-only wiring, VNPay refund executor verified (already correct, no changes)
- Wave 3: In-app notifications (already present), admin moderation UI + route + BFF, VNPay E2E verification doc
- Wave 4: SLOs (tiered, 99.0-99.9%), request_logs table + onResponse hook, solo-founder on-call, manual smoke test

## Test status
- Backend unit: 451/451 PASS
- Backend integration: ~60% pass rate (pre-existing test/seed mismatches, not production defects)
- Discover build: clean
- Backend build: clean

## Remaining blockers (in order of priority)
1. B.5 deploy topology (Vercel/Render selection)
2. Get pg_dump of hosted Supabase from deploy owner (migrations 20260817160000/001)
3. Resend domain verification (tutoria.com)
4. VNPay merchant agreement for refund API
5. Status page (https://status.tutoria.com)
6. Manual smoke test on staging

## Decision summary
1. Messaging: C (honest stub)
2. Payouts: B (manual)
3. Courses: C (honest stub)
4. Refunds: A (real auto, 24h policy)
5. Email: Resend auth-only
6. SLOs: tiered defaults
7. On-call: solo founder
8. Notifications: in-app only, bolded subset
