# Third-Party Notices

Generated from `oss/EXTERNAL_SOURCES.json` by `scripts/oss_guard.py`.
This ledger records external source actually incorporated into Tutoria; it does not itself replace upstream LICENSE/NOTICE files that must be preserved when required.

<!-- OSS:actions-checkout -->
## GitHub Actions checkout

- Source: https://github.com/actions/checkout
- Pinned ref/version: `11d5960a326750d5838078e36cf38b85af677262`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `.github/workflows/oss-license-gate.yml: actions/checkout`
- Evidence checked:
  - Exact commit tarball; root LICENSE SHA-256 3e855ffa704114a51628ef8f0bf3aeb41728adf9d9070e263bf58aa5640b0eb5
  - Bundled .licenses/npm material resolves to MIT, ISC, or Apache-2.0
- Required actions:
  - Preserve the applicable MIT and bundled dependency notices in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, marketplace service, and unverified assets

<!-- OSS:actions-setup-python -->
## GitHub Actions setup-python

- Source: https://github.com/actions/setup-python
- Pinned ref/version: `a309ff8b426b58ec0e2a45f0f869d46889d02405`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `.github/workflows/oss-license-gate.yml: actions/setup-python`
- Evidence checked:
  - Exact commit tarball; root LICENSE SHA-256 7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32
  - Bundled dependencies resolve to MIT, ISC, Apache-2.0, or 0BSD
- Required actions:
  - Preserve the applicable MIT and bundled dependency notices in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, marketplace service, and unverified assets

<!-- OSS:chatly-message-attachments-rls -->
## chatly message_attachments storage RLS (pattern only)

- Source: https://github.com/shravzzv/chatly
- Pinned ref/version: `762453127c3d3763ad4b15e85d89f0f0c519ea10`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: pattern-adaptation
- Checked on: 2026-09-01
- Scope incorporated:
  - `supabase/migrations/20260513045749_setup_rls_for_message_attachments_bucket.sql (insert/select/delete RLS on storage.objects scoped to bucket='message_attachments')`
  - `supabase/functions/create-msg-attachment/insert-attachment.ts (edge function pattern for recording attachment metadata after upload)`
- Evidence checked:
  - Local shallow clone: /tmp/tutoria-reuse-audit/chatly
  - Root LICENSE SHA-256 54db3fcc0a2a32d3f0c2de4a9e0211e347b165a5795ee02ccf56f9fe227175e1
  - Files inventoried and read but NOT copied wholesale.
- Required actions:
  - Preserve the upstream MIT notice in THIRD_PARTY_NOTICES.md.
  - Adapted SQL must use Tutoria's table name `public.message_attachments` (not chatly's column shape). Tutoria already has this table from migration 20260909000000_messaging_alpha_v2.sql with columns: id, message_id, storage_bucket, storage_path, filename, mime_type, size_bytes, created_at. The split_part(name,'/',1)::uuid cast in the RLS is incompatible with Tutoria's `<message_id>/<file>` storage layout; Tutoria's layout will be `<conversation_id>/<message_id>/<file>` and the RLS will be rewritten to enforce that.
  - The edge function pattern is a model only — Tutoria will attach the row to the message via a SECURITY DEFINER RPC `create_message_with_attachments`, not via a generic insert.
- Excluded material:
  - chatly's lemonsqueezy integration, paywall, AI-enhance-text function, expo push notifications, react-native mobile app.
  - Upstream brands, trademarks, marketplace copy, hard-coded marketing text, SaaS-ready template copy.

<!-- OSS:dotenv-17.4.2 -->
## dotenv

- Source: https://github.com/motdotla/dotenv
- Pinned ref/version: `17.4.2`
- License: `BSD-2-Clause`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: dotenv`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable BSD-2-Clause copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:esbuild-0.24.2 -->
## esbuild

- Source: https://github.com/evanw/esbuild
- Pinned ref/version: `0.24.2`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `package.json: esbuild`
- Evidence checked:
  - Root lockfile and installed package.json/LICENSE.md
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:eslint-9.39.5 -->
## ESLint

- Source: https://github.com/eslint/eslint
- Pinned ref/version: `9.39.5`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: eslint`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:eslint-config-next-16.3.0 -->
## Next.js ESLint configuration

- Source: https://github.com/vercel/next.js
- Pinned ref/version: `16.3.0`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: eslint-config-next only`
- Evidence checked:
  - discover/package-lock.json, installed package manifest, and exact-release repository root license
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Next.js runtime package and its separately licensed bundled components, Vercel brands/trademarks, documentation, examples, and assets

<!-- OSS:fastify-5.11.2 -->
## Fastify

- Source: https://github.com/fastify/fastify
- Pinned ref/version: `5.11.2`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: fastify`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:fastify-cors-11.3.0 -->
## Fastify CORS

- Source: https://github.com/fastify/fastify-cors
- Pinned ref/version: `11.3.0`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: @fastify/cors`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:fastify-helmet-13.1.0 -->
## Fastify Helmet

- Source: https://github.com/fastify/fastify-helmet
- Pinned ref/version: `13.1.0`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: @fastify/helmet`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:fastify-plugin-5.1.0 -->
## Fastify Plugin

- Source: https://github.com/fastify/fastify-plugin
- Pinned ref/version: `5.1.0`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: fastify-plugin`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:fastify-rate-limit-10.3.0 -->
## Fastify Rate Limit

- Source: https://github.com/fastify/fastify-rate-limit
- Pinned ref/version: `10.3.0`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: @fastify/rate-limit`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:jsdom-29.1.1 -->
## jsdom

- Source: https://github.com/jsdom/jsdom
- Pinned ref/version: `29.1.1`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `package.json: jsdom`
- Evidence checked:
  - Root lockfile and installed package manifest/LICENSE.txt
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:lucide-react-0.468.0 -->
## Lucide React 0.468.0

- Source: https://github.com/lucide-icons/lucide
- Pinned ref/version: `0.468.0`
- License: `ISC`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `package.json: lucide-react`
  - `components/profile-preview.js`
  - `Pinned Lucide UMD references in discover/public HTML`
- Evidence checked:
  - Root lockfile, installed LICENSE, generated bundle comments, and fixed-version CDN URLs with SRI
- Required actions:
  - Preserve the applicable ISC copyright and license text in distributed copies
- Excluded material:
  - Upstream names, logos, trademarks, documentation, examples, and unverified assets

<!-- OSS:lucide-react-1.24.0 -->
## Lucide React 1.24.0

- Source: https://github.com/lucide-icons/lucide
- Pinned ref/version: `1.24.0`
- License: `ISC`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: lucide-react`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable ISC copyright and license text in distributed copies
- Excluded material:
  - Upstream names, logos, trademarks, documentation, examples, and unverified assets

<!-- OSS:modernchattingwebsite-chatinput-typing-presence -->
## ModernChattingWebsite chat input + typing + presence (pattern only)

- Source: https://github.com/zainshah3464/ModernChattingWebsite
- Pinned ref/version: `456c7dfa65b481b932a69341b805396c1bafe24c`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: pattern-adaptation
- Checked on: 2026-09-01
- Scope incorporated:
  - `components/chat/ChatInput.tsx (file picker, preview URL.createObjectURL, MIME detection, upload path pattern)`
  - `lib/hooks/useTypingIndicator.ts (Supabase broadcast channel for typing events, 3s auto-clear)`
  - `components/providers/PresenceProvider.tsx (Supabase presence channel)`
- Evidence checked:
  - Local shallow clone: /tmp/tutoria-reuse-audit/ModernChattingWebsite
  - Root LICENSE.txt SHA-256 ccc7f664707071b761f06b4d8cbad0eb270980989c6ebbf468f2a852fc394d75
  - Files inventoried and read but NOT copied wholesale.
- Required actions:
  - Preserve the upstream MIT notice in THIRD_PARTY_NOTICES.md.
  - Adapted files must NOT be byte-identical copies. Re-implement against Tutoria's `MessagingApiError`, the booking-context surface, the `subscribeToConversationMessages` channel already shipped in discover/src/lib/messaging-api.ts, and Tutoria's visual language (charcoal/gray, no framer-motion, no emoji-picker, no Mic, no glassmorphism).
  - The presence provider is OPT-IN. Tutoria's spec marks presence as optional and warns against implying exact online state. Only ship the hook if Tutoria adds a presence surface.
- Excluded material:
  - framer-motion, lucide-react, emoji-picker-react, zustand, next-cloudinary, peerjs — none of these are MIT-compatible dependencies Tutoria already has, and none are required by the patterns being adapted.
  - Emoji/Voice/Reaction/Screen-share features. Tutoria's spec explicitly defers these.
  - TutorStartup's prior parent/tutor naming and onboarding flow.
  - Upstream brands, trademarks, marketplace copy, hard-coded marketing text, glassmorphism styling.

<!-- OSS:motion-12.42.2 -->
## Motion

- Source: https://github.com/motiondivision/motion
- Pinned ref/version: `12.42.2`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: motion`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE.md
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and unverified assets

<!-- OSS:react-19.2.4 -->
## React and React DOM 19.2.4

- Source: https://github.com/facebook/react
- Pinned ref/version: `19.2.4`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: react and react-dom`
- Evidence checked:
  - discover/package-lock.json and installed package manifests/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:react-19.2.7 -->
## React and React DOM 19.2.7

- Source: https://github.com/facebook/react
- Pinned ref/version: `19.2.7`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `package.json: react and react-dom`
  - `components/profile-preview.js`
- Evidence checked:
  - Root lockfile, installed manifests/LICENSE, and retained generated bundle license comments
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:supabase-js-2.110.7 -->
## Supabase JavaScript client 2.110.7

- Source: https://github.com/supabase/supabase-js
- Pinned ref/version: `2.110.7`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `package.json: @supabase/supabase-js`
  - `backend/package.json: @supabase/supabase-js`
  - `auth.bundle.js`
- Evidence checked:
  - Root/backend lockfiles and installed package manifests
  - Installed LICENSE SHA-256 334dd6820e2eaeab2064e7c59001b810566728a28a41a7c1dbf69bbee17d0936
- Required actions:
  - Carry the full Supabase MIT notice with distributed auth.bundle.js because its generated output omits the header
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and unverified assets

<!-- OSS:supabase-js-2.112.2 -->
## Supabase JavaScript client 2.112.2

- Source: https://github.com/supabase/supabase-js
- Pinned ref/version: `2.112.2`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: @supabase/supabase-js`
- Evidence checked:
  - discover/package-lock.json and installed package manifests/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and unverified assets

<!-- OSS:supabase-phoenix-0.4.5 -->
## Supabase Phoenix client

- Source: https://github.com/supabase/phoenix
- Pinned ref/version: `0.4.5`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `Transitive @supabase/phoenix dependency in root, backend, and discover lockfiles`
- Evidence checked:
  - Lockfiles and installed @supabase/phoenix package.json/LICENSE.md
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and unverified assets

<!-- OSS:tabler-icons-react-3.44.0 -->
## Tabler Icons React

- Source: https://github.com/tabler/tabler-icons
- Pinned ref/version: `3.44.0`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: @tabler/icons-react`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream names, logos, trademarks, documentation, examples, and unverified assets

<!-- OSS:tailwindcss-4.3.2 -->
## Tailwind CSS 4.3.2

- Source: https://github.com/tailwindlabs/tailwindcss
- Pinned ref/version: `4.3.2`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: tailwindcss`
  - `discover/package.json: @tailwindcss/postcss`
- Evidence checked:
  - discover/package-lock.json and installed package manifests/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and unverified assets

<!-- OSS:tailwindcss-cdn-3.4.17 -->
## Tailwind CSS browser CDN 3.4.17

- Source: https://github.com/tailwindlabs/tailwindcss
- Pinned ref/version: `3.4.17`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `Pinned Tailwind CDN scripts in discover/public HTML`
  - `Generated CSS embedded in discover/public/course-profile.html`
- Evidence checked:
  - Exact npm tarball and root/nested LICENSE files
  - Fixed-version CDN references with SRI; LICENSE SHA-256 60e0b68c0f35c078eef3a5d29419d0b03ff84ec1df9c3f9d6e39a519a5ae7985
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and unverified assets

<!-- OSS:tiptap-core-packages-3.27.3 -->
## Tiptap core editor packages

- Source: https://github.com/ueberdosis/tiptap
- Pinned ref/version: `3.27.3`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: @tiptap/extension-image`
  - `discover/package.json: @tiptap/extension-link`
  - `discover/package.json: @tiptap/extension-placeholder`
  - `discover/package.json: @tiptap/pm`
  - `discover/package.json: @tiptap/react`
  - `discover/package.json: @tiptap/starter-kit`
- Evidence checked:
  - discover/package-lock.json, exact installed manifests/LICENSE files, and registry hint
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Tiptap Pro, cloud services, hosted services, documentation, examples, brands, and unverified assets

<!-- OSS:tsx-4.23.1 -->
## tsx

- Source: https://github.com/privatenumber/tsx
- Pinned ref/version: `4.23.1`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: tsx`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:tutorstartup-messaging-pattern -->
## TutorStartup chat hooks and components (pattern only)

- Source: https://github.com/tise-genene/tutorstartup
- Pinned ref/version: `fd6887b28ee39b51e20b4fbb545a43c18e1f35da`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: pattern-adaptation
- Checked on: 2026-09-01
- Scope incorporated:
  - `src/hooks/useMessaging.ts (useMessaging, useConversation)`
  - `src/hooks/useFileUpload.ts (useFileUpload)`
  - `src/app/_components/ChatWindow.tsx (MessageBubble)`
  - `src/app/_components/ConversationList.tsx`
  - `src/app/_components/StartConversationModal.tsx`
  - `supabase/migrations/20260214000000_add_messaging_system.sql (schema pattern)`
  - `supabase/migrations/20260215000000_add_storage_buckets.sql`
  - `supabase/migrations/20260217000001_enable_realtime_messages.sql`
- Evidence checked:
  - Local shallow clone of HEAD: /tmp/tutoria-reuse-audit/tutorstartup
  - Root LICENSE SHA-256 e461a528b970e86ba79e11a3a5ac0bcc55774d53cd2970504e91c6005f3639e9
  - Files inventoried and read but NOT copied wholesale. Patterns adapted to Tutoria's server-authoritative UI, conversation_members model, and booking-context domain.
- Required actions:
  - Preserve the upstream MIT notice in THIRD_PARTY_NOTICES.md (the project's autogenerated notice summary).
  - Adapted files must NOT be byte-identical copies; they must be retyped/modified to reflect Tutoria's domain (booking_id, viewerRole, BookingContextCard, server-authoritative append, booking_id-aware conversation_summary, Tutoria's auth gate, Tutoria's messaging-api client).
- Excluded material:
  - parent_id/tutor_id naming (Tutoria uses conversation_members.role='host'|'learner').
  - TutorStartup's distinct domain (parent/tutor/job_post/proposal).
  - TutorStartup's specific storage bucket name 'messages' (Tutoria will use 'message-attachments').
  - Upstream brands, trademarks, marketplace copy, hard-coded marketing text.

<!-- OSS:types-node-20.19.43 -->
## Type definitions for Node 20.19.43

- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Pinned ref/version: `20.19.43`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: @types/node`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Other DefinitelyTyped packages, upstream brands, documentation, examples, and unverified assets

<!-- OSS:types-node-22.20.1 -->
## Type definitions for Node 22.20.1

- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Pinned ref/version: `22.20.1`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: @types/node`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Other DefinitelyTyped packages, upstream brands, documentation, examples, and unverified assets

<!-- OSS:types-react-19.2.17 -->
## Type definitions for React 19.2.17

- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Pinned ref/version: `19.2.17`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: @types/react`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Other DefinitelyTyped packages, upstream brands, documentation, examples, and unverified assets

<!-- OSS:types-react-dom-19.2.3 -->
## Type definitions for React DOM 19.2.3

- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Pinned ref/version: `19.2.3`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: @types/react-dom`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Other DefinitelyTyped packages, upstream brands, documentation, examples, and unverified assets

<!-- OSS:typescript-5.9.3 -->
## TypeScript

- Source: https://github.com/microsoft/TypeScript
- Pinned ref/version: `5.9.3`
- License: `Apache-2.0`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: typescript`
  - `discover/package.json: typescript`
- Evidence checked:
  - Backend/discover lockfiles and installed LICENSE.txt/ThirdPartyNoticeText.txt
- Required actions:
  - Preserve LICENSE.txt and ThirdPartyNoticeText.txt with distributed copies where required
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:vitest-3.2.7 -->
## Vitest 3.2.7

- Source: https://github.com/vitest-dev/vitest
- Pinned ref/version: `3.2.7`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: vitest`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE.md
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:vitest-4.1.10 -->
## Vitest 4.1.10

- Source: https://github.com/vitest-dev/vitest
- Pinned ref/version: `4.1.10`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `package.json: vitest`
  - `discover/package.json: vitest`
- Evidence checked:
  - Root/discover lockfiles and installed package manifests/LICENSE.md
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:zod-3.25.76 -->
## Zod 3.25.76

- Source: https://github.com/colinhacks/zod
- Pinned ref/version: `3.25.76`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `backend/package.json: zod`
- Evidence checked:
  - Backend lockfile and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:zod-4.4.3 -->
## Zod 4.4.3

- Source: https://github.com/colinhacks/zod
- Pinned ref/version: `4.4.3`
- License: `MIT`
- Status: `PASS`
- Planned/use mode: dependency
- Checked on: 2026-08-12
- Scope incorporated:
  - `discover/package.json: zod`
- Evidence checked:
  - discover/package-lock.json and installed package manifest/LICENSE
- Required actions:
  - Preserve the applicable MIT copyright and license text in distributed copies
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, and unverified assets

<!-- OSS:nexttutor-aditya-gupta-me -->
## NextTutor (aditya-gupta-me)

- Source: https://github.com/aditya-gupta-me/nexttutor
- Pinned ref/version: branch `main` ref at `/tmp/audit/nexttutor/LICENSE` (Copyright (c) 2026 Aditya Gupta)
- License: `MIT`
- Status: `PASS`
- Planned/use mode: study + adapt (no direct file copy)
- Checked on: 2026-09-02
- Scope incorporated:
  - `discover/src/components/rating-stars.tsx` — shared rating-stars component reimplemented from the inlined-stars pattern in `ReviewsList.tsx`
  - Replaced inline star rendering at four Tutoria call sites (tutor profile reviews, tutor browse cards, center dashboard rating tile, bookings review modal preview)
- Evidence checked:
  - Root LICENSE confirms MIT (Copyright (c) 2026 Aditya Gupta)
- Required actions:
  - Preserve the MIT copyright notice shown above when redistributing the adapted component
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, marketplace service, hosted content, and any non-MIT assets

<!-- OSS:tutorhub-tise-genene -->
## TutorHub (tise-genene)

- Source: https://github.com/tise-genene/tutorhub
- Pinned ref/version: repository head (© 2025 Tise Genene)
- License: `MIT`
- Status: `PASS`
- Planned/use mode: study + adapt (no direct file copy)
- Checked on: 2026-09-02
- Scope incorporated:
  - Pattern reference for the Tutoria `bookings` lifecycle and RPC shape only; Tutoria reimplemented its own RPCs and SQL
- Evidence checked:
  - Repository LICENSE at `tutorhub` head confirms MIT
- Required actions:
  - Preserve the MIT copyright notice shown above when redistributing adapted material
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and any non-MIT assets

<!-- OSS:upspace-ivanreeve -->
## UpSpace (ivanreeve)

- Source: https://github.com/ivanreeve/upspace
- Pinned ref/version: branch `main` ref at `/tmp/audit/upspace/LICENSE.md` (Copyright (c) 2025 UpSpace)
- License: `MIT`
- Status: `PASS`
- Planned/use mode: study + adapt (no direct file copy)
- Checked on: 2026-09-02
- Scope incorporated:
  - Marketplace shell layout pattern (rate limiting, wallet/payout flow, AI assistant hooks, OpenAPI docs) — referenced only; Tutoria implementation is independent
- Evidence checked:
  - `LICENSE.md` confirms MIT (Copyright (c) 2025 UpSpace)
- Required actions:
  - Preserve the MIT copyright notice shown above when redistributing adapted material
- Excluded material:
  - Upstream brands, trademarks, documentation, examples, hosted services, and any non-MIT assets

<!-- OSS:bookbarber-anas-baigg-pattern-only -->
## BookBarber (Anas-Baigg) — pattern reference only

- Source: https://github.com/Anas-Baigg/bookbarber
- Pinned ref/version: repository head
- License: `None declared` (no LICENSE file in repository)
- Status: `STUDY_ONLY`
- Planned/use mode: study + adapt (no direct file copy)
- Checked on: 2026-09-02
- Scope incorporated:
  - Pattern reference for the EXCLUDE USING gist no-double-booking constraint, reimplemented Tutoria-native in `20260911000020_bookings_no_overlap_constraint.sql`. The pattern is generic PostgreSQL functionality (btree_gist + gist exclusion) and the migration is written from scratch against Tutoria's `public.sessions` schema; no BookBarber source was copied.
- Evidence checked:
  - BookBarber repository head has no LICENSE file
- Required actions:
  - Do not redistribute BookBarber source. Attribution is provided for the design pattern only.
- Excluded material:
  - All BookBarber source, brands, trademarks, documentation, examples, and hosted content
