/**
 * Logika harga ↔ margin (2 arah) dan konversi satuan.
 * Murni (tanpa efek samping) agar mudah di-unit-test.
 *
 * Aturan margin:
 *   hargaJual = hargaBeli × (1 + margin/100)
 *   margin    = (hargaJual − hargaBeli) / hargaBeli × 100
 *
 * - Ubah margin  → hitung ulang harga jual.
 * - Ubah harga jual → hitung ulang margin.
 * - Harga beli berubah → field basis ('margin' | 'harga_jual') dipertahankan,
 *   yang satunya ikut menyesuaikan.
 */

export type BasisHarga = "margin" | "harga_jual";

/** Margin disimpan 1 desimal (mis. 26.3). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Harga jual dari harga beli + margin %. Hasil dibulatkan ke rupiah integer. */
export function hargaJualDariMargin(hargaBeli: number, marginPersen: number): number {
  if (hargaBeli <= 0) return 0;
  return Math.round(hargaBeli * (1 + marginPersen / 100));
}

/** Margin % dari harga beli + harga jual. */
export function marginDariHargaJual(hargaBeli: number, hargaJual: number): number {
  if (hargaBeli <= 0) return 0;
  return round1(((hargaJual - hargaBeli) / hargaBeli) * 100);
}

/** Laba per unit. */
export function laba(hargaBeli: number, hargaJual: number): number {
  return hargaJual - hargaBeli;
}

export interface HargaState {
  hargaBeli: number;
  hargaJual: number;
  marginPersen: number;
  basis: BasisHarga;
}

/**
 * Terapkan perubahan pada salah satu field dan hitung ulang yang terkait.
 * Mengembalikan state baru (immutable).
 */
export function applyHargaChange(
  prev: HargaState,
  change: Partial<Pick<HargaState, "hargaBeli" | "hargaJual" | "marginPersen" | "basis">>,
): HargaState {
  const next = { ...prev, ...change };

  if (change.marginPersen !== undefined) {
    next.hargaJual = hargaJualDariMargin(next.hargaBeli, next.marginPersen);
    return next;
  }
  if (change.hargaJual !== undefined) {
    next.marginPersen = marginDariHargaJual(next.hargaBeli, next.hargaJual);
    return next;
  }
  if (change.hargaBeli !== undefined) {
    // Pertahankan basis yang dipilih, yang satunya ikut.
    if (next.basis === "margin") {
      next.hargaJual = hargaJualDariMargin(next.hargaBeli, next.marginPersen);
    } else {
      next.marginPersen = marginDariHargaJual(next.hargaBeli, next.hargaJual);
    }
  }
  return next;
}

/**
 * Konversi satuan: harga pokok (modal) per satuan dasar dari satuan besar.
 * Mis. 1 TRUK = 200 ZAK seharga Rp 9.500.000 → Rp 47.500 / ZAK.
 */
export function hargaPokokDasar(hargaBeliSatuanBesar: number, konversi: number): number {
  if (konversi <= 0) return 0;
  return Math.round(hargaBeliSatuanBesar / konversi);
}

/** Konversi qty satuan besar → satuan dasar (untuk potong stok). */
export function qtyKeSatuanDasar(qty: number, konversi: number): number {
  return qty * konversi;
}
