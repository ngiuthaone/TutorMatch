# Local core 1:1 browser fixtures

This setup creates deterministic, local-only Supabase Auth and core 1:1 data for browser QA. It uses the existing migrations, Auth trigger, tutor CV RPCs, and session RPCs. It does not seed production or frontend state.

The local-only password for both accounts is `Local-test-only-Password1!`.

```sh
cd /Users/soshi/Documents/tutoria-core-1to1-integrated/backend
supabase start
supabase db reset --local --yes
set -a
source <(supabase status -o env)
set +a
SUPABASE_URL="$API_URL" \
SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
SUPABASE_DB_URL="$DB_URL" \
pnpm exec tsx scripts/seed-local-core-fixtures.ts
```

The script is idempotent. It creates or refreshes:

- `student@example.com` as a `student` profile;
- `tutor@example.com` as the published `Thu Ha` cooking-instructor tutor profile;
- fifteen additional published tutor profiles matching the active local Discover Tutor cards, each with one future, scheduled, capacity-available Session;
- five future, scheduled, capacity-available Sessions owned by Thu Ha, across multiple dates.

The tutor catalog is seeded from the same display names used by the active local
Discover cards, so every card can resolve through the live `/tutor/[name]`
route. Re-running the script refreshes these profiles and sessions without
creating duplicates.

The service-role key and database URL are used only by the local setup command. They must never be passed to Discover or exposed through `NEXT_PUBLIC_*` configuration. Browser verification still signs in normally through Supabase Auth and uses the publishable key/RLS boundary.
