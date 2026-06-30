import { db } from "@/db/db";
import { newSyncBase } from "@/db/helpers";
import type { StockLedger, LedgerReason } from "@/db/types";

/**
 * Stok berbasis delta (append-only ledger). Delta SELALU dalam satuan dasar.
 * items.stok adalah proyeksi cache = jumlah seluruh delta non-deleted.
 *
 * Pola ini mencegah "penjualan hilang": dua perangkat yang menjual barang
 * sama secara offline masing-masing menulis baris delta; jumlahnya tetap benar
 * berapa pun urutan sinkronisasinya.
 */

export interface LedgerInput {
  item_id: string;
  delta: number; // satuan dasar; negatif = keluar, positif = masuk
  reason: LedgerReason;
  ref_id?: string | null;
  supplier_id?: string | null;
  harga_beli?: number | null;
}

/** Buat objek baris ledger (belum ditulis ke DB). */
export function buildLedgerRow(input: LedgerInput): StockLedger {
  return {
    ...newSyncBase(),
    item_id: input.item_id,
    delta: input.delta,
    reason: input.reason,
    ref_id: input.ref_id ?? null,
    supplier_id: input.supplier_id ?? null,
    harga_beli: input.harga_beli ?? null,
  };
}

/** Hitung ulang stok cache satu item dari seluruh ledger-nya. */
export async function recomputeStock(itemId: string): Promise<number> {
  const rows = await db.stock_ledger.where("item_id").equals(itemId).toArray();
  const total = rows
    .filter((r) => r.deleted === 0)
    .reduce((sum, r) => sum + r.delta, 0);
  await db.items.update(itemId, { stok: total });
  return total;
}

/**
 * Tulis satu/lebih baris ledger lalu hitung ulang stok terkait,
 * semua dalam satu transaksi Dexie (atomik).
 */
export async function applyLedger(inputs: LedgerInput[]): Promise<void> {
  const rows = inputs.map(buildLedgerRow);
  await db.transaction("rw", db.stock_ledger, db.items, async () => {
    await db.stock_ledger.bulkAdd(rows);
    const itemIds = [...new Set(inputs.map((i) => i.item_id))];
    for (const id of itemIds) await recomputeStock(id);
  });
}
