# 10 — Production Infrastructure Reconstruction

## 1. Intended topology (per docs + render.yaml)

```text
public HTTPS frontend (Discover/Next)
        ▼ browser-safe Supabase config + API base URL
HTTPS API/backend (Fastify) ──► Supabase production project
        │  ▲                          │ service-role server paths only
VNPay HTTPS callbacks                 ▼
                                  financial worker (separate process)
```

- `vercel.json` (root) = legacy static SPA; 404s `/api/*` — NOT an API/worker
  contract.
- `render.yaml` defines two **staging** services under `backend/`:
  `tutoria-api-staging` (web, `pnpm start`, Node 22.22.0, :10000, VNPay sandbox
  defaults) and `tutoria-financial-worker-staging` (worker, `pnpm worker:start`,
  interval 60s, batch 50, no inbound HTTP). Secrets `sync:false`.

## 2. What is actually deployed (verified)

| Target | Deployed? | Evidence |
|---|---|---|
| Root SPA Vercel domain `tutormatch.vercel.app` | Unrelated default create-react-app page (200) | curl: "React App" scaffold, not Tutoria |
| `discover.vercel.app` | 402 (not this project) | curl |
| Render API | **NOT deployed** per docs + no live hostname | docs claim "No Render service deployed" |
| Render worker | **NOT deployed** | same |
| Supabase production | Config'd + reachable (401 unauth) | `curl $REF.supabase.co/rest/v1/ → 401` (host up) |
| Vercel projects | `tutormatch`, `discover` linked locally (gitignored) | `.vercel/project.json` |

Vercel linked projects exist for the repo's user (`team_HcsnWWBa65d6UONQ0paME31Z`)
but **no production URL of the real Tutoria product could be confirmed** from the
repository. The one live Vercel domain serves a default scaffold, not the product.

## 3. Classifications

| Dependency | Configured in repo | Configured in deployment | Runtime verified | Status |
|---|---|---|---|---|
| Discover frontend (Vercel) | yes | == | NO real product deployed | UNKNOWN/PENDING |
| Fastify API (Render) | yes | no | NO | NOT DEPLOYED |
| Financial worker (Render) | yes | no | NO | NOT DEPLOYED |
| Supabase | yes | hosted project reachable | migration state UNKNOWN | UNKNOWN |
| VNPay | yes | browser/API origins | NO live txn | UNKNOWN |
| DNS/custom domain | no | no evidence | — | NOT_FOUND |

## 4. CI / Docker / monitoring

- **No CI** (no `.github/`; a removed `oss-license-gate.yml` is referenced in
  THIRD_PARTY_NOTICES history).
- **No Dockerfile/docker-compose** in the repo.
- Financial worker observes via structured JSON logs only; no HTTP health
  endpoint (per runbook). API has `GET /api/v1/health`.

## 5. Environment variables (names)

API/worker: NODE_ENV, TUTORIA_ENVIRONMENT, HOST, PORT, FRONTEND_ORIGINS,
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY,
VNPAY_ENVIRONMENT, VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_RETURN_URL,
VNPAY_IPN_URL, VNPAY_API_URL, reconcile token, rate-limit/timeout tunables,
FINANCIAL_WORKER_* (interval/batch/lease/backoff/worker/log).

Discover: NEXT_PUBLIC_TUTORIA_API_BASE_URL, NEXT_PUBLIC_SUPABASE_URL,
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_TUTORIA_AUTH_CALLBACK_URL,
NEXT_PUBLIC_TUTORIA_ENVIRONMENT, NEXT_PUBLIC_TUTORIA_DEMO_MODE.

## 6. Bottom line

**NOT production-deployed/verified.** The repository is deployment-ready in
configuration (render.yaml, Vercel links, env schema) but no live production
surface of the real product is confirmed. Release truthfulness: status
**PARTIAL/UNVERIFIED** for infrastructure.
