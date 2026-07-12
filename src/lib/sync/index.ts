import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { SyncEngineConfig, SyncStatus } from "./types";
import { collectAllDirty, markSynced, markSyncError, markSyncing } from "./push";
import { push as pushRows } from "./push";
import { buildPullRequest, loadCursor, pull as pullRows, saveCursor, updateCursor, isPullEmpty } from "./pull";
import {
  applyPullRows,
  collectAffectedItems,
  recomputeStockBatch,
} from "./merge";
import {
  markSyncStart,
  markSyncEnd,
  markSyncErrorState,
  getSyncStatus,
  updateDirtyCount,
  setIsOnline,
} from "./state";
import { subscribeRemoteChanges } from "./realtime";

export class SyncEngine {
  private config: SyncEngineConfig;
  private supabase: SupabaseClient;
  private realtimeChannel?: RealtimeChannel;
  private syncing = false;
  private rerun = false;
  private notifyTimer?: ReturnType<typeof setTimeout>;
  private debouncedPullTimer?: ReturnType<typeof setTimeout>;
  private _started = false;

  constructor(config: SyncEngineConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  get started(): boolean {
    return this._started;
  }

  async start(): Promise<void> {
    if (this._started) return;
    console.log("[SyncEngine] Starting...");
    this._started = true;

    setIsOnline(navigator.onLine);
    await updateDirtyCount();

    window.addEventListener("online", this._onOnline);
    window.addEventListener("offline", this._onOffline);

    if (navigator.onLine) {
      await this.syncNow();
    }

    this._subscribeRealtime();
    console.log("[SyncEngine] Started");
  }

  async stop(): Promise<void> {
    if (!this._started) return;
    console.log("[SyncEngine] Stopping...");
    this._started = false;

    window.removeEventListener("online", this._onOnline);
    window.removeEventListener("offline", this._onOffline);

    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = undefined;
    }
    if (this.debouncedPullTimer) {
      clearTimeout(this.debouncedPullTimer);
      this.debouncedPullTimer = undefined;
    }

    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = undefined;
    }

    console.log("[SyncEngine] Stopped");
  }

  private _onOnline = async () => {
    setIsOnline(true);
    await this.syncNow();
  };

  private _onOffline = () => {
    setIsOnline(false);
  };

  private _subscribeRealtime(): void {
    this.realtimeChannel = subscribeRemoteChanges(
      this.supabase,
      this.config.storeId,
      () => {
        if (this.debouncedPullTimer) clearTimeout(this.debouncedPullTimer);
        this.debouncedPullTimer = setTimeout(() => {
          this.syncNow();
        }, 500);
      },
    );
  }

  /**
   * Panggil dari komponen setelah perubahan data lokal
   * (mis. dari helpers.ts setelah db.transaction).
   * Debounce 500ms agar batch perubahan dikumpulkan dulu.
   */
  notifyLocalChange(): void {
    if (!this._started) return;
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = setTimeout(() => {
      void updateDirtyCount();
      if (navigator.onLine) {
        void this.syncNow();
      }
    }, 500);
  }

  async syncNow(): Promise<SyncStatus | null> {
    if (this.syncing) {
      this.rerun = true;
      return null;
    }
    if (!navigator.onLine) {
      return null;
    }

    markSyncStart();
    this.config.onSyncStart?.();

    try {
      this.syncing = true;

      await this.pushDirty();
      await this.pullNew();

      markSyncEnd();
      const status = getSyncStatus();
      this.config.onSyncEnd?.(status);
      return status;
    } catch (error) {
      console.error("[SyncEngine] Sync error:", error);
      markSyncErrorState(error as Error);
      this.config.onSyncError?.(error as Error);
      return null;
    } finally {
      this.syncing = false;
      if (this.rerun) {
        this.rerun = false;
        void this.syncNow();
      }
    }
  }

  private async pushDirty(): Promise<void> {
    const pushRequest = await collectAllDirty(this.config.storeId);

    if (pushRequest.rows.length === 0) {
      return;
    }

    const rowsToSync = pushRequest.rows.map((row) => ({
      table: row.table,
      id: row.id,
    }));
    await markSyncing(rowsToSync);

    const response = await pushRows(this.supabase, pushRequest);

    if (response.success) {
      await markSynced(rowsToSync);
    } else {
      await markSyncError(
        rowsToSync,
        response.errors?.[0]?.error || "Push failed",
      );
      throw new Error("Push failed: " + response.errors?.[0]?.error);
    }
  }

  private async pullNew(): Promise<void> {
    let cursor = loadCursor(this.config.storeId);
    const pullRequest = buildPullRequest(this.config.storeId, cursor, false);
    const response = await pullRows(this.supabase, pullRequest);

    if (!response.success) {
      throw new Error("Pull failed");
    }

    if (isPullEmpty(response)) {
      return;
    }

    await applyPullRows(response.rows);

    const affectedItems = collectAffectedItems(response.rows);
    if (affectedItems.size > 0) {
      await recomputeStockBatch(Array.from(affectedItems));
    }

    cursor = updateCursor(cursor, response.rows);
    saveCursor(this.config.storeId, cursor);
  }
}

let syncEngine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine | null {
  return syncEngine;
}

export function createOrGetSyncEngine(
  config: SyncEngineConfig,
): SyncEngine {
  if (!syncEngine) {
    syncEngine = new SyncEngine(config);
  }
  return syncEngine;
}

export async function initSyncEngine(
  config: SyncEngineConfig,
): Promise<SyncEngine> {
  const engine = createOrGetSyncEngine(config);
  if (!engine.started) {
    await engine.start();
  }
  return engine;
}

export async function cleanupSyncEngine(): Promise<void> {
  if (syncEngine) {
    await syncEngine.stop();
    syncEngine = null;
  }
}
