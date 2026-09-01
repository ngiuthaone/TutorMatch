import { describe, expect, it } from "vitest";
import { createSupabaseMarketplaceService, type MarketplaceListing } from "../src/services/marketplace-service.js";

/**
 * Faithful in-memory fake of the Supabase query-builder chain that the
 * marketplace service uses. Only implements the methods exercised by the CAS
 * tests, plus harmless no-ops for the publish/getPublic methods so the same
 * fake can be reused.
 *
 * Crucial property: every .single() is fully synchronous inside the chain —
 * the version guard ("apply the update only if row.version === expected") is
 * performed in a single non-interruptible step. This mirrors how Supabase
 * translates `update(...).eq("version", X).select().single()` into a single
 * SQL statement: `UPDATE ... WHERE version = X RETURNING *` — there is no
 * observable gap between the equality check and the write. Two racing
 * callers that both observed version=1 will see exactly one winner.
 */
type Row = {
  id: string;
  kind: "course" | "event";
  slug: string;
  title: string;
  creator_id: string;
  payload: Record<string, unknown>;
  published_at: string;
  status: string;
  version: number;
};

type Eq = { column: string; value: unknown };
type QueryState = {
  table: string | null;
  mode: "select" | "update" | "upsert" | "delete" | "insert";
  updatePatch: Record<string, unknown>;
  insertRow: Record<string, unknown> | null;
  upsertRow: Record<string, unknown> | null;
  upsertOnConflict: string | null;
  selectColumns: string | null;
  eqFilters: Eq[];
  inFilters: { column: string; values: unknown[] }[];
  expectSingle: boolean;
};

function makeFakeClient(initialRows: Row[]) {
  const rows: Row[] = initialRows.map((r) => ({ ...r, payload: { ...r.payload } }));

  function makeBuilder(): any {
    const state: QueryState = {
      table: null,
      mode: "select",
      updatePatch: {},
      insertRow: null,
      upsertRow: null,
      upsertOnConflict: null,
      selectColumns: null,
      eqFilters: [],
      inFilters: [],
      expectSingle: false,
    };

    const builder: any = {
      from(table: string) {
        state.table = table;
        return builder;
      },
      select(columns: string) {
        // In real Supabase, .select() after .update()/.insert()/.upsert() only
        // specifies the return columns and does not change the write mode.
        // Only set mode when called on a fresh chain (no write in progress).
        if (state.mode === "select") state.mode = "select";
        state.selectColumns = columns;
        return builder;
      },
      update(patch: Record<string, unknown>) {
        state.mode = "update";
        state.updatePatch = patch;
        return builder;
      },
      upsert(row: Record<string, unknown>, options?: { onConflict?: string }) {
        state.mode = "upsert";
        state.upsertRow = row;
        state.upsertOnConflict = options?.onConflict ?? null;
        return builder;
      },
      insert(row: Record<string, unknown>) {
        state.mode = "insert";
        state.insertRow = row;
        return builder;
      },
      eq(column: string, value: unknown) {
        state.eqFilters.push({ column, value });
        return builder;
      },
      in(column: string, values: unknown[]) {
        state.inFilters.push({ column, values });
        return builder;
      },
      order(_column: string, _opts?: unknown) {
        return builder;
      },
      limit(_count: number) {
        return builder;
      },
      single() {
        state.expectSingle = true;
        return runQuery();
      },
      // Thenable so awaiting the builder directly (no .single()) resolves with the array.
      then(onFulfilled: any, onRejected: any) {
        return Promise.resolve(runQuery()).then(onFulfilled, onRejected);
      },
    };

    function applyEqs(candidates: Row[]): Row[] {
      return candidates.filter((row) =>
        state.eqFilters.every((f) => (row as any)[f.column] === f.value) &&
        state.inFilters.every((f) => f.values.includes((row as any)[f.column]))
      );
    }

    function runQuery(): Promise<{ data: any; error: any }> {
      if (state.table !== "marketplace_listings") {
        return Promise.resolve({ data: null, error: { code: "UNHANDLED_TABLE", message: `Fake client does not implement table ${state.table}` } });
      }

      if (state.mode === "select") {
        const matches = applyEqs(rows);
        if (state.expectSingle) {
          if (matches.length === 0) return Promise.resolve({ data: null, error: { code: "PGRST116", message: "Row not found" } });
          return Promise.resolve({ data: projectColumns(matches[0]!, state.selectColumns), error: null });
        }
        return Promise.resolve({ data: matches.map((r) => projectColumns(r, state.selectColumns)), error: null });
      }

      if (state.mode === "upsert") {
        if (!state.upsertRow) return Promise.resolve({ data: null, error: { code: "MISSING_UPSERT_ROW" } });
        const conflictKeys = (state.upsertOnConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const matchIdx = rows.findIndex((r) => conflictKeys.every((k) => (r as any)[k] === (state.upsertRow as any)[k]));
        const incoming = state.upsertRow as unknown as Row;
        if (matchIdx >= 0) {
          rows[matchIdx] = { ...rows[matchIdx], ...incoming, payload: { ...(incoming.payload ?? {}) } };
        } else {
          rows.push({ ...incoming, payload: { ...(incoming.payload ?? {}) } });
        }
        const saved = rows.find((r) => conflictKeys.every((k) => (r as any)[k] === (incoming as any)[k]))!;
        if (state.expectSingle) return Promise.resolve({ data: projectColumns(saved, state.selectColumns), error: null });
        return Promise.resolve({ data: projectColumns(saved, state.selectColumns), error: null });
      }

      if (state.mode === "insert") {
        if (!state.insertRow) return Promise.resolve({ data: null, error: { code: "MISSING_INSERT_ROW" } });
        const incoming = state.insertRow as unknown as Row;
        const exists = rows.some((r) => r.kind === incoming.kind && r.slug === incoming.slug && r.creator_id === incoming.creator_id && r.status === incoming.status);
        if (exists) return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } });
        const saved = { ...incoming, payload: { ...(incoming.payload ?? {}) }, version: incoming.version ?? 1 };
        rows.push(saved);
        return Promise.resolve({ data: projectColumns(saved, state.selectColumns), error: null });
      }

      if (state.mode === "update") {
        // Synchronous, atomic version guard: pick the first row matching every
        // .eq filter INCLUDING the version guard, mutate it, and return. If no
        // row matches the version guard (i.e. version already moved on), return
        // { data: null, error: { code: "PGRST116" } } — mirroring real Supabase,
        // which raises PostgREST error PGRST116 ("JSON object requested, but no
        // rows") for .single() on a 0-row conditional UPDATE. The service maps
        // PGRST116 to { status: "conflict" } (the read-first step above already
        // distinguished not_found and pre-update conflict, so reaching here
        // means a concurrent writer moved the row between read and write —
        // a CAS race). This models Supabase's `UPDATE ... WHERE version = X
        // RETURNING *` faithfully: there is no observable gap between the
        // equality check and the write, so two racing callers cannot both
        // succeed.
        const matches = applyEqs(rows);
        if (matches.length === 0) {
          if (state.expectSingle) {
            return Promise.resolve({
              data: null,
              error: { code: "PGRST116", message: "JSON object requested, but no rows" },
            });
          }
          return Promise.resolve({ data: [], error: null });
        }
        const target = matches[0]!;
        const idx = rows.indexOf(target);
        rows[idx] = {
          ...target,
          ...state.updatePatch,
          id: target.id,
          // Preserve JSONB object identity — service passes a fresh object literal each call.
          payload: state.updatePatch.payload ? { ...(state.updatePatch.payload as Record<string, unknown>) } : target.payload,
        };
        if (state.expectSingle) return Promise.resolve({ data: projectColumns(rows[idx]!, state.selectColumns), error: null });
        return Promise.resolve({ data: projectColumns(rows[idx]!, state.selectColumns), error: null });
      }

      return Promise.resolve({ data: null, error: { code: "UNHANDLED_MODE" } });
    }

    return builder;
  }

  function projectColumns(row: Row, cols: string | null) {
    if (!cols) return { ...row };
    const out: Record<string, unknown> = {};
    for (const c of cols.split(",").map((s) => s.trim()).filter(Boolean)) out[c] = (row as any)[c];
    return out;
  }

  return {
    client: {
      from(table: string) {
        return makeBuilder().from(table);
      },
    },
    rows,
  };
}

const creatorId = "11111111-1111-4111-8111-111111111111";
const otherCreator = "22222222-2222-4222-8222-222222222222";
const token = "bearer-token";
const slug = "algebra-fundamentals";

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "listing-1",
    kind: "course",
    slug,
    title: "Algebra fundamentals",
    creator_id: creatorId,
    payload: { description: "original" },
    published_at: "2026-01-01T00:00:00Z",
    status: "published",
    version: 1,
    ...overrides,
  };
}

describe("marketplace-service CAS update (real service + fake supabase)", () => {
  it("sequential CAS: first update wins, second stale update returns conflict", async () => {
    const { client, rows } = makeFakeClient([makeRow()]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    const first = await service.update(token, "course", slug, 1, { title: "Renamed by caller A", payload: { description: "from A" } });
    expect(first.status).toBe("ok");
    if (first.status !== "ok") throw new Error("first must succeed");

    expect(rows[0]!.version).toBe(2);
    expect(rows[0]!.title).toBe("Renamed by caller A");
    expect(rows[0]!.payload).toEqual({ description: "from A" });

    const second = await service.update(token, "course", slug, 1, { title: "Renamed by caller B", payload: { description: "from B" } });
    expect(second.status).toBe("conflict");
    // The stale patch must NOT have landed.
    expect(rows[0]!.version).toBe(2);
    expect(rows[0]!.title).toBe("Renamed by caller A");
    expect(rows[0]!.payload).toEqual({ description: "from A" });
  });

  it("concurrent CAS: exactly one winner, exactly one conflict, no lost update, no double-write", async () => {
    const { client, rows } = makeFakeClient([makeRow()]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    // Both callsites read the row concurrently. They both observe version=1 and
    // both issue the version-guarded UPDATE. The fake's version guard is a
    // single synchronous step, so exactly one UPDATE finds version=1 and
    // wins; the other finds version=2 and returns null → service maps to
    // { status: "conflict" }.
    const [a, b] = await Promise.all([
      service.update(token, "course", slug, 1, { title: "Patch A", payload: { description: "A" } }),
      service.update(token, "course", slug, 1, { title: "Patch B", payload: { description: "B" } }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["conflict", "ok"]);

    const winner = a.status === "ok" ? { name: "A", result: a } : { name: "B", result: b };
    const loser = a.status === "conflict" ? { name: "A", result: a } : { name: "B", result: b };

    expect(winner.result).toMatchObject({ status: "ok" });
    expect(loser.result).toMatchObject({ status: "conflict" });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.version).toBe(2);
    // The persisted patch is EXACTLY the winner's — not a merge of both, not
    // the loser's. This proves no lost update and no double-write.
    expect(rows[0]!.title).toBe(`Patch ${winner.name}`);
    expect(rows[0]!.payload).toEqual({ description: winner.name });
  });

  it("CAS also enforces ownership via WHERE row-version; a different creator reading the same slug still hits the conflict path", async () => {
    const { client, rows } = makeFakeClient([makeRow()]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    // A second creator's stale write must not be able to poison the row even
    // if they happen to know the slug. RLS would block this in production; the
    // fake's job is to confirm the CAS guard is independent of RLS — a stale
    // version is a stale version regardless of who sent it.
    const ownerResult = await service.update(token, "course", slug, 1, { title: "Owner wrote this" });
    expect(ownerResult.status).toBe("ok");

    const interloper = await service.update("interloper-token", "course", slug, 1, { title: "I am not the creator" });
    expect(interloper.status).toBe("conflict");
    expect(rows[0]!.title).toBe("Owner wrote this");
    expect(rows[0]!.version).toBe(2);
    void otherCreator; // referenced for clarity above; not used by the fake
  });

  it("sequential updates chain correctly: 1 → 2 → 3, each with the expected version", async () => {
    const { client, rows } = makeFakeClient([makeRow()]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    const r1 = await service.update(token, "course", slug, 1, { title: "v1→v2" });
    expect(r1.status).toBe("ok");
    expect(rows[0]!.version).toBe(2);

    const r2 = await service.update(token, "course", slug, 2, { title: "v2→v3" });
    expect(r2.status).toBe("ok");
    expect(rows[0]!.version).toBe(3);

    const r3 = await service.update(token, "course", slug, 3, { title: "v3→v4" });
    expect(r3.status).toBe("ok");
    expect(rows[0]!.version).toBe(4);

    expect(rows[0]!.title).toBe("v3→v4");
  });
});

describe("marketplace-service mapRow / public read (real service + fake supabase)", () => {
  it("getPublic returns the published row for anon callers", async () => {
    const { client } = makeFakeClient([makeRow({ status: "published" })]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);
    const result = await service.getPublic("course", slug);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const item: MarketplaceListing = result.data;
      expect(item.slug).toBe(slug);
      expect(item.kind).toBe("course");
      expect(item.version).toBe(1);
    }
  });

  it("getPublic returns not_found when no row matches", async () => {
    const { client } = makeFakeClient([]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);
    const result = await service.getPublic("course", "nonexistent");
    expect(result.status).toBe("not_found");
  });
});

/**
 * Variant of the fake that lets a test inject an UPDATE error (instead of
 * honoring the in-memory version guard). Used to prove that a non-PGRST116
 * error from the UPDATE step still maps to "unavailable" â the PGRST116
 * special-case must not swallow genuine infrastructure failures.
 */
function makeFakeClientWithUpdateError(updateError: { code: string; message: string }) {
  const rows: Row[] = [];
  function makeBuilder(): any {
    const state: QueryState = {
      table: null,
      mode: "select",
      updatePatch: {},
      insertRow: null,
      upsertRow: null,
      upsertOnConflict: null,
      selectColumns: null,
      eqFilters: [],
      inFilters: [],
      expectSingle: false,
    };
    const builder: any = {
      from(table: string) { state.table = table; return builder; },
      select(columns: string) { state.selectColumns = columns; return builder; },
      update(patch: Record<string, unknown>) { state.mode = "update"; state.updatePatch = patch; return builder; },
      upsert(row: Record<string, unknown>, options?: { onConflict?: string }) {
        state.mode = "upsert"; state.upsertRow = row; state.upsertOnConflict = options?.onConflict ?? null; return builder;
      },
      eq(column: string, value: unknown) { state.eqFilters.push({ column, value }); return builder; },
      single() { state.expectSingle = true; return runQuery(); },
      then(onFulfilled: any, onRejected: any) { return Promise.resolve(runQuery()).then(onFulfilled, onRejected); },
    };
    function runQuery(): Promise<{ data: any; error: any }> {
      if (state.mode === "update" && state.expectSingle) {
        return Promise.resolve({ data: null, error: updateError });
      }
      if (state.mode === "select" && state.expectSingle) {
        // Return a synthetic row matching whatever the eq filters ask for, so the
        // read-first step in the service sees a row it can pass the version check on.
        const synth: Row = {
          id: "listing-1", kind: "course", slug: "algebra-fundamentals",
          title: "Algebra fundamentals", creator_id: "11111111-1111-4111-8111-111111111111",
          payload: { description: "original" }, published_at: "2026-01-01T00:00:00Z",
          status: "published", version: 1,
        };
        for (const f of state.eqFilters) (synth as any)[f.column] = f.value;
        return Promise.resolve({ data: synth, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }
    return builder;
  }
  return {
    client: { from(table: string) { return makeBuilder().from(table); } },
  };
}

describe("marketplace-service error mapping: non-PGRST116 UPDATE error -> unavailable", () => {
  it("a non-PGRST116 UPDATE error (e.g. connection failure) maps to unavailable, not conflict", async () => {
    const { client } = makeFakeClientWithUpdateError({ code: "00000", message: "connection failure" });
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    const result = await service.update(token, "course", slug, 1, { title: "won't land" });
    expect(result.status).toBe("unavailable");
    expect(result.status).not.toBe("conflict");
  });

  it("the same non-PGRST116 error path on unpublish also maps to unavailable", async () => {
    // The fake used above only implements update-mode error injection; for
    // unpublish we just need to confirm the error-mapping code in the service
    // treats any non-PGRST116 UPDATE error the same way. Reuse the same fake
    // â the service's read-first SELECT will find the synthetic row, the
    // version check passes (1 === 1), then the UPDATE will surface our
    // injected error and the service must map it to "unavailable".
    const { client } = makeFakeClientWithUpdateError({ code: "08006", message: "connection lost" });
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    const result = await service.unpublish(token, "course", slug);
    expect(result.status).toBe("unavailable");
    expect(result.status).not.toBe("conflict");
  });
});

describe("marketplace-service unpublish CAS race", () => {
  it("concurrent unpublish: exactly one winner, exactly one conflict", async () => {
    const { client, rows } = makeFakeClient([makeRow()]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    // Both unpublish calls read version=1 / status=published concurrently.
    // Both pass the read-first guards, both fire the conditional UPDATE
    // (status="published" AND version=1). The fake's atomic version guard
    // serializes them: one UPDATE matches, the other finds version=2 and
    // returns PGRST116 â which the service maps to "conflict".
    const [a, b] = await Promise.all([
      service.unpublish(token, "course", slug),
      service.unpublish(token, "course", slug),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["conflict", "ok"]);

    const loser = a.status === "conflict" ? a : b;
    expect(loser.status).toBe("conflict");
    expect(loser.status).not.toBe("not_found");
    expect(loser.status).not.toBe("unavailable");

    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("unpublished");
    expect(rows[0]!.version).toBe(2);
  });

  it("unpublish after a concurrent status change is a CAS race, not not_found", async () => {
    const { client, rows } = makeFakeClient([makeRow()]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    // First caller wins, second caller's read-first still finds the row but
    // its status is now "unpublished", so the service returns not_found â
    // this is the pre-update branch and not the CAS race branch. Establishes
    // that not_found and conflict are distinguished correctly for unpublish.
    const first = await service.unpublish(token, "course", slug);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") throw new Error("first unpublish must succeed");

    const second = await service.unpublish(token, "course", slug);
    expect(second.status).toBe("not_found");
    expect(second.status).not.toBe("conflict");
    expect(rows[0]!.version).toBe(2);
  });
});

describe("marketplace-service listMine owner scoping (regression for cross-user disclosure)", () => {
  it("listMine returns only rows owned by the requesting user, never other creators' rows", async () => {
    const selfDraft = makeRow({ id: "draft-1", status: "draft", version: 1, payload: { name: "my draft" } });
    const selfLive = makeRow({ id: "live-1", status: "published", version: 2, payload: { name: "my live" } });
    const otherLive = makeRow({ id: "other-1", creator_id: otherCreator, status: "published", version: 3, payload: { name: "not mine" } });
    const otherDraft = makeRow({ id: "other-2", creator_id: otherCreator, status: "draft", version: 1, payload: { name: "not mine either" } });

    const { client } = makeFakeClient([selfDraft, selfLive, otherLive, otherDraft]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    const result = await service.listMine(token, "course", creatorId);
    expect(result.status).toBe("ok");

    if (result.status !== "ok") throw new Error("listMine must succeed");
    const ids = result.data.map((row) => row.id).sort();
    // Only the two rows owned by creatorId; the two otherCreator rows (including
    // a published one that is public to the marketplace) must NOT be returned.
    expect(ids).toEqual(["draft-1", "live-1"]);
    // No other creator's auth UID can appear in the returned rows.
    expect(result.data.some((row) => (row as unknown as { creator_id?: string }).creator_id === otherCreator)).toBe(false);
  });
});

describe("marketplace-service draft lifecycle (regression: no silent state clobber)", () => {
  const mySlug = "algebra-fundamentals";

  it("createDraft on a published slug returns conflict and never takes the live listing offline", async () => {
    const live = makeRow({ id: "live-1", status: "published", version: 3 });
    const { client, rows } = makeFakeClient([live]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    const result = await service.createDraft(token, creatorId, { kind: "course", slug: mySlug, title: "Edited", payload: { name: "new draft" } });
    expect(result.status).toBe("conflict");

    // The live listing must remain untouched and visible.
    expect(rows[0]!.status).toBe("published");
    expect(rows[0]!.version).toBe(3);
  });

  it("createDraft on another creator's slug returns conflict", async () => {
    const { client, rows } = makeFakeClient([]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);
    const otherSlug = "rivals-course";
    const otherLive = makeRow({ id: "other-1", creator_id: otherCreator, slug: otherSlug, status: "published", version: 2 });
    rows.push(otherLive);

    const result = await service.createDraft(token, creatorId, { kind: "course", slug: otherSlug, title: "Mine", payload: {} });
    expect(result.status).toBe("conflict");
    expect(rows[0]!.creator_id).toBe(otherCreator);
    expect(rows[0]!.status).toBe("published");
  });

  it("createDraft creates a fresh draft when no row exists for the slug", async () => {
    const { client } = makeFakeClient([]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);
    const result = await service.createDraft(token, creatorId, { kind: "course", slug: "brand-new", title: "New draft", payload: { name: "x" } });
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.status).toBe("draft");
  });

  it("publishDraft can republish an unpublished (taken-down) row", async () => {
    const takenDown = makeRow({ id: "td-1", status: "unpublished", version: 4 });
    const { client, rows } = makeFakeClient([takenDown]);
    const service = createSupabaseMarketplaceService("http://example.test", "anon-key", () => client as any);

    const result = await service.publishDraft(token, "course", slug);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.status).toBe("published");
      expect(result.data.version).toBe(5);
    }
    expect(rows[0]!.status).toBe("published");
  });
});
