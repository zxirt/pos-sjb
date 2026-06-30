import { describe, it, expect } from "vitest";
import {
  hargaJualDariMargin,
  marginDariHargaJual,
  applyHargaChange,
  hargaPokokDasar,
  qtyKeSatuanDasar,
  type HargaState,
} from "./pricing";

describe("margin 2 arah", () => {
  it("harga jual dari margin", () => {
    expect(hargaJualDariMargin(50000, 20)).toBe(60000);
  });

  it("margin dari harga jual", () => {
    expect(marginDariHargaJual(50000, 60000)).toBe(20);
  });

  it("ubah margin → harga jual ikut", () => {
    const prev: HargaState = {
      hargaBeli: 50000,
      hargaJual: 60000,
      marginPersen: 20,
      basis: "margin",
    };
    const next = applyHargaChange(prev, { marginPersen: 30 });
    expect(next.hargaJual).toBe(65000);
  });

  it("ubah harga jual → margin ikut", () => {
    const prev: HargaState = {
      hargaBeli: 50000,
      hargaJual: 60000,
      marginPersen: 20,
      basis: "harga_jual",
    };
    const next = applyHargaChange(prev, { hargaJual: 75000 });
    expect(next.marginPersen).toBe(50);
  });

  it("harga beli berubah, basis margin dipertahankan → harga jual menyesuaikan", () => {
    const prev: HargaState = {
      hargaBeli: 50000,
      hargaJual: 60000,
      marginPersen: 20,
      basis: "margin",
    };
    const next = applyHargaChange(prev, { hargaBeli: 100000 });
    expect(next.hargaJual).toBe(120000); // 100000 × 1.2
    expect(next.marginPersen).toBe(20);
  });

  it("harga beli berubah, basis harga jual dipertahankan → margin menyesuaikan", () => {
    const prev: HargaState = {
      hargaBeli: 50000,
      hargaJual: 60000,
      marginPersen: 20,
      basis: "harga_jual",
    };
    const next = applyHargaChange(prev, { hargaBeli: 40000 });
    expect(next.hargaJual).toBe(60000);
    expect(next.marginPersen).toBe(50); // (60000-40000)/40000
  });
});

describe("konversi satuan", () => {
  it("harga pokok dasar dari satuan besar", () => {
    // 1 TRUK = 200 ZAK seharga 9.500.000 → 47.500 / ZAK
    expect(hargaPokokDasar(9_500_000, 200)).toBe(47500);
  });

  it("konversi 0 aman", () => {
    expect(hargaPokokDasar(100000, 0)).toBe(0);
  });

  it("qty satuan besar → satuan dasar", () => {
    expect(qtyKeSatuanDasar(2, 200)).toBe(400); // 2 truk = 400 zak
  });
});
