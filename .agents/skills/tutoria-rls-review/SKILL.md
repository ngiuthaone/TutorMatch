---
name: tutoria-rls-review
description: Adversarially review Supabase Row Level Security and authorization for Tutoria. Use whenever schema/API changes affect learners, hosts, admins, private data, bookings, payments, uploads, or cross-account access.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria RLS review

Review as an attacker, not as the policy author.

Check:
- anonymous/public read boundaries;
- learner access to only authorized Booking/Payment data;
- host access only to owned offerings/sessions and permitted participant data;
- mutation authority for confirm/reject/cancel/reschedule/attendance;
- private address/location leakage;
- service-role-only financial/provider mutations;
- storage/object policies where uploads are involved;
- indirect joins/functions/RPCs that bypass intended RLS;
- IDOR/cross-tenant attempts;
- SECURITY DEFINER/search_path/function ownership risks if present.

Never accept UI hiding as authorization. Report exploit path, affected data/action, severity, remediation owner, and exact test evidence.
