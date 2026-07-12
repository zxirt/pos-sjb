/**
 * Sync merge logic & stock ledger recompute
 * LWW: server-side `updated_at` wins (klien tidak override)
 * Stock ledger: append-only, recompute delta sum setelah pull
 */

import { db } from "@/db/db";
import type {
  PullRow,
  SyncTableName,
  MergeResult,
  StockRecomputeResult,
} from "./types";
import { fromRemote } from "./clean";

/**
 * Merge single row: bandingkan server vs lokal, apply LWW jika perlu
 * Strategy: server ALWAYS wins (server updated_at adalah authority)
 *
 * @param table table name
 * @param pullRow dari server
 * @param localRecord record lokal saat ini (undefined = baru)
 * @returns MergeResult (action + merged record)
 */
export async function mergeRow(
  _table: SyncTableName,
  pullRow: PullRow,
  localRecord?: Record<string, any>
): Promise<MergeResult> {
  // Jika lokal tidak ada: insert
  if (!localRecord) {
    return {
      action: "insert",
      local: null,
      merged: fromRemote(pullRow),
      reason: "baru dari server",
    };
  }

  // Jika server deleted: soft-delete lokal
  if (pullRow.deleted === 1) {
    if (localRecord.deleted === 1) {
      return {
        action: "skip",
        local: localRecord,
        merged: localRecord,
        reason: "sudah deleted lokal",
      };
    }
    return {
      action: "delete",
      local: localRecord,
      merged: fromRemote(pullRow, localRecord),
      reason: "soft-delete dari server",
    };
  }

  // Jika server aktif (deleted=0):
  // Compare updated_at: server ALWAYS wins (LWW dengan server authority)
  const serverUpdatedAt = new Date(pullRow.updated_at).getTime();
  const localUpdatedAt = new Date(localRecord.updated_at ?? 0).getTime();

  if (serverUpdatedAt > localUpdatedAt) {
    // Server lebih baru: update lokal
    return {
      action: "update",
      local: localRecord,
      merged: fromRemote(pullRow, localRecord),
      reason: `server lebih baru (${pullRow.updated_at} > ${localRecord.updated_at})`,
    };
  }

  if (serverUpdatedAt === localUpdatedAt) {
    // Sama: skip (sudah konsisten)
    return {
      action: "skip",
      local: localRecord,
      merged: localRecord,
      reason: "updated_at sama, skip update",
    };
  }

  // Lokal lebih baru: tetap skip, jangan override (lokal akan push nanti)
  // Catatan: ini edge case, biasanya tidak terjadi karena server adalah authority
  return {
    action: "skip",
    local: localRecord,
    merged: localRecord,
    reason: "lokal lebih baru (pending push ke server)",
  };
}

/**
 * Recompute stok item dari stock_ledger
 * Append-only strategy: sum semua delta untuk item tersebut
 *
 * Gunakan SETELAH pull, untuk item yang berubah di server
 *
 * @param itemId
 * @returns {itemId, newStok, deltaSum}
 */
export async function recomputeStock(
  itemId: string
): Promise<StockRecomputeResult> {
  // Ambil semua ledger untuk item ini (not deleted)
  const ledgers = await db.stock_ledger
    .where("item_id")
    .equals(itemId)
    .filter((l) => !l.deleted)
    .toArray();

  const deltaSum = ledgers.reduce((sum, l) => sum + (l.delta ?? 0), 0);

  // Update items.stok
  const item = await db.items.get(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  const newStok = deltaSum;
  await db.items.update(itemId, {
    stok: newStok,
    updated_at: new Date().toISOString(),
  });

  return { itemId, newStok, deltaSum };
}

/**
 * Recompute stok untuk banyak item (batch)
 * Gunakan setelah pull jika ada perubahan di stock_ledger
 *
 * @param itemIds list item IDs
 * @returns array of recompute results
 */
export async function recomputeStockBatch(
  itemIds: string[]
): Promise<StockRecomputeResult[]> {
  return Promise.all(itemIds.map((id) => recomputeStock(id)));
}

/**
 * Collect items yang berubah di pull (dari stock_ledger baru atau item update)
 * Digunakan untuk tau item mana saja yang perlu recompute
 *
 * @param pullRows dari server
 * @returns set of unique item IDs
 */
export function collectAffectedItems(pullRows: PullRow[]): Set<string> {
  const items = new Set<string>();

  for (const row of pullRows) {
    if (row.table === "stock_ledger" && row.data.item_id) {
      items.add(row.data.item_id);
    }
    // Jika items table yang update: hitung dari data
    if (row.table === "items" && row.data.id) {
      items.add(row.data.id);
    }
  }

  return items;
}

/**
 * Apply pull rows ke Dexie (merge semuanya)
 * Ini adalah core operasi "merge & apply pull"
 *
 * @param pullRows dari server
 * @returns {inserted, updated, deleted, errors}
 */
export async function applyPullRows(
  pullRows: PullRow[]
): Promise<{
  inserted: number;
  updated: number;
  deleted: number;
  errors: Array<{ row: PullRow; error: string }>;
}> {
  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  const errors: Array<{ row: PullRow; error: string }> = [];

  for (const pullRow of pullRows) {
    try {
      // Get lokal record jika ada
      const table = db[pullRow.table];
      const localRecord = await table.get(pullRow.id);

      // Merge
      const { action, merged } = await mergeRow(
        pullRow.table,
        pullRow,
        localRecord
      );

      // Apply to Dexie
      switch (action) {
        case "insert":
          await table.add(merged as any);
          inserted++;
          break;
        case "update":
          await table.update(pullRow.id, merged as any);
          updated++;
          break;
        case "delete":
          // Soft-delete lokal (already set deleted=1 di fromRemote)
          await table.update(pullRow.id, merged as any);
          deleted++;
          break;
        case "skip":
          // Tidak perlu ubah
          break;
      }
    } catch (error) {
      errors.push({
        row: pullRow,
        error: `${error}`,
      });
    }
  }

  return { inserted, updated, deleted, errors };
}

/**
 * Build summary LWW merge untuk logging
 */
export function summarizeMerge(results: {
  inserted: number;
  updated: number;
  deleted: number;
  errors: Array<any>;
}): string {
  return `[Merge] +${results.inserted} ~${results.updated} -${results.deleted} | errors: ${results.errors.length}`;
}
