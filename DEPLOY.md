# Tutoria Production Deployment Checklist

## Pre-Flight (do before any deployment)

- [ ] **Webhook/blocker resolved**: OAuth App needs `workflow` scope to push `.github/workflows/ci.yml`
  - Option A: Use a PAT with `repo` + `workflow` scopes to push
  - Option B: Update the OAuth App at github.com → Settings → Developer Settings → OAuth Apps → add `workflow` scope
- [ ] `git push` completes successfully
- [ ] All CI checks pass (backend, discover, Supabase schema validation)

---

## 1. Supabase Production Setup

### Link production project
```bash
cd backend
npx supabase link --project-ref <PROD_PROJECT_REF>
```

### Run all migrations against production DB
```bash
supabase db push
```
This applies all migrations in `supabase/migrations/` to the linked production project.

### Verify RLS policies
```bash
supabase inspect db rls-policies --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
key_tables = ['profiles','bookings','payments','marketplace_listings',
                'messages','notifications','posts','comments','articles',
                'sessions','reschedule_requests']
missing = [t for t in key_tables if not any(p.get('tablename','') == t for p in data)]
if missing:
    print('MISSING RLS ON:', ', '.join(missing))
    sys.exit(1)
print('RLS OK')
"
```

### Verify critical indexes
```bash
supabase inspect db indexes --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
checks = [
    ('bookings', 'sessions_offering_id'),
    ('marketplace_listings', 'creator'),
    ('profiles', 'profiles_role'),
]
for tbl, idx in checks:
    found = any(p.get('tablename','') == tbl and p.get('indexname','') == idx for p in data)
    print(f'Index {idx} on {tbl}: {\"OK\" if found else \"MISSING\"}'
"
```

---

## 2. GitHub Repository Variables & Secrets

Set these in: github.com → repository → Settings → Secrets and Variables → Actions

### Variables (no sensitive data)
| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_PROJECT_REF` | `<project-ref-id>` |
| `E2E_BASE_URL` | `https://your-production-frontend.com` |
| `E2E_TUTOR_EMAIL` | `e2e-tutor@your-domain.com` |

### Secrets (sensitive)
| Name | Value |
|------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key from Supabase dashboard |
| `E2E_TUTOR_PASSWORD` | Password for the E2E test tutor account |

---

## 3. Render.com — Production Services

### Update staging services FIRST, verify they work
The production render.yaml is already configured with `autoDeploy: false`. Deploy staging first:

1. Go to render.com → tutoria-api-staging → Environment
2. Set all `sync: false` vars to actual values (Supabase URL, keys, VNPay credentials)
3. Deploy and verify `/api/v1/health/ready` returns healthy
4. Test the publish → listing flow end-to-end

### Production service creation
1. In render.yaml, set `autoDeploy: true` on production services (or deploy manually)
2. Alternatively: clone the staging service settings and update:
   - `VNPAY_ENVIRONMENT`: `sandbox` → `production`
   - `VNPAY_PAYMENT_URL`: use production VNPay URLs
   - `VNPAY_API_URL`: use production VNPay URLs
   - `TUTORIA_ENVIRONMENT`: `staging` → `production`
   - `FRONTEND_ORIGINS`: set to production frontend URL

### Verify health endpoints
```bash
# Staging
curl https://tutoria-api-staging.onrender.com/api/v1/health/ready

# Production (after deploy)
curl https://tutoria-api.onrender.com/api/v1/health/ready
```

---

## 4. FRONTEND_ORIGINS Configuration

The backend validates that all requests come from allowed origins. Set `FRONTEND_ORIGINS` to comma-separated HTTPS URLs:

```
http://localhost:3000,https://tutoria-staging.vercel.app,https://tutoria.com
```

In production, `localhost` URLs are automatically allowed in non-production environments.

---

## 5. VNPay Sandbox → Production

**IMPORTANT**: Only do this step when actual money is being processed.

1. In render.com, update the production service environment:
   ```
   VNPAY_ENVIRONMENT: production
   VNPAY_PAYMENT_URL: https://payment.vnpayment.vn/paymentv2/vpcpay.html
   VNPAY_API_URL: https:// Merchant_webapi/api/transaction
   ```
2. Verify the VNPay merchant dashboard shows correct IPN URL
3. Run a test transaction with a small amount before full launch

---

## 6. Payment Reconciliation Token

Generate a cryptographically random token:
```bash
openssl rand -hex 32
```

Set `PAYMENT_RECONCILIATION_TOKEN` on all production services. This token authenticates internal payment reconciliation endpoints.

---

## 7. E2E Test Tutor Account

Create a dedicated tutor account for E2E tests in the production (or staging) Supabase:

1. Sign up a tutor with confirmed email
2. Set `E2E_TUTOR_EMAIL` and `E2E_TUTOR_PASSWORD` in GitHub repository variables/secrets
3. Run E2E tests manually to verify:
   ```bash
   cd discover && npx playwright test
   ```

---

## 8. Sentry Configuration

1. Create a Sentry project for Tutoria
2. Set `SENTRY_DSN` on all production services (web + worker)
3. Verify errors appear in Sentry dashboard after triggering test scenarios

---

## 9. Smoke Test Checklist

After each deployment, verify:

- [ ] `GET /api/v1/health` returns 200
- [ ] `GET /api/v1/health/ready` returns 200 with `database: "ok"`
- [ ] `GET /api/v1/marketplace/course` returns 200 with listing array
- [ ] Auth flow: sign-in, token refresh, sign-out all work
- [ ] Course publish: a tutor can create and publish a course
- [ ] Course listing: published course appears in marketplace
- [ ] Course takedown: creator can unpublish their course
- [ ] No console errors on key pages

---

## Rollback Procedure

If a deployment causes issues:

1. **Backend**: Re-deploy the previous successful commit in Render dashboard
2. **Database**: Migrations are forward-only. If a migration causes issues:
   - Restore from Supabase point-in-time backup
   - Or manually revert the specific migration SQL
3. **Frontend**: Vercel auto-rollback on build failure

---

## What's NOT Included in v1

These features require additional work before they can be called production-ready:

- [ ] **Course enrollment/access control** — no concept of who can access a purchased course
- [ ] **Course payments** — VNPay/Stripe purchase flow for course access (payments exist for bookings only)
- [ ] **Admin moderation** — no admin DELETE grant; only creator can unpublish their own
- [ ] **Object storage** — inline base64 images stored in DB (500KB per image × many rows = DB bloat)
- [ ] **E2E tests in CI** — Playwright tests exist but require E2E_BASE_URL + credentials in GitHub vars
- [ ] **Refresh token rotation** — Supabase auth config change required
