# 07/08 — EVENTS / CLASSES / COURSES CONTRACT (EVT / CLS / CRS)

**Surface:** event listings/details, class (recurring) offerings, course marketplace + LMS.
**Alpha status:** DEFERRED to Post-Alpha by default (`SCOPE-004`/`PURPLE`). The **shared booking engine (BOOK)** is the single future engine for these; do NOT build parallel booking. Wiring events/classes/courses into the shared engine is Post-Alpha (`DEC-*`).
**Primary evidence:** routes exist as `events-live` (real-ish for workshop), plus `events`, `classes`, `courses` (embed/localStorage/mock). `events-live/[slug]` detail has the `offeringType`/`kind` bug (`REAL-009`) — but events-live is currently the **workshop** surface, so a real `events` offering kind is Post-Alpha.

---

## 08.1 Contract intent (Post-Alpha)

- `EVT-010` — Events: an `offering_kind='event'` expanded into the shared engine + discovery (single-attendee / flat per participant). Booking/reviews via `BOOK`/`REV`.
- `CLS-010` — Classes: recurring series on the shared engine; capacity/session model extended (recurrence) Post-Alpha.
- `CRS-010` — Courses/LMS: full content/delivery model separate from the transactional marketplace; distinct `CRS-*` surface, definitely Post-Alpha.

## 08.2 Current reality inventory

| Route | Exists | Nature | Alpha? |
|---|---|---|---|
| `/events` | yes | embed | DEFER |
| `/events/[slug]` | yes | embed/mock | DEFER (real event = Post-Alpha) |
| `/events/new` | yes | creator (like workshop creator gap) | DEFER |
| `/events-live` | yes | real-ish (used for WORKSHOPS) | Workshop = ALPHA |
| `/classes` + `[slug]` | yes | embed/legacy | DEFER |
| `/courses` + `[slug]` + `/new` + `/course-profile` | yes | embed/localStorage | DEFER |
| `/skills` | yes | mock | DEFER |

- `EVT-020` — Until wired into the shared engine, events/classes/courses must stay clearly labeled preview/embed and never take real money. No `EVT/CLS/CRS` route silently promoted without `DEC-*`.

## 08.3 DEFER, don't drop

- `EVT-030` — Events MUST reuse create_booking/BOOK once promoted (`ARCH-002`). Do not fork the engine.
- `CLS-030` — Classes reuse session model + capacity.

## 08.4 ACCEPTANCE CRITERIA (deferred-gate)

- `AC-EVT-001` — No promoted EVT/CLS/CRS money loop runs outside the shared engine.
- `AC-EVT-002` — Deferred routes never take real money and are labeled preview/embed.
- `AC-EVT-003` — Workshop (current events-live) detail `offeringType`/`kind` bug is fixed as part of the Workshop Alpha surface (`WORK-002-BUG-1`), not left as a live-events issue.

---

## 08 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| EVT-020 | preview/embed only | routes | — | `AC-EVT-002` | SCOPE-004 |
| EVT-030/CLS-030 | reuse shared engine | — | — | `AC-EVT-001` | ARCH-002 |
| CRS-010 | LMS separate surface | — | — | `AC-EVT-001` | SCOPE-004 |
