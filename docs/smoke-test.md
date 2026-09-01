# Manual Smoke Test — Tutoria v1

Run this on staging before each prod deploy. Total time: ~30 minutes.

## 0. Pre-flight
- [ ] staging is up at https://staging.tutoria.com
- [ ] readyz returns 200
- [ ] Supabase dashboard open
- [ ] VNPay sandbox account accessible

## 1. Auth flow
- [ ] Signup with new email → receive verification email (or auto-confirm)
- [ ] Login → see home page
- [ ] Logout → session cleared
- [ ] Password reset request → receive reset email
- [ ] Reset password with link → can login with new password

## 2. Tutor flow
- [ ] Sign up as tutor → fill CV form → publish
- [ ] Tutor profile appears in /tutors listing
- [ ] Tutor receives a notification when booking requested

## 3. Learner flow
- [ ] Sign up as learner
- [ ] Browse /tutors → see published tutors
- [ ] View tutor profile
- [ ] Book a session
- [ ] Receive booking confirmation notification

## 4. Payment flow (VNPay sandbox)
- [ ] Initiate payment → receive vnp_Url
- [ ] Complete payment with VNPay test card 9704198526191432198 (success)
- [ ] IPN received → booking status = confirmed
- [ ] Refund flow: cancel booking >= 24h before → refund processed → status updated

## 5. Host flow
- [ ] Receive booking request notification
- [ ] Confirm booking
- [ ] Receive payment notification
- [ ] See booking in /host dashboard

## 6. Admin flow
- [ ] Login as admin
- [ ] Visit /admin/moderation
- [ ] See pending media submissions
- [ ] Approve one → status updated
- [ ] Reject one with reason → status updated

## 7. Observability
- [ ] readyz returns 200 with all 3 subchecks OK
- [ ] worker_heartbeats table shows financial-recovery ran in last 5 min
- [ ] request_logs has rows for the test session (verify by request_id)

## 8. Failure modes
- [ ] Stop a worker, wait 30s, verify readyz returns 503
- [ ] Restart worker, verify readyz returns 200
- [ ] Send malformed request, verify error has request_id for log lookup

## Pass criteria
All checkboxes ticked, no failed assertions. Document any failures in the deploy log.
