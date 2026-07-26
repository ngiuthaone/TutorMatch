# Supabase frontend authentication setup

This milestone adds browser identity and session handling only. Marketplace profile editing, requests, chat, matching, payments, and admin APIs remain demo-only or disabled in production mode.

## Runtime modes

`config.js` is public runtime configuration. Copy `config.example.js` and set exact values for each deployment. The Supabase publishable key is designed for browser use and cannot bypass RLS; it is not authorization. Never add a service-role/secret key, database password, JWT secret, or SMTP credential to browser configuration.

Production and staging must use HTTPS and set `demoMode: false`. Explicit local demo mode may set `demoMode: true`; only that mode may load `/api/state`, seeded users, or legacy local state. A production configuration or provider failure fails closed and never activates demo mode.

```js
window.TUTORIA_CONFIG = Object.freeze({
  apiBaseUrl: "https://api.tutoria.example",
  supabaseUrl: "https://PROJECT.supabase.co",
  supabasePublishableKey: "PUBLIC_KEY",
  authCallbackUrl: "https://www.example.com/auth/callback",
  demoMode: false,
  environment: "production"
});
```

Serve `config.js` with `no-store`. Store its deploy-time values in the hosting platform configuration even though the publishable key is public. Rotate any accidentally exposed privileged credential immediately.

Vercel currently sends the CSP as report-only because the legacy SPA still uses inline style attributes and runtime style manipulation. Review reports, remove those legacy inline-style dependencies, then enforce the policy; do not weaken `script-src` with `unsafe-inline` or `unsafe-eval`.

## Dashboard checklist

- [ ] Enable Email/Password authentication.
- [ ] Choose confirm-email behavior intentionally; do not disable it merely for testing.
- [ ] Set the Site URL for the current environment.
- [ ] Add exact development redirect: `http://localhost:4173/auth/callback`.
- [ ] Add the exact HTTPS staging callback, for example `https://staging.example.com/auth/callback`.
- [ ] Add the exact HTTPS production callback, for example `https://www.example.com/auth/callback`.
- [ ] Ensure confirmation templates use the configured confirmation URL.
- [ ] Ensure password-reset templates use the recovery URL.
- [ ] Apply the backend profile migration and verify that `admin` signup metadata becomes `student`.
- [ ] Use separate development and production Supabase projects.
- [ ] Confirm no privileged key appears in frontend hosting configuration.

Avoid wildcard production redirects. Preview wildcard redirects expand phishing/open-redirect risk and should be used only after explicit review.

## Build and run

```bash
pnpm install --frozen-lockfile
pnpm build:auth
pnpm test:auth
npm start
```

Run the separate API from `backend/` with its own `.env` and `pnpm dev`. Its CORS `FRONTEND_ORIGINS` must contain the exact frontend origin.

## Manual verification

1. Set `demoMode: false`, the API URL, Supabase URL, and publishable key.
2. Sign up once as student and once as tutor. Confirm that no admin option exists.
3. With confirmation enabled, verify that signup shows check-email and no dashboard.
4. Follow the confirmation link through `/auth/callback`; confirm `/api/v1/me` runs and its role chooses `#/student` or `#/tutor`.
5. Reload a private route and verify no private UI flashes before session restoration.
6. Sign out and confirm protected routes redirect to sign-in.
7. Request a password reset; confirm the result is generic. Follow the recovery callback, choose a 12–128 character password, and sign in again.
8. Exercise safe failures: 401 signs out after one refresh attempt; 403 denies access; 404 reports incomplete account setup; 429 asks to retry; 503 preserves no privileged UI.

The official Supabase client alone persists and refreshes sessions. Tutoria stores the `/me` profile only in memory. Browser metadata and routes never determine authorization; the backend profile returned by `/me` is the trusted role source.

Terms acceptance is currently a UX gate, not durable legal evidence. A consent-record backend table, privacy/retention/deletion review, production monitoring, and profile-management APIs are required before public launch.
