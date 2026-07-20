<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tutoria Content Creation System

## Overview
Full content creation system with two modes: **Post** (short-form, modal-based) and **Article** (long-form, dedicated editor with TipTap).

## Routes
- `/discussions` — Main feed with Posts + Blogs tabs + composer card
- `/discussions/saved` — Bookmarked posts and articles
- `/articles/new` — New article editor
- `/articles/[id]` — Published article view
- `/articles/[id]/edit` — Edit article
- `/articles/[id]/preview` — Article preview

## Storage (all localStorage)
| Key | Type | Usage |
|-----|------|-------|
| `tutoria_published_posts` | `PublishedPost[]` | Published short posts |
| `tutoria_published_articles` | `PublishedArticle[]` | Published articles |
| `tutoria_post_drafts` | `PostDraft[]` | Autosaved post drafts |
| `tutoria_article_drafts` | `ArticleDraft[]` | Autosaved article drafts |
| `tutoria_comments` | `Comment[]` | All comments/replies |

## Key Components
### Post creation
- `src/components/discussion/composer-card.tsx` — Feed entry point (signed-in/signed-out states)
- `src/components/discussion/post-composer.tsx` — Modal dialog with audience, prompts, attachments, metadata, reply permissions, autosave
- `src/components/discussion/comment-thread.tsx` — Comment/reply UI with appreciate, reply, report

### Article creation
- `src/components/article-editor/article-editor-page.tsx` — Full-page editor with cover, title, rich text, publish panel
- `src/components/article-editor/article-rich-text.tsx` — TipTap editor (H2, H3, bold, italic, lists, quote, code, image, link, divider)
- `src/components/article-editor/article-view.tsx` — Published article page
- `src/components/article-editor/article-preview.tsx` — Preview mode

### Data layer
- `src/lib/types.ts` — All type definitions (PostDraft, ArticleDraft, PublishedPost, PublishedArticle, Comment)
- `src/lib/storage.ts` — localStorage CRUD for drafts, publishing, comments, appreciate toggling

## Packages Added
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/pm`

## Design Tokens
- Editor content styled in `globals.css` under `.article-editor-content .ProseMirror` and `.article-view-content`
- Follows existing cadet-blue palette, border/spacing conventions

## Mobile
- Post composer: full-width modal on all screens
- Article editor: responsive toolbar, bottom publish CTA on mobile
- Publish panel: bottom sheet on mobile, sidebar on desktop

## Key Behaviors
- Post autosaves after 1.5s idle (PostDraft to `tutoria_post_drafts`)
- Article autosaves after 1.5s idle (ArticleDraft to `tutoria_article_drafts`)
- Writing prompts insert template text into textarea
- Audience selector: Everyone or Community (mock communities)
- Attachments: images (base64/dataURL), documents, links
- Metadata: post type, topic, skills (max 5), level, reply permissions
- Reading time calculated client-side at ~200 words/min
- Published posts appear in discussion feed alongside mock data
- Published articles appear in Blogs tab alongside mock data
- Comments support top-level + nested replies
