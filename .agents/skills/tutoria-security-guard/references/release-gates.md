# Tutoria security release gates

Use these gates proportionally. An early local prototype does not need enterprise ceremony, but production handling real accounts, messages, bookings, private uploads, or money must pass the relevant controls.

## Gate A — Every meaningful PR

- [ ] No newly committed secret.
- [ ] New dependency/repo passed license + vulnerability review.
- [ ] Changed server mutation validates input at runtime.
- [ ] Changed sensitive read/mutation enforces authorization server-side.
- [ ] New database table/view/RPC/storage path has an explicit access model.
- [ ] New GitHub Action has minimal permissions and reviewed provenance.
- [ ] Relevant tests/typecheck/lint pass.
- [ ] No security control was disabled/suppressed without explanation.

## Gate B — Auth / RLS / private-data changes

- [ ] Anonymous negative tests pass.
- [ ] User A vs User B negative tests pass.
- [ ] Role escalation negative tests pass.
- [ ] Service-role/admin credentials are server-only.
- [ ] RLS policies cover each intended operation.
- [ ] Updates cannot transfer ownership or change authority fields unless explicitly intended.
- [ ] Views/RPC/security-definer functions were reviewed.
- [ ] Private storage policies and signed URL behavior tested.

## Gate C — Booking/payment/webhook changes

- [ ] Server controls amount/currency/price/status transitions.
- [ ] Client cannot modify another user's booking.
- [ ] Capacity/concurrency invariant tested.
- [ ] Webhook authenticity is verified.
- [ ] Replay/duplicate/reordered events are safe.
- [ ] Idempotency tested.
- [ ] Refund/cancel/reschedule permissions tested.
- [ ] Test-mode flows do not create real charges/messages/emails unintentionally.

## Gate D — Pre-production release

- [ ] 0 unresolved Critical.
- [ ] 0 unresolved High or explicit documented risk acceptance.
- [ ] Gitleaks/detect-secrets pass or findings triaged.
- [ ] OSV-Scanner + Trivy pass or findings triaged.
- [ ] GitHub Actions checked by actionlint + zizmor if workflows exist.
- [ ] Supabase RLS test suite passes if Supabase exists.
- [ ] SBOM generated when release provenance requires it.
- [ ] Safe ZAP staging baseline performed or reason documented.
- [ ] Schemathesis/API tests run if a usable API schema exists.
- [ ] Selected safe Nuclei templates run only if justified.
- [ ] Security headers/CSP checked in deployed staging.
- [ ] Manual deployment/dashboard items are enumerated, not assumed.

## Gate E — Incident / suspected compromise

Do not begin by "cleaning up" evidence.

- [ ] Identify exposed credential/data/path.
- [ ] Revoke/rotate affected credentials through authorized channels.
- [ ] Contain access while preserving enough evidence to understand scope.
- [ ] Determine first exposure and whether git history/build logs/artifacts contain it.
- [ ] Review provider/audit logs available to the user.
- [ ] Patch root cause.
- [ ] Add prevention and regression test.
- [ ] Re-scan for copies/derived secrets.
- [ ] Assess affected users/data and any notification/legal obligations with qualified counsel where necessary.

## Risk acceptance format

Never silently waive a High/Critical finding. Record:

- finding ID/title;
- severity;
- affected release;
- why remediation is deferred;
- compensating control;
- owner/decision-maker;
- expiry or review trigger;
- evidence needed to close.
