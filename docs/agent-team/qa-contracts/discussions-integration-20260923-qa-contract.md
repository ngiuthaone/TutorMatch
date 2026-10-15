# QA Contract — Discussions integration (snapshot → real repo)

**Mode:** PRE-FLIGHT (Mode A). **Author:** qa_browser (read-only; no app-code edits).
**Date:** 2026-09-23. **Run id:** discussions-integration-20260923.
**Scope:** integrate `/tmp/discussions-uiux/discussions-uiux.tsx` (2522-line validated snapshot, the ONLY file in that dir) into `discover/src/components/discover/posts-page.tsx` + `discussions.module.css`, consumed by `discover/src/app/discussions/page.tsx` (named import `{ DiscussionsPage }`, Suspense-wrapped, force-dynamic).

## Authority chain (in order)
1. Orchestrator scope + founder decisions D1–D6 (below). All product decisions are RESOLVED by the founder; none are re-opened here.
2. `docs/agent-team/TUTORIA_PRODUCT_BRAIN.md` production rules (demo ≠ production, no localStorage identity/simulated state, backend authorization authoritative).
3. Real API surface (`discover/src/lib/community/*`, `discover/src/lib/auth/session.ts`) — **overrides** the snapshot's stubs wherever they conflict (snake_case query params → camelCase `ownerType`/`ownerId`; feed RPC stubs → D1; `localStorage session_token` shim → real Supabase `getSessionAccessToken`).
4. Snapshot = validated UX evidence only, never automatic requirement where it conflicts with 1–3.

## Locked decisions (source of truth)
- **D1** Feed modes (for-you/following/communities/questions) wire to EXISTING `listPosts(tag/postType)` branching. NO new feed RPCs — remove `listForYouPosts`/`listFollowingPosts` (`/posts/feed/for-you`, `/posts/feed/following`) from ported code.
- **D2** Composer extras (poll/schedule/location/multi-image/communityLabel) stay in UI but are DEMO-GATED: only body/tags/postType/replyPermission actually sent.
- **D3** Reply-permission options kept as snapshot's 4 (Everyone / People you follow / Profiles you follow / Mentioned) even though backend enum is `everyone|community_members|disabled`. UI must not crash when sending them.
- **D4** Not-interested = in-memory local hide only (no backend, no persistence key; post returns on reload).
- **D5** LikersSheet + view counts = placeholders clearly labeled demo; like/unlike stay real.
- **D6** Welcome/onboarding walkthrough REMOVED (no `tutoria_welcome_done` reads/writes, no walkthrough UI).

## Acceptance checks

### A. Feed modes wire to existing listPosts — no new RPCs (D1)
- **PASS:** for-you → `listPosts({})`; following → `listPosts({})` (no follow-graph filter, no 401 prompt requirement); communities → `listPosts({tag:<selection>})`; questions → `listPosts({postType:"question"})`. Tab switch re-fetches via shared fetcher (0.8s min? no — use snapshot's per-mode reset: scroll to top + reload).
- **Evidence:** network tab shows only calls to `listPosts` endpoint; source contains NO `listForYouPosts`/`listFollowingPosts`/`posts/feed`; no new `.sql` RPC file.
- **Negative:** following/sign-out must NOT 401-crash (existing listPosts is auth:false).

### B. Composer serialization — demo-gated extras (D2)
- See dedicated D2 definition section. **PASS** = all 6 clauses there.
- **Evidence:** capture POST /api/v1/posts body JSON; assert keys ⊆ {body, tags, level, postType, replyPermission, communityId, imageUrl} and ∉ {poll, schedule, scheduledAt, location, imageUrls, communityLabel, attachments, imageUrl-multi}; network panel has no request carrying demo values; published card renders no poll/schedule/location/multi-image/communityLabel.

### C. Reply-permission options preserved, graceful failure (D3)
- **PASS:** composer shows all 4 snapshot options incl. defaults; publishing with each sends that exact value; publish with no selection sends `replyPermission:"everyone"`.
- **Evidence (per option):** publish with Everyone → success path (post appears in feed). Publish with the 3 non-enum values → request is sent; IF backend rejects, optimistic post rolls back AND UI shows the snapshot's "Couldn't publish your post" error state with draft retained + Try again — no uncaught exception, no blank/stuck- loading, no console error.
- **Negative:** rapid double-publish → single post, no duplicate optimistic ghosts.

### D. Route-view deep-link preserved (validated core)
- **PASS:** `/discussions?post=<id>` renders detail IN-SHELL (list behind, no modal backdrop); sticky `← Post` header present; browser URL keeps `?post=`; back/forward toggles close/open; Escape closes detail to list without backdrop artifact.
- **PASS (regression):** `/discussions/[id]` route (PostDetailPage) still renders and is not broken by the refactor; URL-encoded ids (`decodeURIComponent`) resolve.
- **Negative:** `?post=<nonexistent-id>` / malformed id → detail error/empty state with back affordance; no crash. Fresh page load with `?post=` (not in-shell) still works on mount.

### E. Detail interactions via real APIs (validated core + G)
- **PASS:** comments list `listComments("post", id)` → GET `/api/v1/comments?ownerType=post&ownerId=...`; reply POST body camelCase {ownerType, ownerId, body, parentId}; appreciated toggles real endpoint; depth-4 "continue thread" still renders nested replies beyond 3 levels; like/unlike + repost/unrepost optimistic with rollback on failure; follow via `followUser(name)`.
- **PASS:** `···` menu — owner sees Edit+Delete; non-owner sees Report opening real `ReportDialog targetType="post"`. Edit invokes `updatePost` (PATCH `/api/v1/posts/:id`), success reflected in feed/detail, failure → error toast + unchanged content. Delete → confirm → `deletePost` (DELETE), post removed from feed; failure handled. Bookmark via real `BookmarkButton targetType="post" iconOnly`; unauth → `/auth/sign-in`.
- **Negative:** session expired mid-flow → `CommunityApiError` handled, optimistic rollback, no crash; ReportDialog without session closes (existing component behavior).

### F. Escape-stack fix preserved
- **PASS:** single Escape closes ONLY the topmost layer in compound states: detail+likers-sheet; composer+emoji-picker; composer+reply-sheet; detail+report-dialog. Repeated Escape closes in LIFO order; final Escape closes the bottom layer (e.g. detail), not the page.
- **Evidence:** with React StrictMode dev double-mount, one press closes exactly one layer (proves single registered keydown listener; snapshot's `__tutoriaEsc` module guard kept). No layers open → Escape does nothing harmful.
- **Negative:** DiscardConfirm (setTimeout-deferred layer) must not be Escape-closable; pressing Escape during its 2.5s window must not close the composer underneath.

### G. Production-boundary guards (no placeholder as real)
- **PASS:** NO `localStorage.getItem("session_token")` shim ported — real `getSessionAccessToken` from `@/lib/auth/session` only. NO `/posts/feed/*` calls. NO new seeded demo users. NO new Supabase RPCs (D1).
- **PASS:** not-interested (D4) triggers NO network request, writes NO storage key (grep: no `not_interested` key in snapshot — in-memory only), post returns after full reload.
- **PASS:** welcome/onboarding (D6) absent — no walkthrough code, no `tutoria_welcome_done` read/write, `?welcome=1` ignored.
- **PASS:** LikersSheet + view counts (D5) carry a visible demo label and are never presented as backend data.
- **REVIEW (RESOLVED by founder):** WhoToFollowRail/ProfileNudge/RailSearchBox ported **demo-labeled** (visible "Demo" badge, NO backs calls, NO localStorage writes). As of contract change 6 (authorized: founder chat): `tutoria_profile_checklist`/`tutoria_nudge_dismissed` writes removed; WhoToFollowRail keeps hardcoded people but with a persistent visible demo label and no real follow call.

### H. Feed UX parity, states, responsive, a11y
- **PASS:** not-interested fade-out + confirmation toast + menu close (D4); empty states: following → "Follow people…" + Discover people link, communities/questions/search no-result states; listPosts failure → error UI + retry (no infinite spinner); loading skeletons.
- **PASS responsive:** desktop grid 88/660/320; mobile (<768) single column, rails flow below, no horizontal overflow; composer usable at 375px; touch targets ≥ 32px.
- **PASS a11y:** aria-labels on icon-only buttons (like/repost/bookmark/menu); keyboard: Tab through tabs, Enter activates in-feed buttons; visible focus; dialog focus basic behavior.
- **Negative:** slow network → skeletons then content; aborted fetch mid-transition → no stale-tab content, no crash.

### I. Demo-vs-production truthfulness
- **PASS:** copy never implies real analytics for placeholders ("views", trending rail, likers) — labeled demo or backed by real API; all real interactions hit the real backend; nothing claims production-ready beyond what persists+authorizes.

## D2 — precise testable definition of "demo-gated"
A composer control (poll, schedule, location, multi-image, communityLabel) is demo-gated iff ALL of:
1. **Control exists & is operable:** it opens, accepts input, and can be cleared inside the composer.
2. **Visible demo indication:** whenever the control has a non-empty value or its panel/picker is open, a persistent visible indicator (badge/helper text e.g. "Demo — not saved in beta") is rendered; absence of the indicator at any set-state = FAIL.
3. **Payload purity:** publishing with any demo value set yields POST `/api/v1/posts` whose JSON contains NONE of {poll, schedule, scheduledAt, location, imageUrls, communityLabel} nor any derived key (assert both by inspecting the request body and by code inspection of the payload builder).
4. **No side-channel:** network panel shows no request of any kind carrying those values (no hidden "save draft" POST, no query param echo).
5. **Render truthfulness:** the published post card renders no poll block, no schedule row, no location row, no multi-image grid, no community label — even when the demo values were set pre-publish.
6. **Draft hygiene:** `tutoria_post_draft` restore must never inject a previously-set demo value into a later publish (restore content only; demo controls reset to empty).

## Mapping to the existing 46-check isolated-preview audit
⚠️ **ORIGINAL AUDIT LOCATED:** the 46-check audit script/report IS available at `/tmp/discussions-preview/audit-feed.js` and `/tmp/discussions-preview/audit/audit.json` (verification 2026-09-23 10:56; 46 rows PASS ×3 runs, 0 FAIL). Mapping below mirrors it:
- Snapshot header items 1–3 (For You/Following fetchers, tab branching) → **A** (rewritten under D1).
- Item 4 (Not Interested) → **H** (rewritten under D4, minus backend TODO).
- Items 5–6 (following/foryou empty states) → **H**.
- Item 7 (topic filter REMOVED) → **A**: assert no stale topic-preference UI remains.
- Item 8 (feedMode persists, `tutoria_feed_mode` + `?feed=`) → **A** (allowed: UI preference, not identity).
- Header items 9+ (not enumerated; likers sheet, view counts, reply-permission menu, schedule/location pickers, emoji picker, draft persistence, escape-stack, like/follow rollback, depth-4 thread, `fmtViews` K-format) → **B/C/E/F/H**.
- Audit coverage missing from snapshot (first-time real-API wiring, payload purity, crash-on-reject, route-view in real router, StrictMode escape, production-boundary bans) → **B–I** are NEW checks, not covered by the 46.
- Playwright smoke precedent: `discover/tests/community-smoke.spec.ts` (frontend :3000, backend :4000, Supabase fixtures; chromium headless, no baseURL in `playwright.config.ts`).

## Preflight — discover app builds (what must ALWAYS be prefled)
- Affected route group (build surface): `discover/src/app/discussions/*` (page.tsx, [id], saved, tags, blogs, error, loading). Verified: ONLY `app/discussions/page.tsx` imports `posts-page.tsx`; `[id]/page.tsx` uses separate `post-detail-page.tsx` — regression-check it (check E/D).
- Commands (from `discover/package.json`; Next 16.3/React 19.2/TS 5):
  1. `node scripts/gen-tutor-store.mjs && next build` (`npm run build`) — run ALWAYS before claiming integration builds; gen-tutor-store must precede build (both dev & build scripts).
  2. `npx tsc --noEmit` — explicit type gate (verify Next 16 `next build` still type-checks; if yes, still run tsc for speed).
  3. `npm run lint` (eslint 9).
  4. `npm test` (vitest run) — existing discover unit suites.
  5. `npm run test:e2e` (playwright, tests/) — needs backend :4000 + local Supabase (community fixtures) + frontend :3000; smoke spec is the wiring precedent for a new `discussions.spec.ts`.

## UNVERIFIED / prerequisites
- **UNVERIFIED:** original 46-check audit artifact (missing — mapping is reconstruction).
- **UNVERIFIED until live run:** backend acceptance of the 3 non-enum replyPermission values (C); `updatePost`/`deletePost` behavior on real data (E) — depends on local backend+Supabase with seeded posts and an owner session token (prereq for Edit/Delete/Report testing).
- **UNVERIFIED:** full `next build` in this environment (prior audit: LAST_KNOWN_REPO_AUDIT notes discover full build was unverified due env/concurrent-install failure).
- **UNVERIFIED:** exact wording of demo labels (B2/D5) — implementation choice; QA asserts visible label exists, not its copy.
- **Scope note:** WhoToFollowRail/ProfileNudge data-source classification not in D1–D6 (see G-review); rail follow presented as real without backend = G failure → PRODUCT_DECISION_REQUIRED escalation path.
- **Prereqs for full verification:** local Supabase w/ community schema, seeded posts + users, one signed-in owner session (Edit/Delete/Report), backend on :4000, discover on :3000.