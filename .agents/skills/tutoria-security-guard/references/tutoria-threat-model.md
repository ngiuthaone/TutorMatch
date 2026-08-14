# Tutoria threat-model prompts

Use this file as a brainstorming checklist. Only apply a scenario when the corresponding feature exists in the current codebase.

## Identity and accounts

- Can an attacker enumerate registered emails/phones through login, reset, invite, or booking flows?
- Can a password-reset/magic-link/OAuth callback be redirected to an attacker domain?
- Can a user change email/role/identity state without reauthorization?
- Can a client-editable profile field grant tutor/admin/moderator privileges?
- Can a banned/deactivated account retain a valid privileged session?
- Can session data leak through logs, analytics, URL parameters, or referrers?

## Tutor / learner profiles

- Can hidden/private contact information be fetched by changing a profile ID?
- Can a user edit another profile or verification state?
- Can public profile rich text/URLs create XSS, open redirect, malicious download, or SSRF through previews?
- Are private location details or identity documents exposed through media URLs?

## Search/discovery

- Can expensive filters/queries be abused for resource exhaustion?
- Do search results leak private/draft/banned content?
- Can unpublished/private entities be reached directly by slug/ID even if hidden from search?
- Does caching mix authenticated/private responses between users?

## Bookings / workshops / classes / events

- Can learner A read/change learner B's booking by substituting an ID?
- Can a host change another host's session/capacity?
- Is workshop capacity enforced atomically under simultaneous booking attempts?
- Can a client manipulate participant count, price, discount, fee, currency, date, host ID, or booking status?
- Can expired/closed/cancelled sessions still be booked through a direct endpoint?
- Can repeated requests create duplicate bookings or consume capacity twice?
- Can cancellation/reschedule rules be bypassed by direct API use?
- Are calendar/invite links protected from exposing private attendee data?

## Payments / payouts / refunds

- Is displayed price recomputed/fetched server-side at charge creation?
- Can payment success be forged using URL/query/client state?
- Are webhook signatures, raw-body requirements, timestamps, and replay protections correct?
- Is webhook processing idempotent and resilient to reordered events?
- Does webhook amount/currency/customer/booking match server expectations?
- Can duplicate events double-refund or double-confirm?
- Can ordinary users reach payout/refund/admin routes?
- Are payment/provider secrets kept server-only?

## Messaging

- Is thread membership checked on every message/list/attachment endpoint?
- Can a user guess a conversation ID and read another chat?
- Can deleted/blocked membership still be used with old URLs/tokens?
- Is rich text sanitized?
- Can link previews fetch localhost, cloud metadata, Supabase/internal admin endpoints, or arbitrary ports?
- Are message send/upload endpoints rate-limited against spam?

## Community / discussions / articles / reviews

- Can drafts/private posts be retrieved directly?
- Is markdown/HTML sanitized consistently in preview and published views?
- Can moderation/admin status be mass-assigned?
- Can users vote/review repeatedly or impersonate another actor?
- Can attachments become active HTML/SVG/script on the trusted origin?
- Are deleted posts still in public caches/search indexes?

## File uploads / storage

- Can a user choose another user's storage path/object key?
- Are private buckets actually private?
- Are signed URLs short-lived enough for the data sensitivity?
- Can upload MIME/extension checks be bypassed?
- Are file sizes bounded before memory-intensive processing?
- Can an image/document parser be exploited or forced into decompression/resource exhaustion?
- Can EXIF/location metadata reveal sensitive information unintentionally?
- Are verification/identity docs separated from public profile media?

## Supabase / RLS

- Is RLS enabled on every client-exposed sensitive table?
- Are SELECT, INSERT, UPDATE, DELETE policies intentionally separate?
- Can user A read/write user B's rows?
- Does UPDATE permit changing `user_id`, `owner_id`, `role`, `status`, or other authority-bearing columns?
- Are permissions based on `raw_user_meta_data` or other user-editable metadata?
- Does any view bypass the intended RLS model?
- Does a security-definer RPC expose admin behavior to clients?
- Is the service-role key imported anywhere reachable by client bundling?
- Do storage policies match database ownership rules?

## Vercel / Next.js

- Is any secret accidentally `NEXT_PUBLIC_` or serialized into a client component?
- Do Server Actions/route handlers re-check authorization server-side?
- Can a cache key omit user identity and leak private data?
- Do rewrites/redirects bypass middleware or create open redirects?
- Are debug/source-map/error pages too revealing?
- Are preview deployments protected if they contain real data or production secrets?
- Can user-controlled image/URL optimization features become SSRF?

## GitHub / CI/CD

- Can a fork PR execute with repository/deployment secrets?
- Is `pull_request_target` combined with checkout/execution of untrusted code?
- Are `${{ ... }}` values interpolated unsafely into shell commands?
- Do Actions have broad `write-all` permissions?
- Are third-party Actions pinned to mutable tags rather than immutable SHAs?
- Can package install/build hooks exfiltrate CI secrets?
- Do artifacts/caches/logs contain `.env`, credentials, or private generated data?

## Abuse / anti-automation

- Login/reset/resend spam.
- Messaging spam.
- Booking reservation/capacity hoarding.
- Search/API scraping of private or costly data.
- Repeated upload abuse/storage exhaustion.
- Coupon/promotion brute force.
- Review/rating manipulation.
- Account creation farms.
- Webhook or callback flooding.

For each relevant abuse case define:

1. asset;
2. attacker capability;
3. entry point;
4. trust boundary crossed;
5. expected invariant;
6. safe test;
7. preventive control;
8. detection/telemetry;
9. recovery path.
