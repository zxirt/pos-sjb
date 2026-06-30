import { describe, it, expect } from "vitest";
import { alokasiFifo, totalSisa } from "./allocate";

const T = (id: string, sisa: number) => ({ id, sisa });

describe("alokasiFifo", () => {
  it("melunasi tagihan tertua dulu sampai uang habis", () => {
    const r = alokasiFifo(700000, [T("a", 500000), T("b", 300000)]);
    expect(r).toEqual([
      { id: "a", bayar: 500000 },
      { id: "b", bayar: 200000 },
    ]);
  });
  it("hanya sebagian bila uang < tagihan pertama", () => {
    expect(alokasiFifo(200000, [T("a", 500000)])).toEqual([{ id: "a", bayar: 200000 }]);
  });
  it("mengabaikan kelebihan uang", () => {
    expect(alokasiFifo(900000, [T("a", 500000), T("b", 300000)])).toEqual([
      { id: "a", bayar: 500000 },
      { id: "b", bayar: 300000 },
    ]);
  });
  it("melewati tagihan ber-sisa 0", () => {
    expect(alokasiFifo(100000, [T("a", 0), T("b", 300000)])).toEqual([
      { id: "b", bayar: 100000 },
    ]);
  });
  it("jumlah 0 → tak ada alokasi", () => {
    expect(alokasiFifo(0, [T("a", 500000)])).toEqual([]);
  });
});

describe("totalSisa", () => {
  it("menjumlahkan sisa", () => {
    expect(totalSisa([T("a", 500000), T("b", 300000)])).toBe(800000);
  });
});
