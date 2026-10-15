# 47 — UI/UX SPEC: COURSE CREATOR CAPTIONS (CC-CAPTIONS)

**Status:** UI/UX SPECIFICATION — design phase. No production implementation authorized until this spec is approved.
**Reference:** standalone prototype `/Users/soshi/Downloads/preview-24-finished-4.html` (frozen visual/interaction reference).
**Non-goals (explicit):** backend integration, Supabase, API wiring, real persistence, production data models, authentication, migrating the prototype's JavaScript. This spec defines **UI/UX, layout, interactions, hierarchy, and flow only**.
**Prototype rule:** the reference file is **NOT part of the repository and MUST NOT be copied into production**. The native Next.js build re-implements this spec from scratch. Prototype JS (vanilla, localStorage) is throwaway; only the UX contract below survives.

---

## 1. Page context (CC-CAP-001)

Captions lives inside the Course Creator shell under **Create** group, between Curriculum and Accessibility. It inherits the global topbar, sidebar, and footer from the course-creator layout.

- **Sidebar item:** `Captions · optional` with empty/done/optional status ring.
- **Page header:** kicker `CREATE`, title `Captions`, description explaining caption accuracy goal and scope.
- **Info banner:** `Aim for at least 99% caption accuracy` with supporting help text about reviewing automated captions.

---

## 2. Page structure (CC-CAP-002)

```
┌─────────────────────────────────────────────────────────────┐
│ Caption manager                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Command bar                                         │   │
│  │  [Title: "Captions"] [Language select ▾] [Progress] │   │
│  │  [Add language] [Disable]                           │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Filter bar                                          │   │
│  │  [All (4)] [No captions] [Auto-generated] [Draft]  │   │
│  │  [Published] [Needs review]                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Table                                               │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ □ Lecture │ Caption file │ Updated │ Action  │    │   │
│  │  ├─────────────────────────────────────────────┤    │   │
│  │  │ ● Title      File/v-status  Just now  [Btn][⋮]│   │   │
│  │  │ ● Title      No captions    —        [Btn][⋮]│   │   │
│  │  │ ...                                         │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- **Command bar (CC-CAP-003):** left = title `Captions` + searchable language select + progress text (`3/4 published lectures captioned`). Right = `Add language` + `Disable` actions.
- **Filter bar (CC-CAP-004):** horizontal filter chips for statuses: All, No captions, Auto-generated, Draft, Published, Needs review. Each shows count. Active filter has bottom border accent.
- **Table (CC-CAP-005):** 4 columns: Lecture, Caption file, Updated, Actions. Checkbox column omitted on mobile.

---

## 3. Component hierarchy (CC-CAP-010)

```
CaptionsPage
├─ InfoBanner (accuracy guidance)
├─ CaptionManager
│  ├─ CaptionCommandBar
│  │  ├─ CaptionTitle
│  │  ├─ SearchableLanguageSelect
│  │  ├─ CaptionProgress
│  │  └─ CaptionCommandActions (AddLanguage, DisableLanguage)
│  ├─ CaptionFilterBar
│  │  └─ CaptionFilterButton* (All, No captions, Auto-generated, Draft, Published, Needs review)
│  └─ CaptionTable
│     ├─ CaptionTableHead (Lecture, Caption file, Updated, Actions)
│     ├─ CaptionRow*
│     │  ├─ CaptionLectureCell (status dot, title, meta)
│     │  ├─ CaptionFileCell (file status, file name, auto-generated label)
│     │  ├─ CaptionUpdatedCell (relative time or em-dash)
│     │  └─ CaptionActions (Upload/Replace button, MoreVertical menu button)
│     ├─ CaptionEmptyState
│     └─ CaptionSkeletonRow* (loading state)
└─ ConfirmModal (delete confirmation)
```

Shared primitives: `IconButton` (36px, tooltip via `title`), `Pill/Badge`, `InfoBanner`, `SearchableDropdown`.

---

## 4. Data model (CC-CAP-020)

```typescript
interface CaptionTrack {
  id: string;
  language: string;
  format: "vtt" | "srt";
  fileName: string;
  lectureId: string;
  status: "uncaptioned" | "auto_generated" | "draft" | "published" | "needs_review";
  generated?: boolean;
}

interface CaptionsData {
  languages: string[];
  activeLanguage: string;
  tracks: CaptionTrack[];
}
```

- **Languages:** array of enabled languages. At least one language always enabled; disable removes active language and falls back to first remaining.
- **Active language:** determines which caption tracks are visible in the table.
- **Tracks:** one per lecture per language. Uncaptioned lectures have no track entry; status computed as `uncaptioned`.
- **Status lifecycle:** `uncaptioned` → `auto_generated` (system-created) → `draft` (uploaded/replaced) → `needs_review` (manual flag) → `published` (explicit publish).

---

## 5. Interactions & behaviors (CC-CAP-030)

### 5.1 Language management (CC-CAP-031)

- **Add language:** `Add language` button opens prompt for language name. Rejects duplicates. Adds to languages array and sets as active. Button visible when languages array can grow (no hard limit in prototype; implement sensible max, e.g. 10).
- **Disable language:** `Disable` button removes active language from array. Minimum one language required; button disabled when only one remains. After removal, active language falls back to first remaining. Tracks for disabled language are hidden but not deleted.

### 5.2 Filtering (CC-CAP-032)

- **Filter chips:** horizontal buttons with count badges. Active chip has bottom border accent.
- **Counts:** computed from current tracks + active language. `All` shows total lecture count. Others show count matching that status.
- **Empty state:** when filter yields no results, show empty list message: `No captions yet` with instructional text.

### 5.3 Row actions (CC-CAP-033)

- **Upload/Replace:** triggers hidden file input (`accept=".vtt,.srt,text/vtt,application/x-subrip"`). Creates new track with status `draft`. Replace overwrites existing track for same lecture + language, preserving ID or generating new.
- **MoreVertical menu:** disabled when no track exists. Menu contains:
  - `Publish` (status → published)
  - `Mark as draft` (status → draft)
  - `Mark as needs review` (status → needs_review)
  - `Delete` (removes track, returns row to uncaptioned state)
- **Delete confirmation:** `ConfirmModal` with lecture title + warning text. No `prompt()`/`alert()`.

### 5.4 Batch actions (CC-CAP-034)

- **Batch publish:** select multiple rows via checkboxes, invoke batch publish from command bar or menu. Updates all selected tracks to `published`. Counts and status dots update immediately.
- **Selection:** checkbox in table head toggles all visible rows. Per-row checkbox toggles individual selection. Selected state visually distinct.

### 5.5 Status indicators (CC-CAP-035)

- **Status dot:** 8px circle, color-coded:
  - `uncaptioned` → gray `#9da3a7`
  - `auto_generated` → amber `#b4690e`
  - `draft` → purple `#5624d0`
  - `published` → green `#1e7f4f`
  - `needs_review` → red `#b32d0f`
- **Dot role:** `role="img"` with `aria-label` matching status text.

### 5.6 Progress (CC-CAP-036)

- **Progress text:** `{count}/{total} published lectures captioned`. Counts only `published` tracks for active language across all lectures.

---

## 6. Accessibility (CC-CAP-040)

- **Keyboard:** all interactive elements focusable with visible focus rings. Filter chips, buttons, and menu items operable via keyboard.
- **ARIA:** status dots have `role="img"` + `aria-label`. Menu buttons have `aria-label="More actions"`. File inputs associated with visible labels via `htmlFor`/`id`.
- **Screen reader:** empty state announced as content region. Loading skeleton uses `aria-hidden="true"`.
- **Color:** status dots not sole indicator; accompanied by text labels in file cell and filter chips.

---

## 7. Responsive behavior (CC-CAP-050)

- **Tablet/desktop:** 4-column grid layout. Command bar row with title, select, progress, and actions inline.
- **Mobile (≤760px):** table head hidden. Rows stack: lecture name full width, file cell below, updated hidden, actions aligned to right. Command bar stacks vertically. Filter bar scrolls horizontally if needed.

---

## 8. Edge cases & guards (CC-CAP-060)

- **Single language:** disable button hidden/disabled.
- **Duplicate language names:** add prompt rejects duplicates.
- **Invalid file type:** file input `accept` attribute filters; browser-level guard only.
- **Track replacement:** uploading new file to existing lecture replaces track; status resets to `draft`.
- **Empty filter results:** empty state message shown, not blank table.
- **Loading state:** skeleton rows shown during simulated 600ms load. Skeleton non-interactive (`pointer-events: none`).

---

## 9. Implementation notes (CC-CAP-070)

- **Styling:** reuse existing dark theme tokens (`--ink`, `--muted`, `--line`, `--panel`, `--purple`, `--ok`, `--warn`, `--danger`). Grid: `grid-template-columns: minmax(240px,1.25fr) minmax(220px,1fr) 104px 132px 38px`.
- **State management:** local React state for prototype; production moves to server-authoritative store via API.
- **Searchable select:** custom dropdown with search input, keyboard navigation, and viewport-aware positioning.
- **File upload:** controlled via hidden `<input type="file">` + `<label>` trigger. In production, replace with proper upload component handling progress, errors, and retry.
- **Menu:** context menu per row; in production, replace with accessible menu component (e.g. Radix DropdownMenu) ensuring focus trap, escape close, and proper ARIA attributes.
