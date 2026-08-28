# 20 — SEARCH & FILTER CONTRACT (SCH)

**Surface:** catalog search, category filters, sorting, pagination (+ future full-text).
**Alpha status:** basic server-side filter/sort on discovery; full-text/neural search Post-Alpha.
**Primary evidence:** discovery listing RPCs, category taxonomy in offerings.

---

## 20.1 Contract

- `SCH-010` — All filtering/sorting/pagination runs server-side (RPC) — never client-only over a full dump (`ARCH-005`). Response includes total + page metadata.
- `SCH-011` — Filters: kind (workshop/tutor/event/class), category/topic, date/upcoming, price bounds, availability (has open session).
- `SCH-012` — Sort: relevance (default: upcoming & bookable), price, newest, popularity (alpha first: upcoming then price/date).
- `SCH-013` — Pagination / infinite scroll with cursor or offset; loading/empty states.
- `SCH-020` — Full-text + typo-tolerant + multilingual (vi/en) search is **Post-Alpha** (`TDEC-*`; no Postgres FTS in Alpha unless budgeted).
- `SCH-021` — Search rate-shaping for abuse (`SEC-022`).

## 20.2 ACCEPTANCE CRITERIA

- `AC-SCH-001` — Filters & sort applied server-side correctly.
- `AC-SCH-002` — Empty results show a helpful empty state + reset.
- `AC-SCH-003` — Pagination/infinite scroll stable; no dupes/gaps.
- `AC-SCH-004` — Full-text search is explicitly deferred (documented).

---

## 20 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| SCH-010 | server-side filter | RPC | `TST-sch` | `AC-SCH-001` | ARCH-005 |
| SCH-011/012 | filters+sort | RPC | `TST-sch` | `AC-SCH-001` | — |
| SCH-013 | pagination | RPC/UI | `TST-sch-page` | `AC-SCH-003` | — |
| SCH-020 | FTS deferred | — | — | `AC-SCH-004` | SCOPE-004 |
