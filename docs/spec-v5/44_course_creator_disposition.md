# 44 — COURSE CREATOR CONTROL DISPOSITION MATRIX (CC-DISP)

**Status:** PLANNING — no production code changes authorized.
**Source of truth:** browser functional audit of `preview-24-finished-4.html` (97 controls, 0 console errors; skill `tutoria-browser-debugging`, audit mode). UX target: `43_uiux_course_creator.md`.
**Rule applied:** no functionality invented solely because a button exists. Unclear product behavior → PRODUCT DECISION, not arbitrary implementation.
**Curriculum note:** prototype curriculum flows are browser-verified (Tests A–F). The native `course-creator/pages/curriculum-page.tsx` is the implementation vehicle — upgrade it to spec 43, do NOT rewrite or duplicate it.

Classifications: IMPLEMENT (required production functionality) · EMPTY/PLACEHOLDER (UI stays, needs intentional state) · REMOVE (prototype-only, must not ship) · DISABLED (keep disabled, state prevents action) · WORKING (no work needed). PRODUCT DECISION flags where the behavior itself is undefined.

---

## A. Shell (topbar / sidebar / footer)

| Page | Control | Current behavior | Class | Expected production behavior | Data/API dependency | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|---|
| shell | Back chevron (`data-back-courses`) | dead | IMPLEMENT | Return to creator's course list | `GET /api/v1/courses/mine` (exists) | P1 | partial (route exists, no creator list UI verified) | Next router + backend list |
| shell | Preview (`data-preview`) | dead | IMPLEMENT | Learner-view preview of draft | course + sections/lessons payload | P1 | partial (video-player primitive only, not a preview surface) | `course-player/video-player` for media playback inside a new preview surface |
| shell | Settings gear (`data-course-settings`) | dead | PRODUCT DECISION | Scope undefined (slug? visibility? danger-zone delete?). Do not invent. | TBD by decision | P2 | — | — |
| shell | Save, topbar (`data-save`) | dead | IMPLEMENT | Explicit save → same pipeline as autosave; drives `SaveStatus` | existing draft autosave in `course-creator-page.tsx` | P0 | yes (performSave + shell `SaveStatus`) | reuse both |
| shell | Previous, footer (`data-prev-page`, disabled) | disabled on first page | DISABLED | Keep; enable on pages 2+ in `NAV_PAGES` order | none (client nav) | P0 | yes (`onPrev` prop exists in shell) | reuse shell |
| shell | Save, footer (`data-save`) | dead | IMPLEMENT | Same as topbar Save (single pipeline, two affordances) | same as topbar Save | P0 | yes | reuse |
| shell | Save & continue (`data-next-page`) | dead | IMPLEMENT | Save, then advance in `NAV_PAGES` order | same + nav order | P0 | yes (`onNext` prop exists) | reuse shell |

## B. Plan — Intended learners

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Add more ×3 (`data-add-array`: outcomes/prereqs/audiences) | dead | IMPLEMENT | Append editable row (list-field pattern) | parity cols `what_you_will_learn`, `requirements`, `who_is_this_for` (+`intended_learners`) exist; PATCH needs extension (title/slug/desc/cover only today) | P0 | partial (cols, no API) | extend `coursePatchSchema` + `updateBackendCourse` |
| Remove-row ×6 (`data-remove-array`, disabled) | disabled | DISABLED | Keep min-count guard; enable above minimum (4 outcomes required) | same | P0 | — | new (1 rule) |
| Outcome/req/audience text inputs | static, no binding | IMPLEMENT | Bind to draft + autosave | same | P0 | partial | draft pipeline |

## C. Plan — Course structure

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Download outline (`data-download-outline`) | dead | REMOVE | No product requirement evidenced; outline export is invented scope. Reintroduce only on explicit request. | none | P2 | — | — |
| Private outline textarea (`structureNotes`) | static | PRODUCT DECISION | Private planning notes: persist where? No backend column. Options: local-only draft vs new `courses.plan_notes` column. | DECISION | P1 | — | — |

## D. Plan — Setup & test video

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Choose file + hidden input | untested (native dialog) | IMPLEMENT | Upload test video | `test_video_url` parity col exists; NO upload endpoint (only signed GETs exist) → storage upload path is an ARCH DECISION (likely Supabase Storage direct + signed serve) | P1 | partial | `signed-video` serve pattern |
| Submit test (`Submitted`, disabled) | static submitted-state | DISABLED + PRODUCT DECISION | Keep state machine (none → submitted); the *submit action* is IMPLEMENT P1, but the prototype's hardcoded "Video feedback: pass" implies a review flow that doesn't exist → feedback model needs a decision (mentor review vs self-certification) | `test_video_url`; no status/feedback columns | P1 | partial | — |
| Setup checklist ×4 | static | IMPLEMENT (bind) | Self-certification checklist | NO columns → recommend UI-only (local/draft), or add columns (decision, same as C notes) | P1 | — | draft pipeline |

## E. Create — Film & edit

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| 4 resource links | external `<a target=_blank>` (correctly unclicked) | WORKING | Keep as external guidance links; verify hrefs at build | none | P2 | — | — |
| Review your test video | navigates to setup-test-video | WORKING | Keep deep link | none | — | pattern exists | shell nav |

## F. Create — Curriculum (all verified working in prototype)

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| + Section / edit / delete+modal, 4-type add menu, row select, editor tabs/save, add/remove question/resource/task, item drag-reorder | working (Tests A–F) | WORKING | Upgrade native `curriculum-page.tsx` to spec 43 in place. **Do not rewrite, do not duplicate.** | sections/lessons CRUD + reorder APIs exist; see gaps below | P0 (upgrade, not rewrite) | yes (both prototype-verified UX and native page) | native page + backend CRUD |
| Bulk uploader (`data-open-bulk`) | dead | PRODUCT DECISION | Bulk video upload + media library + "Add from library" is a major feature with no repo support (no library model, no upload pipeline). Scope decision required before any design. | new (library + uploads) | P2 | — | upload decision (§H) |
| Section drag grips | dead visual affordance | REMOVE (v1) | Grip implies reorder that doesn't exist — must not ship. NOTE: `reorderBackendSections` API already exists, so section reorder is a cheap P2 follow-up, not new architecture. | reorder API exists | P2 | partial | `reorderBackendSections` |
| Row eye/chevron (stripped at runtime) | removed by `prepareRows` | REMOVE | Spec 43 decided Edit + delete only; topbar Preview covers learner view. Delete dead markup at build. | none | P2 | — | — |

## G. Create — Captions

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Add language / Disable / All / Uncaptioned filter | dead | IMPLEMENT | Caption manager per lesson+language | `course_captions` table + RLS EXIST; **zero API routes** → new list/create/delete endpoints + vtt/srt upload (≤5MB per table check) | P1 | partial (table, no API) | `signed-resource` serve pattern |
| Row Upload ×4 (+ hidden inputs) | untested | IMPLEMENT | Same upload flow as above | same | P1 | partial | same |
| Row menu ×4 (disabled) | disabled | DISABLED | Enable when a captioned file exists for that row | same | P1 | — | — |
| Language select | static | IMPLEMENT (bind) | Drives caption table scope | same | P1 | — | — |

## H. Create — Accessibility

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Claim toggles + item checkboxes | static, no binding | IMPLEMENT (bind) | Claims persist; item checks are UI-only checklist driving the claim | `accessibility_*_claimed` parity cols EXIST; item-level checks have NO columns → recommend UI-only (no decision needed if claims are the persisted unit) | P1 | partial | extend PATCH |

## I. Publish — Landing page

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Format B/I/•/1. (`data-format-description`) | dead | PRODUCT DECISION | Textarea cannot render rich text and no renderer exists in repo. Default recommendation: REMOVE toolbar for v1 (plain textarea + word count); rich text only with a decided renderer. | DECISION | P1 | — | `sanitize.ts` only if rich text chosen |
| Remove topic ×3 / Add topic | dead | IMPLEMENT | Topics array, max 4 (review requires topics) | `topics text[]` parity col EXISTS; PATCH needs extension | P0 | partial | extend PATCH |
| Char/word counts | static | IMPLEMENT | Live counts, pure client | none | P1 | — | new (trivial) |
| Cover / promo file buttons | untested | IMPLEMENT | Upload → `cover_url` (PATCH already accepts ✓) / `promo_video_url` (parity col exists, PATCH needs extension). Cover is publish-required. | upload decision (§H) + PATCH ext | P0 | partial | upload decision |
| Title/subtitle/desc/language/level/category/subcategory inputs | static | IMPLEMENT (bind + autosave) | Draft binding | parity cols EXIST (title/desc/cover in PATCH; rest need extension) | P0 | partial | draft pipeline + PATCH ext |

## J. Publish — Pricing

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| "When will this price be shown?" (`data-price-help`) | dead | IMPLEMENT (P2 help disclosure) | Explainer popover using on-page tier-policy copy | none | P2 | copy exists in prototype | new (trivial) |
| Per-section Save (`data-save-pricing`) | dead | REMOVE | Redundant with autosave + footer Save (spec §10 item 8). One save pipeline only. | — | P0 (as removal) | — | footer Save |
| Currency + price inputs | static | IMPLEMENT (bind) | Draft binding | **NO price columns on `courses`** (price only maps to offerings at publish). Persistence needs DECISION: add `price_vnd`/`currency` columns vs draft-only until publish. UI is P0 regardless. | P0 | none | DECISION first |

## K. Publish — Promotions

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Bulk coupon CSV (`data-bulk-coupon`) | dead | REMOVE | Bulk import is invented scope; single-coupon CRUD covers v1. | — | P2 | — | — |
| Copy referral link (`data-copy-link`) | dead | PRODUCT DECISION | Prototype hardcodes a `?ref=instructor` URL but **no attribution pipeline exists in repo** — a copying button would ship fake functionality. Decide: referral program (business) or drop link to plain course URL post-publish. | DECISION (business) | P2 | — | — |
| New coupon (`data-add-coupon`) | dead | IMPLEMENT | Coupon CRUD modal (code/type/value/expiry/limit) | `course_coupons` table + RLS EXIST; **zero API routes** → new creator-scoped CRUD endpoints | P1 | partial (table, no API) | new endpoints |
| Remove coupon (untested, destructive) | skipped | IMPLEMENT | Delete with confirm (part of coupon CRUD) | same | P1 | partial | ConfirmModal (§H) |

## L. Publish — Course messages

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Welcome/Completion preview tabs | dead | IMPLEMENT | Client-only tab switch of preview bubble | none | P2 | — | new (trivial) |
| Welcome/congratulations textareas | static | IMPLEMENT (bind) | Draft binding | `welcome_message`, `completion_message` parity cols EXIST; PATCH needs extension | P1 | partial | draft pipeline |

## M. Publish — Submit for review

| Control | Current | Class | Expected | Data/API | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|---|
| Review ×4 / Fix ×1 deep links | navigate correctly | WORKING | Keep pattern natively | none | — | pattern exists | shell nav |
| Checklist rows (88%, 7/8 hardcoded) | static | IMPLEMENT | Compute from single completeness-rules source (CC-UX-038) driving dots + sidebar rings + this list | rules engine (new, client) + course state | P0 | — | new |
| Identity/terms checkboxes, course URL input | static | IMPLEMENT (bind; checkboxes gate submit) | Draft binding | `review_status`, `review_submitted_at` parity cols EXIST; `slug` in PATCH ✓. Identity-verification flow itself: verify what repo has or mark DECISION. | P0 | partial | PATCH ext |
| Submit for review (`data-submit-review`) | dead | IMPLEMENT | Submit → `review_status='pending'` (+ editing-lock policy per decision) | parity cols ✓; **new backend action** (`publishBackendCourse` exists but is publish, not review-submit) | P0 | partial | new endpoint |

## N. Cross-cutting (from audit + spec §10)

| Item | Class | Expected | Dependency | Pri | In repo? | Reuse |
|---|---|---|---|---|---|---|
| Toast system (style only, no logic) | IMPLEMENT | Minimal toast (save confirmations, copy, coupon actions) | none | P1 | none | new (tiny) |
| ConfirmModal (prototype JS only) | IMPLEMENT | Native modal for section-with-items + coupon delete | none | P1 | none (`ui/` has button/input/card only) | new; extend `ui/` |
| Dirty-guard navigation | IMPLEMENT | Warn-or-autosave on nav/select/close with unsaved editor text | draft pipeline | P1 | partial (autosave exists; guard missing) | extend creator page |
| File upload pipeline (video/cover/promo/vtt/test-video) | IMPLEMENT | ARCH DECISION: likely Supabase Storage direct upload + signed serve (mirrors existing signed-video/signed-resource GETs) | storage buckets + new POST path | P0 | partial (signed serve only) | signed-URL serve pattern |
| Quiz questions model | PRODUCT DECISION + backend gap | Lesson `quiz` type exists but **questions migration is disabled** (`_disabled/...course_quizzes_tables.sql`); no question CRUD. Decide schema, then API. | DECISION → new tables + API | P0 | none active | — |
| Assignment + Practice Test lesson types | PRODUCT DECISION + backend gap | `lesson_type` enum is video/text/quiz/resource only. Decide: extend enum + per-type payload (tasks, timeLimit, passingScore, settings) vs phase them. | DECISION → enum + API | P0 | none | — |
| Lesson resources list, duration, per-item settings/publish | PRODUCT DECISION + backend gap | No columns/relations for these. Decide minimal v1 lesson payload vs full prototype parity. | DECISION → API | P0 | none | — |
| Section goal | PRODUCT DECISION | No `goal` column on sections. Add column (trivial) or drop goal from v1 UI. | DECISION (1 column) | P1 | none | — |
| Structure notes, setup checklist persistence | PRODUCT DECISION | No columns. Recommend local-only draft vs new columns. | DECISION | P2 | — | — |

---

## 1. Duplicates already implemented — reuse, do not rebuild

1. **Native creator shell + 12 pages + autosave + publish.** `course-creator-shell.tsx` (`NAV_PAGES` mirrors the prototype 1:1, `SaveStatus`, `onSave/onPrev/onNext/onPreview` props) + `course-creator-page.tsx` (debounced autosave draft, backend hydration, `publishBackendCourse`). This IS the Next.js vehicle — the prototype must never become a second implementation.
2. **Backend course platform.** `backend/src/routes/courses.ts`: course/section/lesson CRUD, `reorderBackendSections/Lessons`, publish/unpublish, progress, enrollments, `signed-video`/`signed-resource`. Extend schemas; don't fork routes.
3. **Persistence waiting for APIs.** `course_coupons` + `course_captions` tables with RLS; landing/messages/learners/accessibility/review/test-video parity columns. All need API exposure, none need re-modeling (except flagged gaps).
4. **UI primitives.** `components/ui/{button,input,card}`, `rating-stars`, shared booking cards. New modal/toast/dirty-guard go here, not in page code.
5. **Learner playback.** `components/course-player/video-player` is an HLS video primitive reusable for media playback inside Preview — it is not a preview surface, so Preview still needs a new container.
6. **Negative-duplicate guard.** `messaging-api`/notifications are a different domain (inbox/push) — NOT course welcome/completion messages. `tutor-workshop-booking-api` is NOT curriculum items. The simpler native `curriculum-page.tsx` gets upgraded to spec 43 — it is not a competing implementation to keep alongside anything.

## 2. Shared components/APIs to reuse or create

- **Reuse:** shell + `NAV_PAGES` + `SaveStatus`, draft autosave pipeline, backend courses CRUD/reorder/publish/signed-serve, parity columns, coupon/caption tables, `ui/*` primitives, course-player video primitive (media playback only).
- **Create (new, small):** `ConfirmModal` + `Toast` in `ui/`; dirty-guard hook in creator page; coupon CRUD endpoints; caption CRUD + vtt/srt upload endpoints; PATCH-schema extensions (landing/topics/messages/accessibility/review); quiz/assignment/practice payload endpoints (post-decision); storage upload path (post-decision); completeness-rules module (client, single source for dots/rings/checklist).

## 3. Work grouped by feature (not by button)

- **F1 — Save/nav backbone (P0):** topbar+footer Save, Save & continue, Previous enablement, dirty guard, toast. (Controls: 4 shell saves/nav + N1.)
- **F2 — Landing & plan bindings (P0):** landing fields + topics + counts; learner rows + min-guard; structure-notes decision. (Controls: ~15.)
- **F3 — Curriculum native upgrade (P0):** spec-43 parity in native page (4 types, tabs, save/delete, modal, empty states) WITHOUT rewrite. Backend: section-goal decision + lesson-payload decisions (F7).
- **F4 — Pricing + review submit (P0):** price bind + price-persistence decision; checklist engine; identity/terms/URL bind; submit→pending endpoint. (Controls: ~8.)
- **F5 — Upload pipeline (P0, arch decision first):** one path serving cover/promo/lecture-video/slides/vtt/test-video. (Controls: ~8 file buttons.)
- **F6 — Captions manager (P1):** table UI + CRUD/upload API on existing table. (Controls: ~10.)
- **F7 — Lesson capability models (P0 decisions → P0/P1 build):** questions, assignment/practice types, resources, duration/settings. Biggest backend gap; gates curriculum parity.
- **F8 — Messages + accessibility binds (P1).** (Controls: ~8.)
- **F9 — Coupons (P1):** CRUD modal + endpoints on existing table; copy-link and bulk stay out pending decisions. (Controls: 2 in, 2 out.)
- **F10 — Test video + setup checklist (P1):** upload + submit-state + feedback-model decision. (Controls: ~6.)
- **F11 — Polish/placeholder tier (P2):** settings-gear verdict, help popover, message tabs, referral decision, outline/bulk removals, section-reorder re-add, external-link verification.

## 4. Implementation order (Next.js)

1. **Decisions first (blockers):** settings-gear scope; structure-notes/checklist persistence; upload architecture; quiz/assignment/practice lesson models; section-goal column; price persistence; referral program; test-video feedback model; rich-text verdict. (Nothing in F3–F7 builds cleanly without these.)
2. **F1 backbone** (save/nav/guard/toast/modal primitives) — everything else rides on it.
3. **F2 + F4 bindings + checklist engine** (landing/learners/pricing/review-submit; publish path starts working).
4. **F5 upload pipeline** (unblocks cover/video/file controls).
5. **F3 curriculum upgrade + F7 lesson models** (against decided schemas).
6. **F6 captions, F8 messages/accessibility, F10 test video** (parallelizable once F1+F5 land).
7. **F9 coupons** (table ready; needs endpoints + modal).
8. **F11 polish tier** + external-link verification + dead-code removals (per-section Save, bulk buttons, drag grips, eye/chevron remnants).
9. **Gate:** completeness-rules single source wired to dots + rings + checklist; zero dead buttons (every control re-audited with the skill before sign-off).
