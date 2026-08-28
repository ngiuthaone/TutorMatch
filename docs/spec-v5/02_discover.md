# 07/02 — DISCOVER / MARKETPLACE CONTRACT (DISC)

**Surface:** the discovery landing/marketplace that surfaces workshops (and later tutors/events/classes/courses) to learners.
**Alpha status:** Alpha core for workshop discovery funnel; the catalog rapidly expands Post-Alpha. `discover/` is the preferred production web shell.
**Primary evidence:** `discover/src/app/*`, `discover/src/lib/marketplace-api.ts`, `events-live` listing.

---

## 02.1 PAGES

### DISC-001 — Marketplace/discover landing (`/discover`)
- **Existence:** exists.
- **Data source:** public catalog listing RPC. No auth required.
- **Sections:** hero, featured/live now, upcoming workshops, categories, "how it works", CTA join.
- **States:** `INITIAL` (skeleton), `EMPTY` (no live content), `ERROR`, `LOADED`.
- **Mobile:** responsive bento/card grid; category chips horizontally scrollable.

### DISC-002 — Explore / category browse
- Category-filtered browse (workshop topics, etc.). Data from public listing RPC with the category filter server-side.
- **States:** `INITIAL`, `EMPTY` (no items in category), `ERROR` with retry.

### DISC-003 — Workshop listing entry (alias of WORK-001)
- The discover surface's "Workshops" entry → `WORK-001` listing → `WORK-002` detail.

## 02.2 COMPONENTS

| DISC-0xx | Component | States | Data |
|---|---|---|---|
| DISC-010 | DiscoveryHero | loading/loaded | featured offering |
| DISC-011 | CatalogCard | live/upcoming/sold-out/past | listing row |
| DISC-012 | CategoryPill | active/inactive | taxonomy |
| DISC-013 | HowItWorks | static | — |
| DISC-014 | ExploreGrid | loading/empty/error/loaded | browse rows |

## 02.3 INTERACTIONS

- `DISC-030` — Card click → canonical detail (workshop/tutor/etc.) by kind.
- `DISC-031` — Category pill filters catalog server-side.
- `DISC-032` — "Join" CTA → auth if not logged in; else respective surface.

## 02.4 ACCEPTANCE CRITERIA

- `AC-DISC-001` — Anonymous visitor sees live catalog with correct availability/price.
- `AC-DISC-002` — Every card links to its canonical detail with no broken route.
- `AC-DISC-003` — Empty/error states are graceful and recoverable.
- `AC-DISC-004` — Mobile grid is usable at 375px.

---

## 07/02 RTM

| Req ID | Req | Impl file(s) | API/RPC/DB | Test | Acceptance | Evidence |
|---|---|---|---|---|---|---|
| DISC-001 | Discover landing | `app/discover` | catalog RPC | `E2E-disc` | `AC-DISC-001` | exists |
| DISC-003 | Workshops entry | listing | listing RPC | — | `AC-DISC-002` | WORK-001 |
| DISC-031 | Category filter | browse | catalog RPC | `TST-disc-filter` | `AC-DISC-003` | — |
| DISC-034 | Mobile | explore | — | `RTM2-mobile` | `AC-DISC-004` | §30 |
