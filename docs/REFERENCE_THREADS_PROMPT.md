# Social/Reference Threads + Article Publishing — Implementation Prompt

## Product concept

A **reference thread** is a focused, resource-centric conversation: a shared reference artifact (a Tutoria course, event, workshop, tutor profile, article, or external URL) anchored by a short prompt, around which tutors, learners, and parents discuss fit, quality, and experience.

This prompt covers the **production-ready** build of TWO connected surfaces, both part of the "discussions + publishing" experience:
1. **Reference threads** — conversations anchored to a resource.
2. **Article publishing** — a TipTap rich-text editor with draft → publish lifecycle and a public article view.

Both share the same identity, comment/reply, engagement, report, and moderation foundations.

## External reference summary (study → abstract → Tutoria-native)

The discussion model was informed by studying GitHub Discussions, Reddit, X/Twitter, ProductHunt, Discourse, and Disqus. Classified outcomes:

| Pattern | Source | Decision | Why |
|---------|--------|----------|-----|
| Rich anchor card above discussion | ProductHunt | **ADOPT (core)** | Users must see the resource they're discussing; discussion is secondary to the anchored item |
| 3-level reply depth | GitHub, ProductHunt, Stack Overflow | **ADOPT** | Mobile-readable, prevents diagonal threads, enough for fit/quality discussion |
| Upvote-only appreciation, no downvote | ProductHunt, GitHub | **ADOPT** | Downvotes create toxicity; contradicts "trust before transaction" |
| Host/creator badge on replies | ProductHunt maker badge | **ADOPT** | Course/event hosts must be able to participate authoritatively in fit discussions |
| Async moderation (post-first, filter later) | Disqus | **ADOPT** | Critical for MVP: don't block legitimate users; catch abuse after |
| Soft-delete preserving tree structure | Reddit `[deleted]` | **ADOPT** | Child replies never orphaned |
| Emoji reactions | GitHub | **SIMPLIFY** | Defer to v2; upvote is sufficient initially |
| "Continue this thread" at depth cap | Reddit | **SIMPLIFY** | Defer; not needed with 3-level cap |
| Trust levels | Discourse | **SIMPLIFY** | Start with simple host/learner/moderator roles |
| Arbitrary-depth nesting | Reddit data model | **REJECT** | Unnecessary complexity; 3 levels is enough |
| Flat-only (no threading) | X/Twitter | **REJECT** | Reference threads need reply context |
| Pre-moderation | Disqus strict | **REJECT** | Kills engagement; async is correct |
| Anonymous/throwaway posting | Reddit | **REJECT** | Contradicts "trust before transaction" and identity principles |
| Algorithmic reply ranking | X | **CHANGE** | Light: surface host/creator replies higher; don't over-engineer |

## Product principles (non-negotiable)

1. Trust before transaction.
2. Privacy by default.
3. Fit over volume.
4. Tutor identity over commodity marketplace.
5. Progressive disclosure.
6. Demo/prototype capability is NOT production capability.

Design: charcoal/gray palette, minimal/premium, clear hierarchy, concise copy, mobile-responsive by default. No green as primary brand color.

## Current state (critical context — READ THIS FIRST)

### Production boundary

ALL existing social/discussion/article behavior in `discover/` is a **localStorage prototype**. Zero production persistence, zero backend API, zero Supabase tables for UGC/community/content. Per `TUTORIA_PRODUCT_BRAIN.md`, "public UGC/community moderation" is explicitly listed as a not-production-ready area. You are building the production layer from scratch.

### The existing prototype is a STANDALONE MONOLITH PAGE — not a component library

- `/discussions` is a single top-level route (`discover/src/app/discussions/page.tsx`) rendering `DiscussionsPage`.
- `DiscussionsPage` lives in ONE monolith file: `discover/src/components/discover/posts-page.tsx` (~700 lines), containing the feed, thread modal, comments, likes, saves, mock data (`POSTS`, `BLOGS`, `postComments`) all together.
- It carries its OWN internal sidebar rail and mobile bottom nav pointing only at other discussion sub-pages (`/discussions/saved`, `/discussions/tags/...`, `/communities`).
- `/communities` is a SEPARATE standalone `CommunitiesPage` (`discover/src/components/discover/communities-page.tsx`).
- The discussion/comment components you'd want to reuse (`CommentThread`, `PostComposer`, `ComposerCard`) are **embedded inside the `posts-page.tsx` monolith**, not cleanly extracted.

**Implication:** "reuse components" is overstated. The realistic path is **study the monolith as a pattern reference, then extract/reimplement** the seams you need with the production data layer. Do not treat the monolith as a drop-in component library. Do not carry forward its mock data, its `tutoria_signup` localStorage auth, or raw `dangerouslySetInnerHTML`.

### Existing prototypes to study for UX patterns

| File | What to extract |
|------|-----------------|
| `discover/src/components/discover/posts-page.tsx` | Feed layout, three-column rail, thread modal, tag filtering, likes/saves interaction, relative `formatTime()` |
| `discover/src/components/discussion/comment-thread.tsx` | Reply tree UI, reply-to-reply, appreciate (upvote), report affordance; NOTE it's monolith-adjacent, extract carefully |
| `discover/src/components/article-editor/article-editor-page.tsx` | TipTap editor page: cover, title, rich text, publish panel, autosave pattern |
| `discover/src/components/article-editor/article-view.tsx` / `article-preview.tsx` | Article layout: cover, byline, content, action bar, comments |
| `discover/src/lib/types.ts` | Existing type vocabulary: `ContentLevel`, `ContentVisibility`, `ReplyPermission`, `PostType`, `ArticleDraft` — reuse names |
| `discover/src/components/discussion/post-composer.tsx` | Progressive disclosure composer (core textarea → expand metadata) |

**Do NOT carry forward:**
- `dangerouslySetInnerHTML` in `article-preview.tsx:83` / `article-view.tsx:141` — sanitize with allowlist before render
- `getUserFromStorage()` / `tutoria_signup` localStorage auth — use Supabase Auth
- All localStorage reads/writes (`tutoria_published_posts`, `tutoria_comments`, `tutoria_post_drafts`, etc.) — replace with API calls
- Mock data arrays (`POSTS`, `BLOGS`, `postComments`, `COMMUNITIES`) — remove entirely

### Existing utilities to reuse

- `sanitizeRichHtml()` / `sanitizeHtmlText()` in `discover/src/lib/sanitize.ts` (with SSR fallback)
- `isSafeHttpUrl()` in `discover/src/lib/api-security.ts`
- `apiFetch()` in `discover/src/lib/api.ts` for backend calls
- Slug normalization in `backend/src/services/event-publication-service.ts` and `backend/src/routes/marketplace.ts`
- Supabase auth: `discover/src/lib/auth/identity.ts` (`setLiveIdentity`/`getLiveIdentity`)

### Dependency note

No new npm packages are needed — verify this before adding any. Supabase (v2), Fastify 5, Next.js 16 / React 19, zod, TipTap are all installed. All sanitization/URL/slug utilities are in-house.

## Architecture to follow

Production truth lives in `backend/` (Fastify 5 + Supabase) and `discover/` (Next.js 16 / React 19). Do NOT build production behavior in the root TutorMatch SPA.

### Backend pattern (follow events/offerings exactly)

```
Route (Fastify) → Service (Supabase client per request with caller JWT) → Security-definer RPC (auth.uid() gate)
```

- Fastify 5 with `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`
- Zod validation on all inputs; `ApiError(statusCode, code, message)` for errors
- Per-request Supabase client: `createClient(url, key, { global: { headers: { Authorization: Bearer ${token} } } })`
- Tables: `enable row level security` + `revoke all from public, anon, authenticated` (closed by default)
- All mutation logic in `security definer set search_path = ''` PL/pgSQL functions
- Public read via RPCs only (no direct table SELECT from client)
- Identity never comes from client; ownership never comes from client
- Public payloads never expose `creator_id`, auth IDs, emails, phones
- Debian-style async moderation: posts appear immediately, moderation catches abuse after

### Migration convention

`backend/supabase/migrations/YYYYMMDDHHMMSS_description.sql`

## Database schema

### reference_threads

```sql
create table public.reference_threads (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.profiles(id),
  title           text not null check (char_length(title) between 1 and 200),
  body            text check (body is null or char_length(body) <= 2000),
  anchor_type     text not null check (anchor_type in ('course','event','workshop','article','tutor_profile','external_url')),
  anchor_id       uuid null,
  anchor_url      text null,
  anchor_title    text null check (anchor_title is null or char_length(anchor_title) <= 500),
  anchor_domain   text null check (anchor_domain is null or char_length(anchor_domain) <= 255),
  tags            text[] not null default '{}',
  level           text check (level in ('complete_beginner','beginner','intermediate','advanced','all_levels')),
  visibility      text not null default 'public' check (visibility in ('public','community')),
  community_id    uuid null,
  status          text not null default 'published' check (status in ('published','closed','deleted','removed')),
  reply_permission text not null default 'everyone' check (reply_permission in ('everyone','community_members','disabled')),
  appreciated_count integer not null default 0,
  reply_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.reference_threads enable row level security;
```

### reference_thread_replies

Max depth 3 (thread → reply → reply-to-reply). Enforced in RPC.

```sql
create table public.reference_thread_replies (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.reference_threads(id) on delete cascade,
  parent_id       uuid null references public.reference_thread_replies(id) on delete cascade,
  creator_id      uuid not null references public.profiles(id),
  body            text not null check (char_length(body) between 1 and 2000),
  status          text not null default 'published' check (status in ('published','deleted','removed')),
  appreciated_count integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.reference_thread_replies enable row level security;
```

### reference_thread_appreciations (upvote-only, no downvote)

```sql
create table public.reference_thread_appreciations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id),
  target_type     text not null check (target_type in ('thread','reply')),
  target_id       uuid not null,
  created_at      timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

alter table public.reference_thread_appreciations enable row level security;
```

### reference_thread_reports

```sql
create table public.reference_thread_reports (
  id              uuid primary key default gen_random_uuid(),
  target_type     text not null check (target_type in ('thread','reply')),
  target_id       uuid not null,
  reporter_id     uuid not null references public.profiles(id),
  reason          text not null check (char_length(reason) between 1 and 500),
  status          text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at      timestamptz not null default now(),
  unique (target_id, reporter_id)
);

alter table public.reference_thread_reports enable row level security;
```

### articles (production article publishing)

```sql
create table public.articles (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles(id),
  slug            text not null unique,
  title           text not null check (char_length(title) between 1 and 200),
  subtitle        text,
  excerpt         text check (excerpt is null or char_length(excerpt) <= 500),
  cover_image_url text,
  cover_image_alt text,
  content_html    text not null,
  content_json    jsonb not null,
  tags            text[] not null default '{}',
  level           text check (level in ('complete_beginner','beginner','intermediate','advanced','all_levels')),
  estimated_reading_minutes integer not null default 1,
  comments_enabled boolean not null default true,
  status          text not null default 'draft' check (status in ('draft','published','deleted','removed')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.articles enable row level security;
```

`content_html` is the sanitized rich-text HTML produced by the TipTap editor schema; `content_json` is the raw TipTap JSON for re-editing. `content_html` is sanitized server-side with an allowlist on every save/publish.

### article comments (reuses reference thread reply model, or a shared comment table)

Shared comment table for both threads and articles:

```sql
create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid null references public.comments(id) on delete cascade,
  owner_type      text not null check (owner_type in ('thread','article')),
  owner_id        uuid not null,
  creator_id      uuid not null references public.profiles(id),
  body            text not null check (char_length(body) between 1 and 2000),
  status          text not null default 'published' check (status in ('published','deleted','removed')),
  appreciated_count integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.comments enable row level security;
```

Depth cap (3) enforced in RPC for `owner_type = 'thread'`; articles may use a shallower cap or same cap.

### Indexes

```sql
create index idx_threads_status_created on public.reference_threads (status, created_at desc);
create index idx_threads_creator on public.reference_threads (creator_id);
create index idx_threads_tags on public.reference_threads using gin (tags);
create index idx_threads_anchor on public.reference_threads (anchor_type, anchor_id);
create index idx_thread_replies_thread on public.reference_thread_replies (thread_id, created_at);
create index idx_thread_replies_parent on public.reference_thread_replies (parent_id);
create index idx_thread_reports_target on public.reference_thread_reports (target_type, target_id);
create index idx_articles_slug on public.articles (slug);
create index idx_articles_author on public.articles (author_id);
create index idx_articles_status_published on public.articles (status, published_at desc);
create index idx_comments_owner on public.comments (owner_type, owner_id, created_at);
create index idx_comments_parent on public.comments (parent_id);
```

### Updated_at triggers

```sql
create or replace function public.set_threads_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

create trigger trg_reference_threads_updated_at
  before update on public.reference_threads
  for each row execute function public.set_threads_updated_at();

create or replace function public.set_articles_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

create trigger trg_articles_updated_at
  before update on public.articles
  for each row execute function public.set_articles_updated_at();
```

## Security-definer RPCs

All follow the established pattern: `security definer set search_path = ''`, verify `auth.uid()` is non-null and has a `profiles` row, strip identity from responses.

### Threads

- `create_reference_thread(...)` — validates anchor (internal entity exists + is published, OR valid external URL), inserts with `creator_id = auth.uid()`.
- `list_reference_threads(p_cursor, p_limit, p_tag, p_level, p_anchor_type, p_community_id)` — public, cursor-paginated by `created_at`, returns anchor summary without `creator_id`.
- `get_reference_thread(p_id)` — public, returns thread + anchor card + replies (paginated). For internal anchors, join to resolve preview metadata (title, cover). Returns `is_creator` (bool, from `auth.uid()` if authed) so UI can show owner actions, but never `creator_id`.
- `reply_to_thread(p_thread_id, p_body, p_parent_id)` — enforces thread `status = 'published'`, depth ≤ 3 (parent's ancestor depth), `reply_permission` (everyone/community_members/disabled), verifies community membership when scoped.
- `close_reference_thread(p_id)` / `reopen_reference_thread(p_id)` — verify `auth.uid() = creator_id`. Atomic: closing rejects concurrent replies in the same transaction.
- `delete_reference_thread(p_id)` / `delete_reply(p_id)` — verify `auth.uid() = creator_id`, soft-delete (`status → 'deleted'`), preserve child tree.
- `appreciate_reference(target_type, target_id)` / `unappreciate_reference(...)` — upvote-only toggle, unique constraint prevents double-appreciation.
- `report_reference_content(target_type, target_id, reason)` — insert report (dedupe on target+reporter), never expose reporter identity.

### Articles

- `create_article_draft(author, title, ...)` — inserts `status = 'draft'`, `author_id = auth.uid()`, sanitizes `content_html` server-side.
- `update_article_draft(p_id, ...)` — verify `auth.uid() = author_id` and status = 'draft'.
- `publish_article(p_id)` — verify author, set `status = 'published'`, `published_at = now()`, generate/validate slug. Atomic.
- `unpublish_article(p_id)` — verify author, `status → 'draft'` or 'deleted'.
- `delete_article(p_id)` — verify author (or moderator), soft-delete.
- `get_public_article_by_slug(p_slug)` — public, returns published article + sanitized HTML + comment count.
- `list_public_articles(p_cursor, p_limit, p_tag)` — public, paginated by `published_at desc`.

### Comments (shared)

- `create_comment(owner_type, owner_id, body, parent_id)` — enforces depth, owner is published/open, `comments_enabled`.
- `delete_comment(p_id)` — verify creator, soft-delete preserve children.
- `appreciate_comment(p_id)` / `unappreciate_comment(p_id)`.

### Public read functions

Strip `creator_id`, `author_id`, emails, phones, auth IDs from ALL public payloads. Compute derived fields (`is_creator`, `appreciated_by_me`) via `auth.uid()` locally, only for authed callers.

## Backend routes

Add registration in `backend/src/app.ts`.

| Method | Path | Auth | Rate limit | RPC |
|--------|------|------|------------|-----|
| POST | /api/v1/threads | Yes | 10/min | create_reference_thread |
| GET | /api/v1/threads | No | 60/min | list_reference_threads |
| GET | /api/v1/threads/:id | No | 60/min | get_reference_thread |
| POST | /api/v1/threads/:id/replies | Yes | 30/min | reply_to_thread |
| POST | /api/v1/threads/:id/appreciate | Yes | 30/min | appreciate_reference |
| DELETE | /api/v1/threads/:id/appreciate | Yes | 30/min | unappreciate_reference |
| PATCH | /api/v1/threads/:id/close | Yes (owner) | 10/min | close_reference_thread |
| PATCH | /api/v1/threads/:id/reopen | Yes (owner) | 10/min | reopen_reference_thread |
| DELETE | /api/v1/threads/:id | Yes (owner) | 10/min | delete_reference_thread |
| DELETE | /api/v1/threads/replies/:id | Yes (owner) | 10/min | delete_reply |
| POST | /api/v1/threads/report | Yes | 5/min | report_reference_content |
| POST | /api/v1/articles | Yes | 20/min | create_article_draft |
| PATCH | /api/v1/articles/:id | Yes (owner) | 20/min | update_article_draft |
| POST | /api/v1/articles/:id/publish | Yes (owner) | 20/min | publish_article |
| POST | /api/v1/articles/:id/unpublish | Yes (owner) | 20/min | unpublish_article |
| DELETE | /api/v1/articles/:id | Yes (owner) | 20/min | delete_article |
| GET | /api/v1/articles/:slug | No | 60/min | get_public_article_by_slug |
| GET | /api/v1/articles | No | 60/min | list_public_articles |
| POST | /api/v1/comments | Yes | 30/min | create_comment |
| DELETE | /api/v1/comments/:id | Yes (owner) | 30/min | delete_comment |

Validation schemas (zod):

```typescript
const createThreadSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  anchorType: z.enum(['course','event','workshop','article','tutor_profile','external_url']),
  anchorId: z.string().uuid().optional(),
  anchorUrl: z.string().url().max(2048).refine((v) => isSafeHttpUrl(v)).optional(),
  anchorTitle: z.string().max(500).optional(),
  anchorDomain: z.string().max(255).optional(),
  tags: z.array(z.string().max(50)).max(5).optional(),
  level: z.enum(['complete_beginner','beginner','intermediate','advanced','all_levels']).optional(),
  visibility: z.enum(['public','community']).default('public'),
  communityId: z.string().uuid().optional(),
  replyPermission: z.enum(['everyone','community_members','disabled']).default('everyone'),
});

const replySchema = z.object({
  body: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

const reportSchema = z.object({
  targetType: z.enum(['thread','reply','comment']),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const articleSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  excerpt: z.string().max(500).optional(),
  coverImageUrl: z.string().url().max(2048).optional(),
  coverImageAlt: z.string().max(300).optional(),
  contentHtml: z.string().refine((v) => sanitizeRichHtml(v) === v, 'unsafe html'),
  contentJson: z.unknown(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  level: z.enum(['complete_beginner','beginner','intermediate','advanced','all_levels']).optional(),
  estimatedReadingMinutes: z.number().int().min(1).max(120).optional(),
});
```

## Frontend (discover/)

### Routes (new, alongside existing `/discussions`)

Two approaches — pick per navigation decision below:

| Route | Page | Purpose |
|-------|------|---------|
| /threads | ThreadsFeedPage | Reference-thread feed with filters (tag, level, anchor type) |
| /threads/new | ThreadComposerPage | Create a reference thread (anchor picker + prompt) |
| /threads/[id] | ThreadDetailPage | Thread + anchor card + nested replies + appreciate + report |
| /articles/new | ArticleEditorPage | TipTap editor + cover + publish panel (production, wired to API) |
| /articles/[slug] | ArticleView | Public article + comments |
| /articles/[slug]/edit | ArticleEditorPage | Edit published/draft article |
| /profile/[userId] | ProfilePage (threads + articles tabs) | Author identity: their threads/articles |

### Components to build

| Component | Description |
|-----------|-------------|
| AnchorPicker | Select internal entity (search courses/events/workshops/tutors/articles) or enter validated external URL with safe preview |
| AnchorCard | Rich anchor card (ProductHunt model): type badge, title, thumbnail, key facts — above the discussion |
| ThreadCard | Feed card: anchor summary, prompt, reply count, appreciation count, author + host badge |
| ThreadDetail | Full view with anchor card + prompt + reply tree |
| ReplyComposer | Reply input (threaded, depth-aware) |
| ReplyTree | Nested replies (max 3 levels, visual thread lines, collapse/expand) |
| AppreciateButton | Upvote toggle (optimistic) |
| ThreadFilters | Tag, level, anchor type, community filter bar |
| ThreadActions | Close, reopen, delete, report (owner-only where applicable) |
| ArticleEditor | Production TipTap editor (reuse `article-editor-page.tsx` patterns), wired to article API |
| ArticleView | Production article page with sanitized HTML + comments |

### Navigation decision

The current `/discussions` is a standalone page with its own internal rail. Decide (with founder) ONE of:
- **A.** Keep `/discussions` as-is for now; add `/threads` as a new standalone route. Lowest risk, keeps prototype untouched.
- **B.** Fold reference threads into the existing `/discussions` page as a "Threads" tab. Retrofits the monolith.
- **C.** Replace `/discussions` with the production `/threads` page. Cleanest but deletes prototype capability.

Recommended: **A** for MVP (non-destructive, isolates the production build), migrate to B/C later. Surface the decision in your report.

### Data fetching

Use React Server Components for feed/detail pages. Client components for composer, replies, appreciate, and interactive elements. Fetch from `/api/v1/...`. Optimistic UI for replies and appreciate toggles. Pluralize all public responses correctly.

### Patterns to extract (not blindly reuse)

Study these in the monolith and extract/reimplement with the production data layer:
- Three-column feed layout + responsive bottom-navigation pattern from `posts-page.tsx`
- Progressive disclosure composer from `post-composer.tsx`
- Reply tree + appreciate + report affordance from `comment-thread.tsx`
- `formatTime()` relative timestamp
- TipTap editor + publish panel from `article-editor-page.tsx`
- Article layout from `article-view.tsx` (but render sanitized HTML, never raw)

### Auth integration

Replace `getUserFromStorage()`. Use the Supabase session via `discover/src/lib/auth/identity.ts` (`setLiveIdentity`/`getLiveIdentity`), with `apiFetch()` attaching the bearer token. Never trust client-declared identity/role.

## Security requirements

1. XSS: all user body/content rendered via React text interpolation. `content_html` for articles must be allowlist-sanitized **server-side on every save/publish** via `sanitizeRichHtml()` before persistence and again checked equal on input. Never render raw editor HTML with `dangerouslySetInnerHTML`.
2. SSRF: no server-side fetch of external anchor URLs. Author-supplied title/domain only. External URLs validated with `isSafeHttpUrl()` (https-only, no `file:`/`data:`).
3. Image src from user data: validate against allowed domains (Supabase storage, approved CDNs); reject `data:` and `javascript:`. Enforce server-side and client-side.
4. RLS: tables closed by default; all access via security-definer RPCs; explicit `revoke`/`grant`.
5. Rate limits on all mutation endpoints.
6. Report reporter identity hidden from public and from content author.
7. Depth enforcement: max 3 levels for threads (thread → reply → reply) in RPC.
8. No `creator_id`, `author_id`, auth IDs, emails, or phones in public API responses.
9. All identity from `auth.uid()` in RPCs, never from client metadata.
10. Ownership check (`auth.uid() = creator_id`) in every mutation; clients can never claim others' content.
11. `content_json` (TipTap JSON) is large/untrusted — bound size, validate shape, never interpolate as HTML.
12. Slug always server-generated/validated (from `event-publication-service.ts` pattern), never client-chosen free-form.

## Acceptance criteria

### Threads
1. Thread CRUD: create, read, close, reopen, delete — persist to Supabase, RLS-enforced.
2. Reply CRUD: create, nested reply, delete — depth capped at 3.
3. Anchor types: internal entity shows preview card; external URL shows link card; invalid anchor rejected.
4. Visibility: public visible to all; community-scoped visible to members only.
5. Owner permissions: only creator can close/reopen/delete; `reply_permission` enforced.
6. Appreciate: upvote toggle only (no downvote), one per user per target, optimistic UI.
7. Report: flag content; report stored; reporter identity hidden.
8. Feed filters: tag, level, anchor type, community all work.

### Articles
9. Draft → publish → unpublish → delete lifecycle, owner-only, slug server-generated.
10. Article editor autosaves drafts (server-side), publish sets `published_at`.
11. New articles and drafts never exposed to unauthorized readers.

### Cross-cutting
12. All pages mobile-responsive at 375px+.
13. Console clean: no JS errors, no leaked auth IDs in network responses.
14. RLS: unauthenticated cannot mutate; authenticated cannot mutate others' content.
15. No localStorage dependency in any thread/reply/article path.

## QA checklist

- Desktop + mobile viewport verification
- Adversarial: cross-user mutation, depth violation, XSS in body/contentHtml, SSRF via anchor URL, oversized content_json, rate limit bypass, slug collision
- Report isolation: reporter identity never disclosed
- Appreciate idempotency: duplicate taps don't double-count
- Verify no localStorage in thread/reply/article paths
- Verify no creator_id/author_id/auth.uid() in public API responses
- Security reviewer sign-off on RLS policies + article HTML sanitization

## Open decisions (confirm with founder at start; default values given)

1. Anonymous posting — default **OFF** (trust/identity principle)
2. Community-scoped vs public-only — default **public by default**, optional community scope
3. Thread as first-class entity — default **YES** (separate from posts/articles)
4. Edit after publish — default **NO for threads** (delete only); **articles: drafts editable, published immutable except title/metadata** (reversible)
5. Reply depth — default **3 levels**
6. Navigation — default **Option A** (new `/threads` route, prototype left intact)
7. Article `comments_enabled` default — default **true**, owner can toggle

## Deliverables

1. Migration file(s) in `backend/supabase/migrations/`
2. RPC functions + grants
3. Backend routes (`backend/src/routes/threads.ts`, `articles.ts`, `comments.ts`) + registration in `app.ts`
4. Services (`backend/src/services/threads.ts`, `articles.ts`, `comments.ts`)
5. Frontend pages + components under `discover/src/`
6. Route registration in `discover` navigation
7. Tests (backend unit/integration for RPC + routes; frontend where applicable)
8. QA evidence + security review sign-off
9. Run `python3 scripts/oss_guard.py ci` (no new external deps expected; flag if any)
