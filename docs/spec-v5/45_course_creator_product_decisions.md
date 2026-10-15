# 45 — COURSE CREATOR PRODUCT DECISION MATRIX (CC-PD)

**Status:** DECISION MATRIX — all items UNRESOLVED except the already-decided inputs in §0. No selections made in this document.
**Sources:** browser functional audit of `preview-24-finished-4.html` (97 controls; skill `tutoria-browser-debugging`, audit mode); UX spec `43_uiux_course_creator.md`; disposition `44_course_creator_disposition.md`; comparable-product research (Udemy instructor docs, September 2026) cited per item.
**How to use:** resolve each PD item (founder/product), record the selection + date in the Status line, then unblock the listed implementation work. Do not implement against UNRESOLVED items.

## §0. Already-decided inputs (from the approved UI/UX brief — not open questions)

- Four curriculum item types only: Lecture, Quiz, Practice Test, Assignment. Label is `Practice Test`, never `Practice`.
- Pricing is course-level; no section-level pricing.
- No bulk-coupon CSV. No AI video evaluation. Preview simulates learner view only: no payment, no real enrollment.
- Local/mock state is acceptable in prototype; prototype JS never migrates to production.
- Curriculum flows as verified stay as the interaction baseline (no rewrite).
- Per-section redundant Save buttons go away in favor of one global save pipeline.

## PD-01 — Course Settings gear scope
- **Controls:** topbar settings gear (dead). **Current:** nothing happens.
- **Question:** what lives in Course Settings vs. the sidebar pages?
- **Option A — Minimal:** slug, visibility/publishing state, learner access (enrolled-only vs public), danger zone (delete draft). Title/description/cover/language stay on their sidebar pages.
- **Option B — Aggregated:** A plus duplicates of title, language, category, price for "one place to see everything."
- **Tradeoffs:** A keeps single-source-of-truth per field (fewer sync bugs, less UI); B is convenient but creates two editors for the same fields and drift risk. Comparable: Udemy puts eligibility/subscription exclusion behind the course-settings gear, not core content fields (support.udemy.com, instructor promotional agreements article).
- **Status:** UNRESOLVED. **Blocks:** gear implementation (F11).

## PD-02 — Creator notes persistence
- **Controls:** course-structure outline textarea (static). **Current:** typed text goes nowhere.
- **Question:** where do private creator notes live?
- **Option A — Local-only:** browser localStorage, per-course key, clearly badged Private. Zero backend work; notes don't follow the creator across devices.
- **Option B — New `courses.plan_notes`-style column:** follows the creator, needs migration + PATCH extension + privacy review (must never leak into learner-facing payloads).
- **Tradeoffs:** A is free and matches "prototype" framing but loses data on device change; B is durable but expands the Course API surface for non-learner content.
- **Status:** UNRESOLVED. **Blocks:** structure page binding (F2).

## PD-03 — Setup checklist semantics
- **Controls:** 4 setup checkboxes (static); test-video submit state. **Current:** no binding, no meaning.
- **Question:** are setup checks self-certification, and do they persist?
- **Option A — UI-only self-certification:** checks live in draft/local state, feed the readiness checklist display only.
- **Option B — Persisted attestations:** stored per course, reviewable during quality review as claimed-vs-verified.
- **Tradeoffs:** A is simple and matches an optional page; B gives review signal but invites gaming (self-attested quality claims) unless verified.
- **Status:** UNRESOLVED. **Blocks:** setup page binding (F10).

## PD-04 — Media upload architecture
- **Controls:** test-video file, cover/promo file buttons, lecture video/slides pickers, resource file pickers, caption VTT/SRT uploads (14 controls; native dialogs untested headless).
- **Question:** how do files get from creator browser to durable storage?
- **Option A — Direct-to-Supabase-Storage upload + signed serve:** mirrors the existing signed-video/signed-resource GET pattern; needs buckets, policies, and a POST path (currently only signed GETs exist).
- **Option B — Backend-proxied upload:** backend accepts multipart, stores, returns URL; simpler auth story, more backend load and timeout handling.
- **Tradeoffs:** A scales better for large video and matches current serve pattern; B centralizes validation (5MB caption cap, video type checks) but makes the API a file pipe. Either way the 5MB caption constraint from `course_captions` and MP4/MOV + 720p minimums from the prototype need a home (client pre-check vs server enforce vs both).
- **Status:** UNRESOLVED. **Blocks:** F5 upload pipeline and every file control above.

## PD-05 — Quiz model
- **Controls:** quiz editor, Questions tab (verified working in prototype).
- **Question:** what is a Quiz (question types, attempts, scoring)?
- **Option A — Minimal check (prototype as-is):** multiple-choice only, untimed, per-answer explanation, final score; optional attempt limit setting.
- **Option B — Udemy-parity:** multiple-choice only, untimed, explanations per choice, final score, linkable related lecture (Udemy: "Quizzes… consist of multiple choice questions… link them to related lectures"; teach.udemy.com plan-your-practice-activities).
- **Option C — Extended:** add multi-select and/or fill-in-blank to quizzes.
- **Tradeoffs:** A/B are cheap and match the "check understanding mid-course" purpose; C blurs the quiz/practice-test boundary the prototype deliberately draws (spec 43 §4). Attempt-count setting exists in neither the prototype nor Udemy's quiz model — adding it is new scope either way.
- **Status:** UNRESOLVED. **Blocks:** quiz backend model (F7); quiz tables migration is currently disabled.

## PD-06 — Practice test model
- **Controls:** practice-test editor (verified working: time limit, passing score, questions).
- **Question:** which exam-simulation semantics ship in v1?
- **Comparable facts (Udemy):** MC + multi-select + fill-in-blank; timed; domain-aligned score reports; related lecture/material per question; limits of 2 per course / 6 per PT-only course; paid-courses-only; bulk CSV question import; per-choice and overall explanations (support.udemy.com 115008041788; teach.udemy.com instructor-guide-practice-tests).
- **Option A — Prototype subset:** MC-only questions, time limit, passing score, attempts setting, result preview.
- **Option B — Udemy subset:** A plus multi-select, per-question related material, domain tags for score reports.
- **Option C — Full parity:** B plus paid-only gating, per-course caps, CSV bulk import, AI-drafted explanations.
- **Tradeoffs:** A fits the verified prototype with no new concepts; B adds real exam-prep value at moderate cost; C imports policy machinery (paid gating, caps, AI review) far beyond v1. Note the brief's prototype already shows attempts + result preview, which Udemy's model doesn't name explicitly — keeping them is a Tutoria choice, not parity.
- **Status:** UNRESOLVED. **Blocks:** practice-test backend model (F7).

## PD-07 — Assignment model
- **Controls:** assignment editor (verified: instructions, tasks, submission type, guidance).
- **Question:** what does an Assignment contain and where does review happen?
- **Comparable facts (Udemy):** Basic Info (title/description/estimated duration) + Instructions (video or text) + Questions (≥1, max 12) + Solutions (answers, video explanation, resources) + Publish; instructor reviews answers and posts feedback via a dedicated Communication → Assignments surface; learners compare against solutions and get peer feedback (support.udemy.com 115008174307).
- **Option A — Prototype as-is:** instructions + tasks + submission type + guidance + instructor review/feedback/score area, no solutions bank, no duration estimate.
- **Option B — Udemy-parity:** A plus per-question solutions, estimated duration, and a dedicated instructor review queue surface.
- **Tradeoffs:** A is coherent for tutor-led courses with direct instructor review; B adds self-serve learner value (solutions) and scale (queue, peer feedback) at the cost of a second surface. The prototype's "tasks" vs Udemy's "questions (max 12)" is a naming/model fork to settle explicitly.
- **Status:** UNRESOLVED. **Blocks:** assignment backend model + any review surface (F7).

## PD-08 — Lesson resource/duration/settings payload
- **Controls:** resource cards/forms, duration field, Settings tab (verified working in prototype).
- **Question:** which lesson-level fields persist in v1?
- **Option A — Minimal:** title + type + video_url/text_content (today's backend) + duration string.
- **Option B — Prototype parity:** A plus ordered resources list, completion/published settings, per-item access flags.
- **Tradeoffs:** A ships sooner on the existing schema; B preserves the verified editor UX but needs new tables/columns and multiplies QA surface. `is_preview` already exists — its UI exposure is undecided either way.
- **Status:** UNRESOLVED. **Blocks:** lesson API extension (F7), resource attach-from-library (F5/F6 overlap).

## PD-09 — Section goal storage
- **Controls:** section goal line + edit form (verified working).
- **Question:** one nullable `goal` column on sections, or drop learner-facing goals from v1?
- **Tradeoffs:** a single text column is the cheapest schema change in this whole matrix; dropping it removes a learner-visible field the UX already demonstrates. No comparable-product tension.
- **Status:** UNRESOLVED (recommend treating as fast-track). **Blocks:** section edit parity (F3).

## PD-10 — Pricing model
- **Controls:** currency + price inputs, preview, per-section Save (to be removed).
- **Question:** free-form amount or tier matrix? What are the free-course rules? Who may charge?
- **Comparable facts (Udemy):** fixed global price-tier matrix (not custom amounts); list price vs backup price under the Deals Program; free courses ≤2h video, no Q&A/certificate; free→paid allowed once (repeat switching disables promotions); premium-instructor approval required to charge; mobile prices set by app-store matrices (support.udemy.com 229605668; teach.udemy.com price-your-course).
- **Option A — Custom VND amount (prototype as-is):** simple, matches Tutoria's direct pricing elsewhere; needs new `price_vnd`/`currency` columns.
- **Option B — Tier matrix:** marketplace consistency, local-currency mapping, Deals-style promotions later; heavy policy surface (tiers, backup price, free↔paid rules, premium-instructor equivalent).
- **Tradeoffs:** A is the smallest change and fits a tutor-led marketplace; B is the proven marketplace model but imports Udemy-scale policy machinery. Either way the free-course constraints and who-may-charge need explicit rules.
- **Status:** UNRESOLVED. **Blocks:** pricing persistence + preview honesty (F4).

## PD-11 — Coupon model
- **Controls:** coupon table, New coupon, remove, (bulk CSV removed per brief).
- **Question:** coupon types, code rules, lifecycle, copy semantics, limits.
- **Comparable facts (Udemy):** 4 types (best-price 5d, custom-price 31d, free-open 10 redemptions/5d, free-targeted 100/31d); max 3/month/course (free types 1/month); codes 6–20 chars UPPERCASE A-Z0-9.-_ unique per course; start date within current month (PST); **created coupons cannot be edited or deleted — only toggled on/off**; expired coupons become referral links (24h attribution); 97% instructor revenue share on coupon/referral sales (support.udemy.com pricing-coupons section).
- **Option A — Prototype fields as specified in brief:** code, percent/fixed, value, start/end dates, total + per-learner limits, active/inactive; copy duplicates config with mandatory new code.
- **Option B — Udemy-shaped:** A reshaped around best-price/custom/free types, monthly creation caps, and immutable-after-create with toggle-off instead of delete.
- **Tradeoffs:** A matches the brief and is simpler to reason about; B carries hard-won abuse learnings (immutability, caps, code format) but also Deals-program concepts Tutoria doesn't have. Per-learner limits and start dates have no Udemy equivalent in the research — they're Tutoria inventions needing fraud/edge-case thought either way.
- **Status:** UNRESOLVED. **Blocks:** coupon CRUD endpoints on the existing `course_coupons` table (F9).

## PD-12 — Referral/attribution program (business decision)
- **Controls:** referral-link Copy button (dead).
- **Question:** does Tutoria have instructor referral attribution with revenue share, or is the link decorative?
- **Comparable facts (Udemy):** every paid course has a referral link; 24h purchase attribution window; 97% net revenue on referred sales; referral links don't change displayed price (support.udemy.com 229603968).
- **Option A — No program:** link copies the plain course URL post-publish; no attribution, no share. Honest and trivial.
- **Option B — Attribution program:** 24h-style window, revenue-share rule, anti-gaming policy (Udemy bans coupons/links in DMs, discussions, landing pages, course materials — support.udemy.com 229605888).
- **Tradeoffs:** A avoids fake functionality (a copying button for a non-attributing "referral" link misleads); B is a revenue feature with fraud surface needing policy + bookkeeping. This is a business call, not a UX call.
- **Status:** UNRESOLVED. **Blocks:** promotions link row (F9/F11).

## PD-13 — Test-video feedback model
- **Controls:** upload → processing → playable + duration + thumbnail + success/fail (per brief).
- **Question:** who gives feedback — human reviewer, or self-serve checklist?
- **Comparable facts (Udemy):** free service, 1–3 min sample, reviewed by a named human expert, feedback email within ~2 business days, unlimited resubmissions, explicitly optional (support.udemy.com 229604128; teach.udemy.com check-your-quality-with-test-video).
- **Option A — Self-serve only:** technical validation (playable, duration, thumbnail, format) + setup checklist; no human loop.
- **Option B — Human review queue:** submit → status tracking → feedback thread, staffed by Tutoria team.
- **Tradeoffs:** A ships with the prototype and scales to zero staff; B matches the comparable and de-risks creator quality but commits operations headcount with SLA expectations (2-day turnaround norms). The brief already forbids AI evaluation, so "automated feedback" is off the table.
- **Status:** UNRESOLVED. **Blocks:** test-video submit/state design (F10).

## PD-14 — Description rich text scope
- **Controls:** B/I/bullet/number/link toolbar (dead).
- **Question:** plain textarea or restrained rich text?
- **Option A — Plain textarea + live word count:** drop the toolbar; zero renderer risk.
- **Option B — Restrained toolbar (brief's five controls):** needs a decided storage format (markdown vs HTML), a sanitizer (repo has `sanitize.ts` for posts — verify fit), and a learner-side renderer.
- **Tradeoffs:** A is honest and sufficient; B improves landing quality expression but each control (especially Link) adds abuse surface (external links are already banned from descriptions in the prototype copy).
- **Status:** UNRESOLVED. **Blocks:** landing description editor (F2).

## PD-15 — Topics taxonomy ownership
- **Controls:** category select, topic pills, propose+Add (dead).
- **Question:** who owns the controlled topic list, and how does search work?
- **Option A — Static curated list:** product-owned taxonomy file; search filters it; max 4 chips.
- **Option B — Backend taxonomy service:** dynamic list with admin curation, usage counts, synonyms.
- **Tradeoffs:** A matches "no arbitrary creator categories" with near-zero cost but goes stale; B stays fresh but is a whole admin surface. Either way the "propose another topic" free-text path must go (it contradicts the controlled-taxonomy requirement).
- **Status:** UNRESOLVED. **Blocks:** topics UI (F2).

## PD-16 — Review lifecycle and gating
- **Controls:** checklist rows, identity/terms checkboxes, course URL, Submit (dead); review states beyond Draft unbuilt.
- **Question:** who reviews, what locks, what identity proof is required?
- **Comparable facts (Udemy):** all required sidebar items must complete or submit shows an outstanding-items popup with deep links; identity verification mandatory for all instructors at submit; unique URL rules (letters/numbers/underscores/hyphens); review team returns needed-vs-recommended fixes; approval goes live (support.udemy.com 229604268).
- **Option A — Checklist-gated self-submit + manual review queue:** submit requires complete checklist + identity + terms + URL; status Draft→Under Review→Approved/Changes Requested→Published with editing locks per state.
- **Option B — Automated pre-checks + manual review:** A plus machine-checkable gates (video present, ≥5 lectures, description length) enforced before human eyes.
- **Tradeoffs:** A is the comparable baseline; B reduces reviewer load but needs the checks built and kept in sync with the checklist UI. Identity verification has no confirmed repo implementation — verify or scope it. `review_status`/`review_submitted_at` columns already exist.
- **Status:** UNRESOLVED. **Blocks:** submit endpoint, checklist engine, lifecycle UI (F4).

## PD-17 — Preview scope
- **Controls:** topbar Preview (dead).
- **Question:** exactly what does the learner simulation include?
- **Option A — Read-only walkthrough:** hero + what-you'll-learn + curriculum outline + instructor block + pricing display; no enrollment, no payment, no Q&A/interactive elements.
- **Option B — Interactive sandbox:** A plus playable lecture samples, quiz attempt simulation, progress mock.
- **Tradeoffs:** A satisfies "simulate the learner-facing experience" cheaply and can't be confused with real enrollment; B is more convincing but risks prototype-grade interactivity leaking into production expectations. Either way a persistent "Back to Creator" affordance is required.
- **Status:** UNRESOLVED. **Blocks:** Preview surface (F11).

## PD-18 — Dirty-guard policy
- **Controls:** page navigation, tab switches, editor close, footer Previous/Next.
- **Question:** warn-and-confirm or silent autosave on every exit path?
- **Option A — Autosave everywhere:** debounced draft persistence already exists in the native creator; extend to all editors, no dialogs.
- **Option B — Warn on unsaved changes:** explicit dirty tracking with a confirm dialog on navigation away.
- **Tradeoffs:** A is the modern-creator-tool feel the brief asks for but needs conflict/loss handling (slow networks, two tabs); B is explicit but dialog-heavy. The prototype preserves drafts on tab switch already — the policy must cover the remaining exits uniformly.
- **Status:** UNRESOLVED. **Blocks:** F1 backbone completion.

## PD-19 — Bulk uploader / asset library scope
- **Controls:** Bulk uploader button (dead); library CSS exists with no UI.
- **Question:** is batch upload + library in v1, and what attaches where?
- **Option A — In v1:** dropzone modal (empty/selecting/uploading/success/failure+retry per brief) + library (search/type-filter/select) + attach points in lecture video block and resource forms.
- **Option B — Deferred:** remove the button; single-file pickers only; library returns as its own feature.
- **Tradeoffs:** A is the brief's largest single scope item (upload states × library × attach points) and depends on PD-04; B keeps v1 shippable while lecture/resource pickers still need PD-04 anyway. Note Udemy also offers CSV bulk import for practice-test questions — explicitly out of scope here only if the decision says so.
- **Status:** UNRESOLVED. **Blocks:** bulk button + library + attach UX (F5/F11).

## PD-20 — Message content rules
- **Controls:** welcome/congratulations textareas + preview tabs (tabs dead).
- **Question:** are there enforceable content rules, and are messages editable post-publish?
- **Comparable facts (Udemy):** prompted pre-submit; welcome on enroll, congratulations on completion; must include course name; no promoting other courses/external resources; not personalized with learner names (teach.udemy.com set-up-automatic-messages-to-students).
- **Option A — Adopt the comparable rules verbatim** (course-name required, promo/external ban, no learner-name personalization).
- **Option B — Tutoria-specific policy** (e.g., allow cross-promotion within own catalog, Vietnamese-language guidance).
- **Tradeoffs:** A is proven and matches the prototype's existing warning copy; B needs policy writing and enforcement design (automated checks vs review-time). Post-publish editability is a separate small call either way.
- **Status:** UNRESOLVED. **Blocks:** messages binding + tabs (F8).

## PD-21 — Global save semantics (recorded direction, confirm details)
- **Controls:** topbar Save, footer Save, footer Save & continue, per-section pricing Save (REMOVE per disposition), editor-internal saves (keep — scoped purpose).
- **Direction already set:** one global pipeline (autosave + explicit Save), `Saving…/Saved/Save failed` states, failure surfaced on validation errors with field highlighting. No open product question except PD-18's warn-vs-autosave policy, which governs the same pipeline.
- **Status:** DIRECTION SET, pending PD-18. **Blocks:** F1.

## Appendix — Audit-to-decision traceability
Shell (7 controls) → PD-01, PD-17, PD-21 · Intended learners (4) → bindings decided IMPLEMENT, no open PD · Structure (2) → PD-02, REMOVE outline · Test video (6) → PD-04, PD-13, PD-03 · Film/edit (5) → none (external links correct) · Curriculum (verified) → PD-09, PD-05/06/07/08, PD-19 · Captions (11) → PD-04 + endpoints · Accessibility (bound) → no open PD beyond PATCH extension · Landing (12) → PD-14, PD-15, PATCH extension · Pricing (4) → PD-10, PD-21 · Promotions (5) → PD-11, PD-12 · Messages (3) → PD-20 · Review (8) → PD-16 · Cross-cutting → PD-18, PD-04.
