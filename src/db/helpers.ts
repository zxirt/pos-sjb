import { newId } from "@/lib/uuid";
import { nowIso } from "@/lib/format";
import { STORE_ID } from "@/lib/supabase";
import { getSyncEngine } from "@/lib/sync";
import type { SyncBase } from "./types";

function _notifyChange() {
  const engine = getSyncEngine();
  if (engine) engine.notifyLocalChange();
}

/**
 * Buat field dasar sinkronisasi untuk record BARU.
 * Dipakai semua fitur saat membuat data agar baris selalu siap-sync.
 */
export function newSyncBase(): SyncBase {
  const now = nowIso();
  return {
    id: newId(),
    store_id: STORE_ID,
    created_at: now,
    updated_at: now,
    deleted: 0,
    dirty: 1,
    sync_state: "pending",
  };
}

/**
 * Tandai record yang DIUBAH: perbarui updated_at & set dirty.
 * Kembalikan patch untuk di-spread ke objek update.
 */
export function touch(): Pick<SyncBase, "updated_at" | "dirty" | "sync_state"> {
  _notifyChange();
  return { updated_at: nowIso(), dirty: 1, sync_state: "pending" };
}

/** Patch soft-delete. */
export function softDelete(): Pick<
  SyncBase,
  "deleted" | "updated_at" | "dirty" | "sync_state"
> {
  _notifyChange();
  return { deleted: 1, updated_at: nowIso(), dirty: 1, sync_state: "pending" };
}
