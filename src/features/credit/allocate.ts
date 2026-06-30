/**
 * Alokasi satu pembayaran ke beberapa tagihan (piutang/hutang) — MURNI.
 * Tertua dulu (FIFO): tagihan dengan urutan paling awal dilunasi lebih dulu
 * sampai uang habis. Dipakai pelunasan per-pihak (per customer/supplier).
 */

export interface TagihanAlokasi {
  id: string;
  sisa: number; // sisa tagihan saat ini (> 0)
}

export interface HasilAlokasi {
  id: string;
  bayar: number; // porsi yang dialokasikan ke tagihan ini (> 0)
}

/**
 * Bagi `jumlah` ke daftar tagihan (urut sesuai input = tertua dulu).
 * Mengembalikan hanya tagihan yang kebagian (bayar > 0). Sisa uang yang tak
 * terpakai (jumlah > total sisa) diabaikan.
 */
export function alokasiFifo(jumlah: number, tagihan: TagihanAlokasi[]): HasilAlokasi[] {
  let sisaUang = Math.max(0, jumlah);
  const hasil: HasilAlokasi[] = [];
  for (const t of tagihan) {
    if (sisaUang <= 0) break;
    if (t.sisa <= 0) continue;
    const bayar = Math.min(sisaUang, t.sisa);
    hasil.push({ id: t.id, bayar });
    sisaUang -= bayar;
  }
  return hasil;
}

/** Total sisa seluruh tagihan. */
export function totalSisa(tagihan: TagihanAlokasi[]): number {
  return tagihan.reduce((s, t) => s + Math.max(0, t.sisa), 0);
}
