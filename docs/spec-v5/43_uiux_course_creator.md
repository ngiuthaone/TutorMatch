# 43 — UI/UX SPEC: COURSE CREATOR (CC-UX)

**Status:** UI/UX SPECIFICATION — design phase. No production implementation authorized until this spec is approved.
**Reference:** standalone prototype `/Users/soshi/Downloads/preview-24-finished-4.html` (frozen visual/interaction reference).
**Non-goals (explicit):** backend integration, Supabase, API wiring, real persistence, production data models, authentication, migrating the prototype's JavaScript. This spec defines **UI/UX, layout, interactions, hierarchy, and flow only**.
**Prototype rule:** the reference file is **NOT part of the repository and MUST NOT be copied into production**. The native Next.js build re-implements this spec from scratch. Prototype JS (vanilla, localStorage) is throwaway; only the UX contract below survives.

---

## 1. Final page structure (CC-UX-001)

Single authenticated workspace, three fixed regions + one contextual region:

```
┌────────────────────────────────────────────────────────┐
│ Topbar (sticky, 70px): back · course title + save state │
│                        │ Preview · settings · Save      │
├──────────┬─────────────────────────────────────────────┤
│ Sidebar  │ Page wrap (max 1120px, padded)              │
│ (sticky, │  kicker → title → description               │
│ 286px)   │  page sections...                           │
│ Plan /   │                                             │
│ Create / ├─────────────────────────────────────────────┤
│ Publish  │ Curriculum only: two-column work area       │
│ nav      │  [sections+items column | sticky editor]    │
├──────────┴─────────────────────────────────────────────┤
│ Footer bar (fixed): Previous · save state │ Save ·     │
│                     Save & continue                 │
└────────────────────────────────────────────────────────┘
```

- **Topbar (CC-UX-002):** left = back-to-courses chevron + course title (truncated, max ~430px) + save-state line (`Saved` / `Saving…` / `Save failed — retry`, mono uppercase micro-label). Right = `Preview` (desktop only), settings gear (course-level settings surface), `Save`. Sticky, highest z below modals/menus.
- **Sidebar (CC-UX-003):** header block (`Course creation` + `TITLE · DRAFT` mono status), then three groups — **Plan** (Intended learners, Course structure, Setup & test video · optional), **Create** (Film & edit, Curriculum, Captions · optional, Accessibility · optional), **Publish** (Course landing page, Pricing, Promotions · optional, Course messages · optional, Submit for review). Each item = status ring (empty / done-check / dashed-optional) + label. Active item = filled pill. Exactly one page visible at a time; switching pages never loses in-memory edits (draft guard belongs to implementation; UX rule: no silent loss — dirty state blocks navigation with an explicit choice).
- **Page wrap (CC-UX-004):** header pattern on every page: mono kicker (`PLAN`/`CREATE`/`PUBLISH`), large title, one-paragraph description of what the page is for and what "done" means. Optional page-level action at header right (e.g. Bulk uploader on Curriculum, Download outline on Course structure).
- **Footer bar (CC-UX-005):** fixed. Left: `Previous` (disabled on first page) + save state. Right: `Save` (secondary) + `Save & continue` (primary, advances to next sidebar page in fixed order). Footer is the ONLY global save affordance besides topbar Save; per-panel save buttons (e.g. inside the curriculum item editor) save their own scope and must also update the global save state label.
- **Mobile (≤760px, CC-UX-006):** sidebar unmounts; a labeled `Course section` select (grouped optgroups, optional pages suffixed `· Optional`) replaces it. Topbar condenses (title max ~155px, Preview hidden). Footer keeps Previous + Save + Save & continue, save-state label hidden.

## 2. Component hierarchy (CC-UX-010)

```
CourseCreatorShell
├─ CreatorTopbar (BackButton, TitleBlock{title, SaveState}, PreviewBtn, SettingsBtn, SaveBtn)
├─ CreatorSidebar (SideSummary, NavGroup[Plan|Create|Publish] > CreatorNavItem*{status: empty|done|optional, active})
├─ MobileSectionSelect (visible ≤760px only)
├─ PageContainer (PageHeader{kicker, title, desc, action?}, sections...)
│  ├─ PlanPages: IntendedLearners / CourseStructure / SetupTestVideo
│  ├─ CreatePages: FilmEdit (guidance only) / CurriculumWorkbench / Captions / Accessibility
│  └─ PublishPages: LandingPage / Pricing / Promotions / CourseMessages / SubmitReview
├─ CurriculumWorkbench
│  ├─ SectionCard* (SectionHeader, ItemRow*, AddItemArea, EmptySectionState)
│  ├─ AddSectionButton / SectionEditorForm
│  └─ ItemEditorPanel (EditorHead, EditorTabs, EditorBody, EditorActions)
├─ CreatorFooter (PreviousBtn, SaveState, SaveBtn, SaveContinueBtn)
├─ ConfirmModal (destructive confirmations)
└─ Toast (transient confirmations; behavior-only contract — prototype has style, no logic)
```

Shared primitives (all pages): `Field` (label + input/textarea/select + help), `CheckCard`, `RadioCard`, `InfoBanner` (info/warning/danger/success), `Panel`, `CountLabel` (mono `37/60`, `101 words · 200 required`), `Pill/Badge`, `IconButton` (36px, tooltip via `title`).

## 3. Section/item interaction model (CC-UX-020)

- **SectionCard (CC-UX-021):** header = `Section N:` (auto-numbered, renumbers on add/remove) + file icon + title + optional goal line; actions (pencil / trash / drag-grip icon buttons). Body = item rows + `+ Curriculum item` trigger. New sections render immediately at the end (above `+ Section`), titled `New Section`, and **open directly in edit mode** with the title field focused — the creator never hunts for how to rename.
- **Section edit (CC-UX-022):** inline form replacing the header (title input + goal textarea + Cancel / Save section). Save with empty title falls back to `New Section`. Goal is optional; an empty goal removes the goal line (no dead whitespace).
- **Section delete (CC-UX-023):** empty section → deletes immediately. Section with items → `ConfirmModal`: `Delete section?` / `"TITLE" and its N items will be permanently removed.` / Cancel + `Delete section` (danger). No `prompt()`/`alert()` anywhere. After delete: rows, state, and any open editor for a contained item are cleared; sections renumber.
- **Empty section (CC-UX-024):** muted line — `No curriculum items yet. Use "Curriculum item" below to add the first one.` The `+ Curriculum item` trigger stays visible; the add control is never hidden inside an empty container.
- **ItemRow (CC-UX-025):** status dot (check = complete, `!` = needs content) + main select area (`TYPE N: title` + meta line: `file · min` for lectures, `Content complete` / `Add content to complete this item` otherwise) + `Edit` button + delete icon-button. Clicking row body OR Edit selects and opens the editor; selected row MUST carry a visible selected state (accent edge + tinted border — missing in prototype, required here, §10 item 3). Rows are drag-reorderable within and across sections (grab handle appears on hover; drop-before/after indicator line). Delete is one click, no confirm (consistent with question/resource/task deletes); deleting the open item closes the editor to the empty state.
- **Add-item menu (CC-UX-026):** `+ Curriculum item` opens a floating menu with EXACTLY four entries — **Lecture** (`Video or text lesson`), **Quiz** (`Knowledge check`), **Practice Test** (`Timed assessment`), **Assignment** (`Learner submission`). No other types; label must read `Practice Test`, never `Practice`. Selecting a type creates the item in that section, closes the menu, selects the item, and opens its editor on Content. Menu must flip/constrain to viewport and scroll internally (prototype can overflow the viewport bottom — must not ship).
- **Numbering:** `Section N` and `TYPE N` counters are positional (recomputed on render); they are labels, not identities.

## 4. Each content type's editor UX (CC-UX-030)

Right-hand sticky panel (`ItemEditorPanel`, 420px column, own scroll, sticky under topbar; stacks below the list on narrow screens). Head = kicker (type) + title + status subline + close ×. Tabs below head. Body per tab. Actions row (`Save changes` primary + transient `Saved just now` note; quiz/resources variants labeled `Save questions` / `Save resources` / `Save settings` — same behavior). Switching tabs preserves unsaved field values (draft sync on tab switch AND on save; re-render must never wipe typed input). Closing (×) or selecting another item preserves-or-explicitly-discards per the dirty-guard rule; never silently drops text.

- **Lecture — Content (CC-UX-031):** Title; Learning content (textarea); Lesson content type select (`Video` / `Video + slides` / `Article`) that swaps the media block: file-drop for video (+ slide deck when applicable) with `MP4 or MOV · prototype selection only`-style help, or article textarea; Duration (`e.g. 8 min`).
- **Lecture — Resources (CC-UX-032):** header (`Supporting resources` + description + `+ Add resource`); resource cards (icon, name, `type · access`, detail/file/link, optional description; Edit / Remove); resource form (type File/Link → name → URL *or* local file picker → description → access Downloadable/View only/Opens in a new tab; Cancel removes the draft form); `Save resources`.
- **Lecture — Settings (CC-UX-033):** Completion requirement select; Learner completion behavior select; Publishing state checkbox-card (`Published` + help); `Save settings`.
- **Quiz — Content (CC-UX-034):** Title + Learning content only (instructional preamble for the quiz).
- **Quiz — Questions (CC-UX-035):** question cards (`Question N` + Remove): question text; 2–4 answer rows (radio = mark correct + text input, `Answer A…` placeholders); Correct answer select (A–D mirror); Explanation textarea. `+ Add question`; empty quiz always retains one blank card (never zero). `Save questions`.
- **Quiz — Resources / Settings:** identical to CC-UX-032 / CC-UX-033.
- **Practice Test (CC-UX-036):** identical tab set to Quiz. **Content** additionally carries `Time limit (minutes)` (default 30) + `Passing score (%)` (default 70) in a two-column row above the description. Questions/Resources/Settings identical to Quiz.
- **Assignment — Content (CC-UX-037):** Title; Instructions textarea; Expected solution / submission guidance textarea; Submission type select (File upload / Text response / Link); task list (Task N + Remove; task description textarea; per-task submission select) + `+ Add task`. Resources / Settings identical to Lecture.
- **Completeness rule (CC-UX-038, new — prototype implies but never states):** status dot and `Content complete` meta derive from: Lecture = title + (video file or article text); Quiz/Practice Test = ≥1 question with non-empty text, ≥2 non-empty choices, valid correct index; Assignment = title + instructions + ≥1 non-empty task. Prototype seed data violates this (quiz marked complete with empty questions) — seed/demo content must satisfy the rule.

## 5. Navigation/tab behavior (CC-UX-040)

- Sidebar pages: exactly one visible; active pill; `nav-check` ring states (empty / done ✓ / dashed = optional). `done` must derive from the same completeness rules that gate Submit-for-review (single source of truth, not per-page guesses).
- Editor tabs: underline-accent active state; click switches body; Content is the landing tab on every select; tab switches preserve draft (see §4).
- Curriculum list ↔ editor linkage: selecting a row highlights the row AND opens the editor headed by that item's type+title; closing the editor clears the highlight; deleting the open item returns to the `Select a curriculum item` empty state (never a stale editor).
- Footer `Save & continue` advances in sidebar order; `Previous` goes back (disabled on first page). Mobile select mirrors sidebar order with `· Optional` suffixes.

## 6. Modal behavior (CC-UX-050)

- `ConfirmModal` (destructive only): centered overlay (dim backdrop, click-backdrop cancels), card with title + plain-language consequence + Cancel (secondary) + danger confirm labeled with the verb (`Delete section`). Used for section-with-items delete. Item/question/resource/task deletes stay one-click (no modal) per established pattern.
- No other modals in v1. Bulk uploader, course Preview, and course Settings are specified as *surfaces* (button placement reserved in header) but their contents are OUT of this phase — buttons must either open a defined coming-scope state or be omitted from v1; they must not be dead buttons in the shipped UI.
- Toast (behavioral contract, prototype has style only): bottom-center dark pill for transient confirmations (`Section deleted`, `Saved`). No action buttons; auto-dismiss.

## 7. Responsive behavior (CC-UX-060)

- **≤1050px:** sidebar narrows (286→230px); curriculum workbench collapses to single column, editor stacks below list, editor loses sticky/max-height.
- **≤760px:** sidebar unmounts → `Course section` select; topbar condenses; grids collapse to one column; item-row `Edit` button hides (row tap = select — must remain discoverable: whole row is the tap target); editor body padding shrinks; footer keeps three buttons, hides save-state text; pricing Save stacks full-width below the price preview (prototype overlaps them — must not ship); add-item menu becomes full-width inline (already correct).
- Editor max-height + internal scroll on desktop prevents page-length blowout with long question lists.

## 8. Visual system (CC-UX-070 — as rendered, charcoal theme)

- **Theme:** full-dark charcoal. Shell `#0d0d0f`; sidebar `#141517`; topbar near-black blur; section cards `#242427`; item rows `#171719`; editor `#202023` with `#29292d` head/cards. Light-theme CSS layers earlier in the file are dead code — the dark rendering is the reference.
- **Type:** Instrument Sans (UI + headings, tight tracking), DM Mono for kickers, counts, meta, status micro-labels. Page titles large/tight (`clamp(30px,3vw,42px)`); section titles 17–18px; body 13–15px; micro 9–12px.
- **Shape:** buttons/fields radius ~10–12px; panels/cards 16px; editor 6px; icon-buttons 36px grid cells. Fields: dark fill, 1px muted border, light focus ring.
- **Buttons:** primary = light-on-dark solid; secondary = translucent bordered; danger = red-tinted text/border; ghost for footer Previous; small variant for in-panel actions. One primary per visual group (footer `Save & continue`, editor `Save changes`).
- **Iconography:** Lucide outline icons (16–18px, 1.8 stroke); icon-only buttons always carry `title` tooltips.
- **Density:** generous page padding (48–54px desktop), 18–22px card padding, 12–18px stack gaps; curriculum rows compact (56px min-height) to keep long outlines scannable.

## 9. What remains exactly as the prototype (CC-UX-080)

Shell regions and proportions; sidebar grouping, labels, and ring semantics; page-header kicker/title/desc pattern; section-card anatomy (number + icon + title + goal + pencil/trash/grip); item-row anatomy (status dot + title/meta + Edit + delete); the four-type add menu and its labels; editor head/tabs/actions anatomy; per-type tab sets; question-card, resource-card, task-block, file-drop, check-card, radio-card, coupon-table, caption-table, review-checklist patterns; footer composition and button labels; mobile section-select substitution; charcoal visual system above.

## 10. What must improve before implementation (CC-UX-090)

1. **Selected-row state (required):** add `.selected` styling (accent edge + tinted border, mirroring the light theme's inset bar). Without it the creator can't tell what the editor is showing.
2. **Add-menu viewport behavior:** flip above the trigger near viewport bottom; internal scroll with max-height. Prototype can render the menu off-screen.
3. **Pricing Save overlap (mobile):** stack price preview above a full-width Save; never inline-overlapping.
4. **Completeness rules (§4, CC-UX-038):** single source of truth driving status dots, sidebar `done` rings, and the review checklist (prototype hardcodes all three inconsistently).
5. **Dead controls need verdicts:** topbar Preview / settings gear / back, footer Previous/Save/Save&continue wiring, Bulk uploader, coupon create/remove, caption upload/enable, test-video submit, message preview tabs, review submit — each is either implemented, given an explicit empty/disabled state, or removed. No dead buttons ship.
6. **Row actions:** decide Edit + delete only (as the prototype renders after init) vs restoring per-item Preview; remove the dead section grip unless section drag ships (icon implies a function that doesn't exist).
7. **Dirty handling:** one global rule — navigating/selecting/closing with unsaved editor text warns (or autosaves); the prototype's tab-switch preservation must extend to every exit path.
8. **Copy tightening:** `Practice Test` everywhere (never `Practice`); curriculum note and bulk-uploader note de-duplicate (both currently explain the library — keep one); `Course messages` vs `Course message` naming; review-page `Fix` vs `Review` labeling per row state.
9. **a11y baseline:** focus-visible rings, aria-expanded on expandable rows, role=menu/menuitem on the add menu, label association on all editor inputs, keyboard operability of rows/tabs/menu (prototype is pointer-only).
10. **Light-theme dead CSS:** ~480 lines of superseded light/wizard styles must not be ported; spec §8 is the only visual source of truth.

**Acceptance:** a reviewer opening the (minimally tweaked) prototype can point at any region above and hear a matching answer from this spec. Backend, persistence, and Next.js structure are explicitly out of scope until approval.
