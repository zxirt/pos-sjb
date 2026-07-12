/**
 * Sync pull logic: fetch new/updated records dari server
 * Strategy: gunakan cursor (updated_at) untuk incremental pull
 * Stock ledger append-only: pull semuanya (small volume), recompute after
 */

import type { PullRequest, PullResponse, PullRow, SyncTableName } from "./types";
import { SYNC_TABLES } from "./types";

/**
 * Cursor state: updated_at terbaru per table (untuk incremental pull)
 * Disimpan di localStorage / context
 */
export interface SyncCursor {
  [table: string]: string; // ISO timestamp
}

/**
 * Load cursor dari localStorage
 */
export function loadCursor(storeId: string): SyncCursor {
  try {
    const key = `sync_cursor_${storeId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error("[Cursor] Load error:", err);
    return {};
  }
}

/**
 * Save cursor ke localStorage
 */
export function saveCursor(storeId: string, cursor: SyncCursor): void {
  try {
    const key = `sync_cursor_${storeId}`;
    localStorage.setItem(key, JSON.stringify(cursor));
  } catch (err) {
    console.error("[Cursor] Save error:", err);
  }
}

/**
 * Build pull request: collect cursor per table
 * stock_ledger: always from beginning (append-only, small)
 * others: incremental by updated_at
 */
export function buildPullRequest(
  storeId: string,
  cursor: SyncCursor,
  fullSync: boolean = false
): PullRequest {
  const tables: PullRequest["tables"] = [];

  for (const table of SYNC_TABLES) {
    // stock_ledger always full sync (append-only, small)
    // atau jika fullSync flag set
    if (table === "stock_ledger" || fullSync) {
      tables.push({ table, cursor: undefined });
    } else {
      tables.push({ table, cursor: cursor[table] });
    }
  }

  return { store_id: storeId, tables };
}

/**
 * Pull dari server
 * Endpoint: POST /rpc/sync_pull
 *
 * @param supabase client
 * @param request {store_id, tables}
 * @returns {rows, success}
 */
export async function pull(
  supabase: any,
  request: PullRequest
): Promise<PullResponse> {
  try {
    const { data, error } = await supabase.rpc("sync_pull", request);

    if (error) {
      throw error;
    }

    return data as PullResponse;
  } catch (err) {
    console.error("[Pull] Error:", err);
    return {
      success: false,
      rows: [],
    };
  }
}

/**
 * Update cursor berdasarkan pull rows yang diterima
 * Per table: max(updated_at) dari semua rows
 */
export function updateCursor(
  cursor: SyncCursor,
  pullRows: PullRow[]
): SyncCursor {
  const newCursor = { ...cursor };

  for (const row of pullRows) {
    if (!newCursor[row.table] || row.updated_at > newCursor[row.table]) {
      newCursor[row.table] = row.updated_at;
    }
  }

  return newCursor;
}

/**
 * Group pull rows by table
 */
export function groupByTable(pullRows: PullRow[]): Record<SyncTableName, PullRow[]> {
  const grouped = {} as Record<SyncTableName, PullRow[]>;

  for (const row of pullRows) {
    if (!grouped[row.table]) {
      grouped[row.table] = [];
    }
    grouped[row.table].push(row);
  }

  return grouped;
}

/**
 * Check if pull is "empty" (no changes)
 */
export function isPullEmpty(response: PullResponse): boolean {
  return response.rows.length === 0;
}

/**
 * Statistics dari pull
 */
export function getPullStats(response: PullResponse): {
  totalRows: number;
  byTable: Record<string, number>;
} {
  const byTable: Record<string, number> = {};

  for (const row of response.rows) {
    byTable[row.table] = (byTable[row.table] ?? 0) + 1;
  }

  return {
    totalRows: response.rows.length,
    byTable,
  };
}
