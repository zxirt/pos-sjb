import { describe, it, expect } from "vitest";
import {
  hargaGrosirBerlaku,
  hargaEfektif,
  lineSubtotal,
  cartTotals,
  totalBiaya,
  diBawahModal,
  addLine,
  setQty,
  setHarga,
  setDiskonNominal,
  setDiskonPersen,
  removeLine,
  type CartLine,
} from "./cart";

/** Pembuat baris uji ringkas (tanpa newId agar deterministik). */
function line(over: Partial<CartLine> = {}): CartLine {
  return {
    key: over.key ?? "k1",
    item_id: "i1",
    nama: "Semen",
    satuan: "ZAK",
    konversi: 1,
    qty: 1,
    harga: 50000,
    harga_default: 50000,
    harga_beli: 45000,
    harga_grosir: [],
    harga_override: false,
    diskon_nominal: 0,
    diskon_persen: 0,
    ...over,
  };
}

describe("harga grosir", () => {
  const grosir = [
    { harga: 48000, min_qty: 5 },
    { harga: 46000, min_qty: 10 },
  ];

  it("tak berlaku di bawah min_qty terendah", () => {
    expect(hargaGrosirBerlaku(grosir, 3)).toBeNull();
  });

  it("pilih tingkat sesuai qty", () => {
    expect(hargaGrosirBerlaku(grosir, 6)).toBe(48000);
  });

  it("pilih tingkat tertinggi yang terpenuhi (harga terendah)", () => {
    expect(hargaGrosirBerlaku(grosir, 12)).toBe(46000);
  });

  it("hargaEfektif pakai grosir otomatis", () => {
    const l = line({ qty: 10, harga_grosir: grosir });
    expect(hargaEfektif(l)).toBe(46000);
  });

  it("override manual mematikan auto-grosir", () => {
    const l = line({ qty: 10, harga_grosir: grosir, harga: 49000, harga_override: true });
    expect(hargaEfektif(l)).toBe(49000);
  });
});

describe("subtotal baris & diskon", () => {
  it("subtotal = harga × qty tanpa diskon", () => {
    expect(lineSubtotal(line({ qty: 3 }))).toBe(150000);
  });

  it("diskon nominal mengurangi subtotal", () => {
    expect(lineSubtotal(line({ qty: 2, diskon_nominal: 10000 }))).toBe(90000);
  });

  it("diskon persen dibulatkan ke rupiah", () => {
    // 50000 × 1 = 50000, diskon 10% = 5000 → 45000
    expect(lineSubtotal(line({ diskon_persen: 10 }))).toBe(45000);
  });

  it("subtotal tak pernah negatif", () => {
    expect(lineSubtotal(line({ diskon_nominal: 999999 }))).toBe(0);
  });
});

describe("total keranjang", () => {
  it("menjumlah subtotal & diskon seluruh baris", () => {
    const lines = [
      line({ key: "a", qty: 2 }), // 100000
      line({ key: "b", qty: 1, diskon_nominal: 5000 }), // 45000
    ];
    const t = cartTotals(lines);
    expect(t.subtotal).toBe(150000);
    expect(t.diskon).toBe(5000);
    expect(t.barang).toBe(145000);
    expect(t.biaya).toBe(0);
    expect(t.total).toBe(145000);
    expect(t.jumlahItem).toBe(2);
    expect(t.jumlahQty).toBe(3);
  });

  it("biaya tambahan masuk ke grand total (bukan ke barang)", () => {
    const lines = [line({ key: "a", qty: 2 })]; // barang 100000
    const t = cartTotals(lines, [
      { label: "Ongkir", nominal: 25000 },
      { label: "Buruh", nominal: 15000 },
    ]);
    expect(t.barang).toBe(100000);
    expect(t.biaya).toBe(40000);
    expect(t.total).toBe(140000);
  });

  it("biaya nominal negatif diabaikan (tak mengurangi total)", () => {
    const t = cartTotals([], [{ label: "x", nominal: -5000 }]);
    expect(t.biaya).toBe(0);
    expect(t.total).toBe(0);
  });

  it("totalBiaya menjumlah seluruh biaya", () => {
    expect(
      totalBiaya([
        { label: "a", nominal: 1000 },
        { label: "b", nominal: 2000 },
      ]),
    ).toBe(3000);
  });
});

describe("di bawah modal", () => {
  it("true bila harga < harga_beli", () => {
    expect(diBawahModal(line({ harga: 40000, harga_override: true }))).toBe(true);
  });
  it("false bila harga >= harga_beli", () => {
    expect(diBawahModal(line({ harga: 45000, harga_override: true }))).toBe(false);
  });
});

describe("operasi keranjang", () => {
  it("addLine menggabung item+satuan sama menambah qty", () => {
    const a = line({ key: "a", qty: 2 });
    const b = line({ key: "b", qty: 3 });
    const res = addLine([a], b);
    expect(res).toHaveLength(1);
    expect(res[0].qty).toBe(5);
  });

  it("addLine tidak menggabung bila salah satu override", () => {
    const a = line({ key: "a", qty: 2, harga_override: true });
    const b = line({ key: "b", qty: 3 });
    expect(addLine([a], b)).toHaveLength(2);
  });

  it("setQty, setHarga (override), setDiskon, removeLine", () => {
    let lines = [line({ key: "a" })];
    lines = setQty(lines, "a", 5);
    expect(lines[0].qty).toBe(5);

    lines = setHarga(lines, "a", 40000);
    expect(lines[0].harga).toBe(40000);
    expect(lines[0].harga_override).toBe(true);

    lines = setDiskonNominal(lines, "a", 1000);
    expect(lines[0].diskon_nominal).toBe(1000);
    expect(lines[0].diskon_persen).toBe(0);

    lines = setDiskonPersen(lines, "a", 5);
    expect(lines[0].diskon_persen).toBe(5);
    expect(lines[0].diskon_nominal).toBe(0);

    lines = removeLine(lines, "a");
    expect(lines).toHaveLength(0);
  });
});
