import type { StatusTransaksi } from "@/db/types";

/**
 * Logika pembayaran — MURNI (tanpa Dexie) agar mudah di-unit-test.
 * Dipakai untuk piutang (receivables) DAN hutang (payables): keduanya punya
 * `jumlah` (total tagihan) dan menerima pembayaran (`payments`) yang mengurangi
 * sisa. Sisa & status diturunkan dari jumlah − Σ pembayaran, bukan ditimpa
 * lewat banyak jalur (mengurangi peluang drift bila pembayaran disinkron).
 */

/** Total seluruh pembayaran (tak pernah negatif). */
export function totalDibayar(pembayaran: number[]): number {
  return pembayaran.reduce((s, n) => s + Math.max(0, n), 0);
}

/** Sisa tagihan setelah pembayaran. Tak pernah negatif (kelebihan diabaikan). */
export function hitungSisa(jumlah: number, pembayaran: number[]): number {
  return Math.max(0, jumlah - totalDibayar(pembayaran));
}

/**
 * Status tagihan dari jumlah & total dibayar:
 * - belum: belum ada pembayaran sama sekali
 * - sebagian: sudah bayar tapi belum lunas
 * - lunas: total dibayar ≥ jumlah
 */
export function hitungStatus(jumlah: number, pembayaran: number[]): StatusTransaksi {
  const dibayar = totalDibayar(pembayaran);
  if (dibayar <= 0) return "belum";
  if (dibayar >= jumlah) return "lunas";
  return "sebagian";
}

/** Apakah tagihan terlambat? (punya jatuh tempo, sudah lewat, belum lunas). */
export function terlambat(
  jatuhTempo: string | null,
  status: StatusTransaksi,
  sekarang: Date,
): boolean {
  if (!jatuhTempo || status === "lunas") return false;
  return new Date(jatuhTempo).getTime() < sekarang.getTime();
}
