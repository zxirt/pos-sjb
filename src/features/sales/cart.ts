import type { Item, ItemUnit, HargaGrosir, BiayaTambahan } from "@/db/types";
import { newId } from "@/lib/uuid";
import { roundRupiah } from "@/lib/money";

/**
 * Logika keranjang — MURNI (tanpa Dexie/efek samping) agar mudah di-unit-test.
 * Komponen React menyimpan `CartLine[]` di state dan memanggil fungsi-fungsi ini.
 *
 * Diskon Fase 3 = per-baris item (bukan per-transaksi). Tiap baris bisa diskon
 * nominal ATAU persen. Harga grosir diterapkan otomatis berdasar qty kecuali
 * harga baris sudah di-override manual.
 */

export interface CartLine {
  key: string; // unik per baris keranjang
  item_id: string | null; // null = item manual (tanpa master, tak potong stok)
  nama: string;
  satuan: string; // satuan yang dijual
  konversi: number; // 1 satuan ini = `konversi` satuan dasar
  qty: number;
  harga: number; // harga jual per satuan (yang dipakai)
  harga_default: number; // harga acuan (master) untuk satuan ini
  harga_beli: number; // modal per satuan ini (untuk warning < modal)
  harga_grosir: HargaGrosir[]; // tingkat grosir untuk satuan ini (dlm harga satuan ini)
  harga_override: boolean; // true bila kasir/pemilik mengubah harga manual → matikan auto-grosir
  diskon_nominal: number; // diskon baris (IDR), 0 jika pakai persen
  diskon_persen: number; // diskon baris (%), 0 jika pakai nominal
}

/**
 * Pilih harga grosir tertinggi (harga terendah) yang min_qty-nya terpenuhi.
 * Kembalikan null bila tak ada tingkat yang berlaku.
 */
export function hargaGrosirBerlaku(
  grosir: HargaGrosir[],
  qty: number,
): number | null {
  const berlaku = grosir
    .filter((g) => g.min_qty > 0 && qty >= g.min_qty)
    .sort((a, b) => b.min_qty - a.min_qty);
  return berlaku.length ? berlaku[0].harga : null;
}

/** Harga efektif per satuan untuk sebuah baris (auto-grosir jika tak di-override). */
export function hargaEfektif(line: CartLine): number {
  if (line.harga_override) return line.harga;
  const g = hargaGrosirBerlaku(line.harga_grosir, line.qty);
  return g ?? line.harga_default;
}

/** Subtotal baris setelah diskon baris. Tak pernah negatif. */
export function lineSubtotal(line: CartLine): number {
  const kotor = hargaEfektif(line) * line.qty;
  const diskon =
    line.diskon_persen > 0
      ? roundRupiah((kotor * line.diskon_persen) / 100)
      : line.diskon_nominal;
  return Math.max(0, kotor - diskon);
}

export interface CartTotals {
  subtotal: number; // jumlah kotor barang (sebelum diskon baris)
  diskon: number; // total diskon seluruh baris
  barang: number; // jumlah subtotal baris barang (setelah diskon)
  biaya: number; // total biaya tambahan
  total: number; // grand total = barang + biaya
  jumlahItem: number; // jumlah baris barang
  jumlahQty: number; // total qty seluruh baris
}

/** Total seluruh biaya tambahan (tak pernah negatif). */
export function totalBiaya(biaya: BiayaTambahan[]): number {
  return biaya.reduce((s, b) => s + Math.max(0, b.nominal), 0);
}

export function cartTotals(lines: CartLine[], biaya: BiayaTambahan[] = []): CartTotals {
  let subtotal = 0;
  let barang = 0;
  let jumlahQty = 0;
  for (const l of lines) {
    subtotal += hargaEfektif(l) * l.qty;
    barang += lineSubtotal(l);
    jumlahQty += l.qty;
  }
  const biayaTot = totalBiaya(biaya);
  return {
    subtotal,
    diskon: subtotal - barang,
    barang,
    biaya: biayaTot,
    total: barang + biayaTot,
    jumlahItem: lines.length,
    jumlahQty,
  };
}

/** Apakah harga baris di bawah modal (rugi)? */
export function diBawahModal(line: CartLine): boolean {
  return line.harga_beli > 0 && hargaEfektif(line) < line.harga_beli;
}

// ── Builder baris ────────────────────────────────────────────────────────

/** Baris dari item master pada SATUAN DASAR. */
export function lineFromItem(item: Item): CartLine {
  return {
    key: newId(),
    item_id: item.id,
    nama: item.nama,
    satuan: item.satuan_dasar,
    konversi: 1,
    qty: 1,
    harga: item.harga_jual,
    harga_default: item.harga_jual,
    harga_beli: item.harga_beli,
    harga_grosir: item.harga_grosir ?? [],
    harga_override: false,
    diskon_nominal: 0,
    diskon_persen: 0,
  };
}

/** Baris dari item master pada SATUAN KONVERSI (DUS/ZAK/TRUK/dst). */
export function lineFromItemUnit(item: Item, unit: ItemUnit): CartLine {
  return {
    key: newId(),
    item_id: item.id,
    nama: item.nama,
    satuan: unit.satuan,
    konversi: unit.konversi,
    qty: 1,
    harga: unit.harga_jual,
    harga_default: unit.harga_jual,
    harga_beli: unit.harga_beli,
    harga_grosir: [], // grosir per-satuan-konversi belum didukung di data; pakai harga unit
    harga_override: false,
    diskon_nominal: 0,
    diskon_persen: 0,
  };
}

/** Bangun CartLine dari TransactionItem tersimpan (untuk EDIT transaksi). */
export function lineFromTransactionItem(it: {
  item_id: string | null;
  nama: string;
  satuan: string;
  konversi: number;
  qty: number;
  harga: number;
  diskon_nominal: number;
  diskon_persen: number;
}): CartLine {
  return {
    key: newId(),
    item_id: it.item_id,
    nama: it.nama,
    satuan: it.satuan,
    konversi: it.konversi,
    qty: it.qty,
    harga: it.harga,
    harga_default: it.harga,
    harga_beli: 0,
    harga_grosir: [],
    harga_override: true, // pertahankan harga tersimpan apa adanya saat edit
    diskon_nominal: it.diskon_nominal,
    diskon_persen: it.diskon_persen,
  };
}

/** Baris manual (tanpa master) — tak potong stok saat checkout. */
export function lineManual(nama: string, harga: number, satuan = "PCS"): CartLine {
  return {
    key: newId(),
    item_id: null,
    nama: nama.trim() || "Item manual",
    satuan,
    konversi: 1,
    qty: 1,
    harga,
    harga_default: harga,
    harga_beli: 0,
    harga_grosir: [],
    harga_override: true, // manual = harga bebas
    diskon_nominal: 0,
    diskon_persen: 0,
  };
}

// ── Operasi keranjang (immutable) ────────────────────────────────────────

/**
 * Tambah baris. Bila item+satuan yang sama sudah ada (dan bukan override khusus),
 * tambahkan qty-nya agar keranjang ringkas.
 */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  if (line.item_id) {
    const idx = lines.findIndex(
      (l) =>
        l.item_id === line.item_id &&
        l.satuan === line.satuan &&
        !l.harga_override &&
        !line.harga_override,
    );
    if (idx >= 0) {
      const next = lines.slice();
      next[idx] = { ...next[idx], qty: next[idx].qty + line.qty };
      return next;
    }
  }
  return [...lines, line];
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => l.key !== key);
}

function patch(lines: CartLine[], key: string, p: Partial<CartLine>): CartLine[] {
  return lines.map((l) => (l.key === key ? { ...l, ...p } : l));
}

export function setQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  return patch(lines, key, { qty: Math.max(0, qty) });
}

/** Ubah harga manual → tandai override agar auto-grosir nonaktif untuk baris itu. */
export function setHarga(lines: CartLine[], key: string, harga: number): CartLine[] {
  return patch(lines, key, { harga: Math.max(0, harga), harga_override: true });
}

export function setDiskonNominal(
  lines: CartLine[],
  key: string,
  nominal: number,
): CartLine[] {
  return patch(lines, key, {
    diskon_nominal: Math.max(0, nominal),
    diskon_persen: 0,
  });
}

export function setDiskonPersen(
  lines: CartLine[],
  key: string,
  persen: number,
): CartLine[] {
  return patch(lines, key, {
    diskon_persen: Math.min(100, Math.max(0, persen)),
    diskon_nominal: 0,
  });
}
