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
