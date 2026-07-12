/**
 * Sync push logic: kirim dirty records ke server
 * Strategy: tidak kirim updated_at (server yang set), hanya data + deleted flag
 */

import { db } from "@/db/db";
import type { PushRequest, PushResponse, SyncTableName } from "./types";
import { toRemote, isDirty } from "./clean";
import { SYNC_TABLES } from "./types";

/**
 * Collect dirty rows dari satu table
 */
async function collectDirtyFromTable(
  table: SyncTableName
): Promise<Array<{ id: string; data: Record<string, any>; deleted: 0 | 1 }>> {
  const dexieTable = db[table];
  const allRows = await dexieTable.toArray();

  return allRows
    .filter((row: any) => isDirty(row))
    .map((row: any) => ({
      id: row.id,
      data: row,
      deleted: row.deleted ?? 0,
    }));
}

/**
 * Collect semua dirty rows dari semua table
 */
export async function collectAllDirty(storeId: string): Promise<PushRequest> {
  const rows = [];

  for (const table of SYNC_TABLES) {
    const dirtyRows = await collectDirtyFromTable(table);
    for (const row of dirtyRows) {
      rows.push(toRemote(table, row.data));
    }
  }

  return { store_id: storeId, rows };
}

/**
 * Push dirty rows ke server
 * Endpoint: POST /rpc/sync_push
 *
 * @param supabase client
 * @param request {store_id, rows}
 * @returns {success, upserted, deleted, errors?}
 */
export async function push(
  supabase: any,
  request: PushRequest
): Promise<PushResponse> {
  try {
    const { data, error } = await supabase.rpc("sync_push", request);

    if (error) {
      throw error;
    }

    return data as PushResponse;
  } catch (err) {
    console.error("[Push] Error:", err);
    return {
      success: false,
      upserted: 0,
      deleted: 0,
      errors: [{ id: "all", error: String(err) }],
    };
  }
}

/**
 * Mark rows sebagai "pending" sebelum push (atomik transaction)
 * Jika push gagal, nanti retry set kembali ke pending
 */
export async function markSyncing(rows: { table: SyncTableName; id: string }[]) {
  for (const { table, id } of rows) {
    const dexieTable = db[table];
    await dexieTable.update(id, { sync_state: "pending" });
  }
}

/**
 * Mark rows berhasil (sync_state = synced, dirty = 0)
 */
export async function markSynced(rows: { table: SyncTableName; id: string }[]) {
  for (const { table, id } of rows) {
    const dexieTable = db[table];
    await dexieTable.update(id, {
      dirty: 0,
      sync_state: "synced",
    });
  }
}

/**
 * Mark rows gagal push (sync_state = conflict, keep dirty)
 */
export async function markSyncError(
  rows: { table: SyncTableName; id: string }[],
  _errorMsg: string
) {
  for (const { table, id } of rows) {
    const dexieTable = db[table];
    await dexieTable.update(id, {
      sync_state: "conflict",
      // keep dirty=1 untuk retry nanti
    });
  }
}

/**
 * Count dirty rows per table (untuk SyncStatus.dirtyCount)
 */
export async function countDirtyPerTable(): Promise<
  Record<SyncTableName, number>
> {
  const counts = {} as Record<SyncTableName, number>;

  for (const table of SYNC_TABLES) {
    const dexieTable = db[table];
    const allRows = await dexieTable.toArray();
    counts[table] = allRows.filter((row: any) => isDirty(row)).length;
  }

  return counts;
}
