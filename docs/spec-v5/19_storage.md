# 19 — STORAGE CONTRACT (STG)

**Surface:** Supabase Storage buckets, policies, upload paths, and the current (absent) state.
**Alpha status:** minimal — avatar + thumbnail upload hardening; no public UGC upload before bucket provisioning.
**Primary evidence:** `REAL-010` — no storage bucket provisioned; images currently rely on external/URL or seeded entries.

---

## 19.1 Bucket model

| STG-0xx | Bucket | Access | Policies |
|---|---|---|---|
| STG-010 | `avatars` | owner upload; public read of own-uploaded | insert/update by owner; select public |
| STG-011 | `offerings` (thumbnails) | host upload; public read of published | owner insert; public select only published |

- `STG-012` — Supabase Storage policies are RLS-based; never written via service-role in client path.
- `STG-013` — File type/size validation server-side; no executable upload; AV scan optional (Post-Alpha).

## 19.2 Current gap

- `STG-020` — **No bucket provisioned** (`REAL-010`). Alpha must provision `avatars` + `offerings` buckets (or decide CDN strategy `TDEC-*`) before avatar/thumbnail real uploads work.

## 19.3 ACCEPTANCE CRITERIA

- `AC-STG-001` — A user can upload an avatar; only they can overwrite it; unknown files are rejected.
- `AC-STG-002` — A host can upload offering thumbnails; public read only for published offerings.
- `AC-STG-003` — No executable/unvalidated upload reaches storage.

---

## 19 RTM

| Req ID | Req | Impl | Test | Acceptance | Evidence |
|---|---|---|---|---|---|
| STG-010/011 | buckets+policy | migration | `TST-storage` | `AC-STG-001/2` | REAL-010 |
| STG-020 | provision buckets | infra | — | `AC-STG-001` | REAL-010 |
| STG-013 | validation | upload | `TST-upload` | `AC-STG-003` | — |
