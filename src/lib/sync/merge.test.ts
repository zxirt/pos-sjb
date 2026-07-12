import { describe, it, expect } from "vitest";
import { mergeRow, collectAffectedItems, summarizeMerge } from "./merge";
import type { PullRow } from "./types";

const basePull: PullRow = {
  table: "items",
  id: "abc",
  data: { id: "abc", nama: "Semen", stok: 10, store_id: "s1" },
  deleted: 0,
  updated_at: "2026-06-01T12:00:00Z",
};

describe("mergeRow", () => {
  it("tidak ada lokal → insert", async () => {
    const r = await mergeRow("items", basePull, undefined);
    expect(r.action).toBe("insert");
    expect(r.merged!.nama).toBe("Semen");
    expect(r.merged!.dirty).toBe(0);
    expect(r.merged!.sync_state).toBe("synced");
  });

  it("server deleted & lokal tidak deleted → delete", async () => {
    const del: PullRow = { ...basePull, deleted: 1, data: { ...basePull.data, deleted: 1 } };
    const lokal = { id: "abc", nama: "Semen", deleted: 0, updated_at: "2026-01-01T00:00:00Z" };
    const r = await mergeRow("items", del, lokal);
    expect(r.action).toBe("delete");
    expect(r.merged!.deleted).toBe(1);
  });

  it("server deleted & lokal sudah deleted → skip", async () => {
    const del: PullRow = { ...basePull, deleted: 1, data: { ...basePull.data, deleted: 1 } };
    const lokal = { id: "abc", deleted: 1, updated_at: "2026-01-01T00:00:00Z" };
    const r = await mergeRow("items", del, lokal);
    expect(r.action).toBe("skip");
  });

  it("server lebih baru dari lokal → update", async () => {
    const lokal = { id: "abc", nama: "Semen", updated_at: "2026-01-01T00:00:00Z", deleted: 0 };
    const r = await mergeRow("items", basePull, lokal);
    expect(r.action).toBe("update");
    expect(r.reason).toContain("server lebih baru");
  });

  it("server sama updated_at → skip", async () => {
    const lokal = { id: "abc", nama: "Semen", updated_at: "2026-06-01T12:00:00Z", deleted: 0 };
    const r = await mergeRow("items", basePull, lokal);
    expect(r.action).toBe("skip");
  });

  it("lokal lebih baru → skip (akan push nanti)", async () => {
    const lokal = { id: "abc", nama: "Semen", updated_at: "2026-07-01T00:00:00Z", deleted: 0 };
    const r = await mergeRow("items", basePull, lokal);
    expect(r.action).toBe("skip");
    expect(r.reason).toContain("lokal lebih baru");
  });
});

describe("collectAffectedItems", () => {
  it("kumpulkan item_id dari stock_ledger", () => {
    const rows: PullRow[] = [
      { table: "stock_ledger", id: "l1", data: { item_id: "item1" }, deleted: 0, updated_at: "x" },
      { table: "stock_ledger", id: "l2", data: { item_id: "item2" }, deleted: 0, updated_at: "x" },
    ];
    expect(collectAffectedItems(rows)).toEqual(new Set(["item1", "item2"]));
  });

  it("abaikan baris non-stock_ledger tanpa item_id", () => {
    const rows: PullRow[] = [
      { table: "items", id: "i1", data: { id: "item1" }, deleted: 0, updated_at: "x" },
    ];
    expect(collectAffectedItems(rows)).toEqual(new Set(["item1"]));
  });

  it("kembalikan set kosong bila tidak ada", () => {
    const rows: PullRow[] = [
      { table: "categories", id: "c1", data: { nama: "Cat" }, deleted: 0, updated_at: "x" },
    ];
    expect(collectAffectedItems(rows)).toEqual(new Set());
  });
});

describe("summarizeMerge", () => {
  it("format summary", () => {
    const s = summarizeMerge({ inserted: 5, updated: 3, deleted: 1, errors: [] });
    expect(s).toContain("+5");
    expect(s).toContain("~3");
    expect(s).toContain("-1");
  });
});
