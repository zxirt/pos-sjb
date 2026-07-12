/**
 * Sync helper functions: stripLocal, toRemote, fromRemote
 * LWW: updated_at ALWAYS dari server (klien tidak kirim)
 */

import type { SyncTableName, PushRow, PullRow } from "./types";
import { SYNC_TABLES } from "./types";

// ============================================================================
// Local-only fields yang TIDAK dikirim ke server
// ============================================================================
const LOCAL_ONLY_FIELDS = new Set(["dirty", "sync_state"]);

/**
 * Hapus field lokal dari record sebelum push ke server
 * Juga hapus `updated_at` (server yang set)
 */
export function stripLocal(record: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    if (LOCAL_ONLY_FIELDS.has(key) || key === "updated_at") {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Konversi record lokal → PushRow (siap dikirim)
 * @param table table name
 * @param record record lokal (mungkin punya dirty/sync_state/updated_at)
 * @returns PushRow
 */
export function toRemote(
  table: SyncTableName,
  record: Record<string, any>
): PushRow {
  return {
    table,
    id: record.id,
    data: stripLocal(record),
    deleted: record.deleted ?? 0,
  };
}

/**
 * Konversi PullRow + existing lokal → merged record lokal
 * Strategi: server LWW (updated_at dari server), merge ke lokal
 * - Jika server `deleted=1`: set `deleted=1` lokal, `sync_state=synced`
 * - Jika server `deleted=0`: copy semua field server + tambah lokal fields (`dirty=0`, `sync_state=synced`)
 *
 * @param pullRow dari server
 * @param localRecord record lokal saat ini (null jika belum ada)
 * @returns merged record siap di-put ke Dexie
 */
export function fromRemote(
  pullRow: PullRow,
  localRecord?: Record<string, any>
): Record<string, any> {
  const { data, deleted, updated_at } = pullRow;

  // Jika server deleted, set deleted=1 & synced
  if (deleted === 1) {
    return {
      ...localRecord,
      ...data,
      deleted: 1,
      updated_at,
      dirty: 0,
      sync_state: "synced",
    };
  }

  // Server aktif (deleted=0): copy semua field server + local tracking
  return {
    ...data,
    updated_at,
    dirty: 0,
    sync_state: "synced",
  };
}

/**
 * Helper: apakah record perlu di-push? (dirty && sync_state != syncing)
 */
export function isDirty(record: Record<string, any>): boolean {
  return (record.dirty ?? 0) === 1 && record.sync_state !== "syncing";
}

/**
 * Helper: validasi tabel name
 */
export function isValidSyncTable(tableName: string): tableName is SyncTableName {
  return SYNC_TABLES.includes(tableName as SyncTableName);
}

/**
 * Helper: get daftar field yang ada di record
 * (dipakai saat build INSERT/UPDATE SQL di server)
 */
export function getRecordFields(
  record: Record<string, any>
): Array<{
  name: string;
  value: any;
}> {
  return Object.entries(record)
    .filter(([key]) => !LOCAL_ONLY_FIELDS.has(key) && key !== "updated_at")
    .map(([name, value]) => ({ name, value }));
}

/**
 * Helper: build WHERE clause untuk UPSERT
 * Server akan INSERT jika belum ada (by id), atau UPDATE jika sudah
 */
export function buildUpsertWhere(
  _table: SyncTableName,
  id: string
): Record<string, any> {
  return { id };
}

/**
 * Helper: normalize timestamp (ensure ISO format)
 */
export function normalizeTimestamp(ts?: string | Date): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === "string") return ts;
  return ts.toISOString();
}

/**
 * Helper: compare 2 records (ignore local fields) untuk deteksi real change
 */
export function hasRealChange(
  before: Record<string, any>,
  after: Record<string, any>
): boolean {
  const beforeClean = stripLocal(before);
  const afterClean = stripLocal(after);
  return JSON.stringify(beforeClean) !== JSON.stringify(afterClean);
}
