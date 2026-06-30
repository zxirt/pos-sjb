import { db } from "@/db/db";
import { deviceCode } from "@/lib/device";

/**
 * Nomor nota: <prefix>/<tahun>/<bulan>/<perangkat>-<urut5digit>
 * contoh: cash/2026/06/A7-00001
 *
 * - prefix membedakan jenis transaksi: cash (tunai), piu (piutang), beli (pembelian).
 * - kode perangkat menjamin unik antar-perangkat saat offline (lihat lib/device.ts).
 * - urut di-reset PER BULAN per (prefix+perangkat), 5 digit.
 *
 * Counter disimpan di tabel Dexie lokal-saja `counters` (tidak ikut sync), key =
 * "<prefix>:<YYYY-MM>:<perangkat>".
 */

export type InvoicePrefix = "cash" | "piu" | "beli";

/** Susun string nomor nota dari komponennya (murni, mudah di-test). */
export function formatNoNota(
  prefix: InvoicePrefix,
  tahun: number,
  bulan: number, // 1-12
  perangkat: string,
  urut: number,
): string {
  const bb = String(bulan).padStart(2, "0");
  const nn = String(urut).padStart(5, "0");
  return `${prefix}/${tahun}/${bb}/${perangkat}-${nn}`;
}

function counterKey(prefix: InvoicePrefix, tahun: number, bulan: number, dev: string): string {
  const bb = String(bulan).padStart(2, "0");
  return `${prefix}:${tahun}-${bb}:${dev}`;
}

/**
 * Ambil nomor nota berikutnya untuk `prefix` pada `tanggal` (default sekarang).
 * Menaikkan counter secara atomik dalam transaksi Dexie agar tak ada nomor
 * kembar walau dua checkout berdekatan.
 */
export async function nextNoNota(
  prefix: InvoicePrefix,
  tanggal: Date = new Date(),
): Promise<string> {
  const tahun = tanggal.getFullYear();
  const bulan = tanggal.getMonth() + 1;
  const dev = deviceCode();
  const key = counterKey(prefix, tahun, bulan, dev);

  let urut = 1;
  await db.transaction("rw", db.counters, async () => {
    const row = await db.counters.get(key);
    urut = (row?.value ?? 0) + 1;
    await db.counters.put({ key, value: urut });
  });

  return formatNoNota(prefix, tahun, bulan, dev, urut);
}
