# 46 — UI/UX SPEC: COURSE STRUCTURE (CS-UX)

**Status:** UI/UX SPECIFICATION — design phase. No backend migration until spec approved.
**Source:** PRD Brainstorm `Course Structure` (private planning workspace: Intended learners → Course structure → Curriculum).
**Reference:** `preview-24-finished-4.html` (current) + `43_uiux_course_creator.md` (shell/visual system).
**Non-goals:** second Curriculum editor, learner-facing outline, full lesson editing, file uploads, AI generation (future scope).

---

## 1. Page purpose (CS-UX-001)

One private workspace that turns **WHO/WHAT** (outcomes) into **HOW** (planned journey) before production.

Header:

**Course structure**
*Plan the learning journey before building the lessons.*
*Use your learning outcomes to organize the sections, activities, and practice learners will complete.*
`PRIVATE · Only you can see these notes` badge, top-right, mono, muted.

Relationship made visible (subtle, not a diagram):
`Intended learners (outcomes) → Course structure (plan) → Curriculum (build)` — shown as a single help line under the header and via the `View in Intended learners` link.

---

## 2. Page structure (CS-UX-010)

Single column, top→bottom:

1. **Your outcomes** (context, read-only)
2. **Private course outline** (hero — structured planner)
3. **Structure check** (lightweight, informational)
4. **Continue to Curriculum** (explicit handoff)

No side panels. No wizard steps. Free scroll.

Empty and incomplete states sit in place of (2) and (1) respectively — never a blank page.

---

## 3. Your outcomes (CS-UX-020)

Pulled live from `payload.intendedLearners.outcomes` (source of truth). No re-entry.

- **When present (≥1):** numbered list (01–04+), muted mono numbers, 13.5px body, compact leading. Header row: `Your outcomes — 4 outcomes` + `View or edit in Intended learners` (ghost button, navigates to `intended-learners`).
- **When empty:** `Define your outcomes first — Course structure works best when your learning outcomes are defined.` + primary `Go to Intended learners`.
- **Count display:** `4 outcomes` (mono, 11px) beside the title, not inside the list.

Visual: `panel` with soft background, 16px padding, 1px border, 16px radius (existing system).

---

## 4. Private course outline (CS-UX-030 — hero)

**Concept:** lightweight structured planner, not a full editor.

Each planned section:

```
Section 1 — Foundations of sourdough            [Edit] [Delete] [≡ drag]
Goal  Understand the science behind a healthy starter.
Planned items  [ + Add ]
  Lecture — Introduction
  Lecture — Starter science
  Quiz — Starter knowledge check
```

- **Section title:** 14px, 750 weight, mono number prefix (`Section 1 —`).
- **Section goal:** 12.5px, muted, one line, `Goal` label in small mono. Empty goal shows `No goal yet — add one` (muted, dashed underline affordance).
- **Planned items:** vertical stack, 8px gap, each row: `Type — Title` (12.5px, 600 weight, type in `DM Mono` 10.5px uppercase), `×` remove on hover/focus. No lesson body, no files, no questions — labels only.
- **Add item:** `+ Add` opens a 4-option menu (Lecture / Quiz / Practice Test / Assignment) — same labels as Curriculum, but creates a *planning label* (type+title string), not a content object. Menu flips to viewport, same as Curriculum.

**Section creation (CS-UX-031):** `+ Section` (primary, below the outline) opens inline form: Title + Goal (textarea, placeholder `By the end of this section, learners can…`) + Cancel / Create section. Empty title falls back to `New Section`. New section appears at end, focused, with empty goal and no items.

**Editing (CS-UX-032):** pencil opens inline form over the header (title input + goal textarea + Cancel / Save section). Goal is the planning copy — worded as *Visible to learners goal* with help `Shown on the section header in Curriculum after handoff (editable there).`

**Reordering (CS-UX-033):** drag handle `≡` on each section header, vertical reorder only, with drop indicator line. Persists via `courseStructure.planSectionsOrder` (local) + future `reorder` API.

**Deletion (CS-UX-034):** empty section → immediate delete. With items → confirm modal: `Delete “Foundations”? Its 3 planned items will be removed.` No `prompt()`.

**Empty outline (CS-UX-035):** `Start planning your course — Begin with the outcomes above, then sketch the sections that will get learners there.` + primary `Add first section` + secondary `View learning outcomes`.

**Autosave (CS-UX-036):** every mutation (section add/edit/delete/reorder, item add/remove) updates `payload.courseStructure` and triggers the global shell `Saving… → Saved` pipeline. No per-section Save button.

---

## 5. Planned items vs Curriculum items (CS-UX-040)

Explicit distinction, shown once as a help line under the outline:

> Planning labels are private. They become real lectures/quizzes only when you build them in **Curriculum**.

No silent conversion. Future `Start with this outline` is a separate, explicit action that scaffolds Curriculum sections from the plan (out of V1).

---

## 6. Structure check (CS-UX-050)

Informational, not blocking. Single `panel` below the outline.

Four checks, each with `✓` / `○` and a one-line detail:

- **Outcomes covered** — every outcome has ≥1 section whose goal or planned items reference it (V1 heuristic: every outcome is considered covered if ≥1 section exists; future: explicit mapping).
- **Practice included** — ≥1 planned item is Quiz / Practice Test / Assignment.
- **Sections have goals** — every section has a non-empty goal.
- **Progression is clear** — ≥2 sections and titles are non-generic (not `New Section`).

Empty or partial states show `○` with help text, e.g. `○ Section 3 does not have a goal yet`. Never a red error. No warning icon.

---

## 7. Continue to Curriculum (CS-UX-060)

Single primary action, right-aligned below the check:

`Build curriculum →` (primary, `btn-primary`)

- Always enabled (even with empty outline) — the check is guidance, not a gate. Click navigates to `curriculum` via `onNavigate("curriculum")` and scrolls to top.
- Help line: `Takes you to the Curriculum workspace where you build the actual learner experience.`

No auto-conversion, no `Start with this outline` in V1.

---

## 8. Visual system (CS-UX-070)

Reuse `43` system: deep graphite shell, `Instrument Sans` + `DM Mono`, 16px radius panels, 1px muted borders, compact density. Private outline sections use `ud-section-box` variant with softer header (`#2a2a2d`) and `PRIVATE` mono badge. No new colors, no purple, no illustration.

---

## 9. Responsive (CS-UX-080)

- Desktop: single column, max 1120px, 48px padding.
- ≤760px: same, with `+ Section` full-width, add-item menu becomes inline full-width (existing pattern).

---

## 10. What remains / what is removed (CS-UX-090)

- **Removed:** 3 generic guidance cards (Start with outcome / Build focused sections / Add practice), `Recommended quality baseline` checkboxes, `Download outline` button.
- **Kept (updated):** private outline concept, but now structured; `PRIVATE` badge retained and made more prominent.
- **Deferred:** AI suggestions, outline → Curriculum scaffolding, fine-grained outcome-to-item mapping.

---

## 11. Acceptance (CS-UX-100)

- Outcomes visible or one click away.
- Can create/edit/delete/reorder planned sections with goals.
- Can add/remove planned item labels (4 types).
- Can see at a glance which structure checks are met.
- Can continue to Curriculum in one click.
- Empty and incomplete states are clear and actionable.
- No duplication of Curriculum editing.
- Autosave via global shell, no extra Save buttons.
