# Auth Email Setup — Resend + Supabase

Tutoria uses **Resend** as its transactional email provider, scoped to auth-related
emails only: **password reset**, **email verification**, and **security alerts**.

We deliberately do **not** route messaging, payment receipts, refund notices, or
any other transactional / marketing email through this path. Per product decision,
in-app notifications are the single source of truth for non-auth events.

---

## 1. Resend dashboard

1. Create a Resend account at <https://resend.com>.
2. **Verify the sending domain** `tutoria.com`:
   - Resend → Domains → Add Domain → `tutoria.com`
   - Add the requested DNS records (DKIM, SPF, return-path) in your DNS provider.
   - Wait for verification (usually a few minutes).
3. **Create an API key**:
   - Resend → API Keys → Create API Key
   - Name: `tutoria-backend-prod` (or `dev` for local).
   - Scope: **Sending access** only (do not grant broader scopes).
   - Copy the key. You will only see it once.

   Store it as `RESEND_API_KEY` in:
   - `backend/.env` (local dev)
   - your deployment secret store (e.g. Render secrets, GitHub Actions secrets).
4. Confirm `RESEND_FROM` matches a verified sender on the domain, e.g.:
   ```
   RESEND_FROM=Tutoria <noreply@tutoria.com>
   ```

---

## 2. Supabase dashboard configuration

Supabase owns the password reset and email verification flows. We point Supabase
at Resend via its **custom SMTP** setting so the actual delivery goes through
Resend, but the templates and links stay managed by Supabase.

### 2a. Auth → URL Configuration

- **Site URL:** `https://tutoria.com`
- **Redirect URLs:** `https://tutoria.com/**` (allow all paths under the site)

This controls where password reset and email verification links redirect to
after the user clicks them.

### 2b. Auth → SMTP Settings (custom SMTP → Resend)

Enable **custom SMTP** and fill in:

| Field      | Value                                |
|------------|--------------------------------------|
| Host       | `smtp.resend.com`                    |
| Port       | `465`                                |
| User       | `resend`                             |
| Password   | `$RESEND_API_KEY` (the API key from step 1) |
| Sender     | `noreply@tutoria.com` (= `RESEND_FROM`) |

Save. Supabase will now route every auth email through Resend.

### 2c. Auth → Email Templates

Customize the templates Supabase sends for auth events. Use Tutoria's
charcoal/minimal visual language. Examples:

- **Confirm signup** — subject: "Verify your Tutoria email"; CTA → "Verify email".
- **Reset password** — subject: "Reset your Tutoria password"; CTA → "Reset password".
- **Email change** — confirm both old and new addresses (matching `double_confirm_changes = true` in `supabase/config.toml`).

Keep the templates minimal: no marketing copy, no upsell. This path is
strictly auth-only.

---

## 3. Backend wiring

`backend/src/services/email.ts` exposes `sendEmail()` plus the three templates
used in this scope: `passwordReset`, `emailVerification`, `securityAlert`.

The backend itself does **not** drive password reset or email verification —
those flows are owned by Supabase and triggered via the
`/api/v1/auth/sign-in` flow and the Supabase client SDK. The backend only
sends emails directly for **security alerts** via
`POST /api/v1/auth/security-alert` (see `backend/src/routes/auth.ts`).

### Environment variables

Add the following to `backend/.env` (see `backend/.env.example`):

```
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM=Tutoria <noreply@tutoria.com>
```

If `RESEND_API_KEY` is unset, the email service falls back to **dev mode**:
emails are logged to stdout with `[email:dev]` prefix and a synthetic ID is
returned. This is intended for local development and tests only; do not
deploy without `RESEND_API_KEY`.

---

## 4. Local dev

1. `cd backend && pnpm install`
2. Add the two `RESEND_*` vars to your local `.env` (or leave them unset to use
   dev-mode logging).
3. Run `pnpm dev` and hit `/api/v1/auth/security-alert` to confirm logging.

For password reset / email verification flows locally, Supabase's local stack
(in `supabase/`) uses the inbucket test mail server by default, which is fine
for development. Production-grade SMTP is configured per §2b above.

---

## 5. What we explicitly do NOT route through Resend

Per product decision, the following are **not** sent via this email integration.
- In-app chat / messaging notifications (in-app only).
- Payment receipts (in-app only).
- Refund notifications (in-app only).
- Marketing / digest emails (none planned in alpha).
