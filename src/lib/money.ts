/**
 * Uang disimpan sebagai INTEGER Rupiah (tanpa desimal) di seluruh aplikasi
 * untuk menghindari drift float. Format hanya dilakukan di lapisan tampilan.
 */

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const idrPlain = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Rp 50.000 */
export function formatRupiah(n: number): string {
  if (!Number.isFinite(n)) return "Rp 0";
  return idr.format(Math.round(n));
}

/** 50.000 (tanpa simbol, untuk input/tabel) */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return idrPlain.format(Math.round(n));
}

/** Bersihkan string input ("Rp 50.000") menjadi angka integer. */
export function parseRupiah(s: string): number {
  const digits = s.replace(/[^\d-]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Pembulatan integer rupiah yang eksplisit (dipakai pada diskon persen). */
export function roundRupiah(n: number): number {
  return Math.round(n);
}
