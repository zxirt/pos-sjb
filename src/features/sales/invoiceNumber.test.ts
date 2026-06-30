import { describe, it, expect } from "vitest";
import { formatNoNota } from "./invoiceNumber";

describe("formatNoNota", () => {
  it("memformat tunai dengan bulan & urut 5 digit", () => {
    expect(formatNoNota("cash", 2026, 6, "A7", 1)).toBe("cash/2026/06/A7-00001");
  });
  it("memformat piutang", () => {
    expect(formatNoNota("piu", 2026, 12, "B", 123)).toBe("piu/2026/12/B-00123");
  });
  it("memformat pembelian", () => {
    expect(formatNoNota("beli", 2026, 1, "XY", 45678)).toBe("beli/2026/01/XY-45678");
  });
  it("urut > 5 digit tidak terpotong", () => {
    expect(formatNoNota("cash", 2026, 6, "A", 123456)).toBe("cash/2026/06/A-123456");
  });
});
