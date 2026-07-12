import { describe, it, expect } from "vitest";
import {
  stripLocal,
  toRemote,
  fromRemote,
  isDirty,
  isValidSyncTable,
  getRecordFields,
  buildUpsertWhere,
  normalizeTimestamp,
  hasRealChange,
} from "./clean";
import type { PullRow } from "./types";

describe("stripLocal", () => {
  it("hapus dirty dan sync_state dan updated_at", () => {
    const record = {
      id: "abc",
      nama: "Semen",
      dirty: 1,
      sync_state: "pending",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(stripLocal(record)).toEqual({ id: "abc", nama: "Semen" });
  });

  it("pertahankan field lain", () => {
    const record = { id: "x", store_id: "y", harga: 50000, deleted: 0 };
    expect(stripLocal(record)).toEqual(record);
  });
});

describe("toRemote", () => {
  it("konversi record ke PushRow", () => {
    const record = {
      id: "abc",
      store_id: "s1",
      nama: "Semen",
      dirty: 1,
      sync_state: "pending",
      updated_at: "2026-01-01T00:00:00Z",
      deleted: 0,
    };
    const result = toRemote("items", record);
    expect(result.table).toBe("items");
    expect(result.id).toBe("abc");
    expect(result.data).toEqual({ id: "abc", store_id: "s1", nama: "Semen", deleted: 0 });
    expect(result.deleted).toBe(0);
  });

  it("default deleted = 0", () => {
    const record = { id: "abc" };
    const result = toRemote("items", record);
    expect(result.deleted).toBe(0);
  });
});

describe("fromRemote", () => {
  const basePullRow: PullRow = {
    table: "items",
    id: "abc",
    data: { id: "abc", store_id: "s1", nama: "Semen", stok: 10, deleted: 0 },
    deleted: 0,
    updated_at: "2026-06-01T10:00:00Z",
  };

  it("server aktif: merged record dengan dirty=0, sync_state=synced", () => {
    const result = fromRemote(basePullRow);
    expect(result.dirty).toBe(0);
    expect(result.sync_state).toBe("synced");
    expect(result.updated_at).toBe("2026-06-01T10:00:00Z");
    expect(result.nama).toBe("Semen");
  });

  it("server deleted: merged dengan deleted=1, tetap synced", () => {
    const pullRow: PullRow = { ...basePullRow, deleted: 1, data: { ...basePullRow.data, deleted: 1 } };
    const local = { id: "abc", deleted: 0, dirty: 1 };
    const result = fromRemote(pullRow, local);
    expect(result.deleted).toBe(1);
    expect(result.dirty).toBe(0);
    expect(result.sync_state).toBe("synced");
  });

  it("tanpa local record: field dari data server", () => {
    const result = fromRemote(basePullRow);
    expect(result.nama).toBe("Semen");
    expect(result.stok).toBe(10);
  });
});

describe("isDirty", () => {
  it("dirty=1 dan sync_state bukan syncing → true", () => {
    expect(isDirty({ dirty: 1, sync_state: "pending" })).toBe(true);
  });

  it("dirty=0 → false", () => {
    expect(isDirty({ dirty: 0, sync_state: "synced" })).toBe(false);
  });

  it("sync_state=syncing → false", () => {
    expect(isDirty({ dirty: 1, sync_state: "syncing" })).toBe(false);
  });

  it("tanpa dirty → false", () => {
    expect(isDirty({})).toBe(false);
  });
});

describe("isValidSyncTable", () => {
  it("items valid", () => {
    expect(isValidSyncTable("items")).toBe(true);
  });

  it("tabel tidak dikenal invalid", () => {
    expect(isValidSyncTable("foo")).toBe(false);
  });
});

describe("getRecordFields", () => {
  it("kembalikan field tanpa dirty/sync_state/updated_at", () => {
    const record = { id: "x", nama: "Semen", dirty: 1, sync_state: "pending", updated_at: "x" };
    const fields = getRecordFields(record);
    expect(fields).toEqual([
      { name: "id", value: "x" },
      { name: "nama", value: "Semen" },
    ]);
  });
});

describe("buildUpsertWhere", () => {
  it("kembalikan { id }", () => {
    expect(buildUpsertWhere("items", "abc")).toEqual({ id: "abc" });
  });
});

describe("normalizeTimestamp", () => {
  it("string iso dipertahankan", () => {
    expect(normalizeTimestamp("2026-01-01T00:00:00Z")).toBe("2026-01-01T00:00:00Z");
  });

  it("undefined → sekarang (ISO)", () => {
    const result = normalizeTimestamp();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("hasRealChange", () => {
  it("deteksi perubahan nyata", () => {
    const before = { id: "x", nama: "Semen", dirty: 1 };
    const after = { id: "x", nama: "Pasir", dirty: 0 };
    expect(hasRealChange(before, after)).toBe(true);
  });

  it("hanya perubahan dirty → false", () => {
    const before = { id: "x", nama: "Semen", dirty: 1 };
    const after = { id: "x", nama: "Semen", dirty: 0 };
    expect(hasRealChange(before, after)).toBe(false);
  });
});
