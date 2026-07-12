/**
 * Fase 5: Sync Engine Orchestrator
 * Koordinasi push, pull, merge, recompute untuk offline-first sync
 *
 * Strategy:
 * - Push dirty rows ke server (LWW: server updated_at wins)
 * - Pull new/updated rows dari server (incremental by cursor)
 * - Merge dengan LWW (server wins), recompute stock ledger
 * - Repeat: otomatis saat online, atau manual syncNow()
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
} from "./state";

/**
 * Sync engine instance (singleton per store)
 */
export class SyncEngine {
  private config: SyncEngineConfig;
  private supabase: SupabaseClient;
  private pushInterval?: NodeJS.Timeout;
  private pullInterval?: NodeJS.Timeout;
  private realtimeChannel?: any;
  private syncing = false;

  constructor(config: SyncEngineConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Start sync engine: begin push/pull cycles
   */
  async start(): Promise<void> {
    console.log("[SyncEngine] Starting...");

    // Update dirty count on start
    await updateDirtyCount();

    // Setup auto-push interval jika enabled
    if (this.config.pushIntervalMs && this.config.pushIntervalMs > 0) {
      this.pushInterval = setInterval(
        () => this.syncNow(),
        this.config.pushIntervalMs
      );
    }

    // Setup auto-pull interval jika enabled
    if (this.config.pullIntervalMs && this.config.pullIntervalMs > 0) {
      this.pullInterval = setInterval(
        () => this.syncNow(),
        this.config.pullIntervalMs
      );
    }

    console.log("[SyncEngine] Started");
  }

  /**
   * Stop sync engine
   */
  async stop(): Promise<void> {
    console.log("[SyncEngine] Stopping...");

    if (this.pushInterval) {
      clearInterval(this.pushInterval);
      this.pushInterval = undefined;
    }

    if (this.pullInterval) {
      clearInterval(this.pullInterval);
      this.pullInterval = undefined;
    }

    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = undefined;
    }

    console.log("[SyncEngine] Stopped");
  }

  /**
   * Manual sync: push + pull + merge in one go
   */
  async syncNow(): Promise<SyncStatus | null> {
    // Check online status
    const online = navigator.onLine;

    if (!online) {
      console.log("[SyncEngine] Offline, skipping sync");
      return null;
    }

    if (this.syncing) {
      console.log("[SyncEngine] Already syncing, skip");
      return null;
    }

    markSyncStart();
    this.config.onSyncStart?.();

    try {
      this.syncing = true;

      // 1) Push dirty rows
      console.log("[SyncEngine] Pushing dirty rows...");
      await this.pushDirty();

      // 2) Pull new/updated rows
      console.log("[SyncEngine] Pulling new rows...");
      await this.pullNew();

      // Success
      markSyncEnd();
      const status = getSyncStatus();
      this.config.onSyncEnd?.(status);

      console.log("[SyncEngine] Sync complete");
      return status;
    } catch (error) {
      console.error("[SyncEngine] Sync error:", error);
      markSyncErrorState(error as Error);
      this.config.onSyncError?.(error as Error);
      return null;
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Push dirty rows ke server
   */
  private async pushDirty(): Promise<void> {
    const pushRequest = await collectAllDirty(this.config.storeId);

    if (pushRequest.rows.length === 0) {
      console.log("[SyncEngine] No dirty rows to push");
      return;
    }

    console.log(`[SyncEngine] Pushing ${pushRequest.rows.length} rows...`);

    // Mark as syncing (optimistic)
    const rowsToSync = pushRequest.rows.map((row) => ({
      table: row.table,
      id: row.id,
    }));
    await markSyncing(rowsToSync);

    // Send to server
    const response = await pushRows(this.supabase, pushRequest);

    if (response.success) {
      // Mark as synced
      await markSynced(rowsToSync);
      console.log(
        `[SyncEngine] Push OK: +${response.upserted} rows, -${response.deleted} deleted`
      );
    } else {
      // Mark as error (keep dirty)
      await markSyncError(
        rowsToSync,
        response.errors?.[0]?.error || "Push failed"
      );
      throw new Error("Push failed: " + response.errors?.[0]?.error);
    }
  }

  /**
   * Pull new/updated rows dari server
   */
  private async pullNew(): Promise<void> {
    // Load cursor
    let cursor = loadCursor(this.config.storeId);

    // Build pull request (incremental atau full)
    const pullRequest = buildPullRequest(this.config.storeId, cursor, false);

    // Fetch from server
    const response = await pullRows(this.supabase, pullRequest);

    if (!response.success) {
      throw new Error("Pull failed");
    }

    if (isPullEmpty(response)) {
      console.log("[SyncEngine] No new rows");
      return;
    }

    console.log(`[SyncEngine] Pulled ${response.rows.length} rows`);

    // Merge & apply
    const mergeResult = await applyPullRows(response.rows);
    console.log(
      `[SyncEngine] Merge: +${mergeResult.inserted} ~${mergeResult.updated} -${mergeResult.deleted}`
    );

    if (mergeResult.errors.length > 0) {
      console.warn(
        `[SyncEngine] Merge errors: ${mergeResult.errors.length}`,
        mergeResult.errors
      );
    }

    // Recompute stock for affected items
    const affectedItems = collectAffectedItems(response.rows);
    if (affectedItems.size > 0) {
      console.log(
        `[SyncEngine] Recomputing stock for ${affectedItems.size} items...`
      );
      await recomputeStockBatch(Array.from(affectedItems));
    }

    // Update cursor
    cursor = updateCursor(cursor, response.rows);
    saveCursor(this.config.storeId, cursor);
  }
}

/**
 * Singleton instance
 */
let syncEngine: SyncEngine | null = null;

/**
 * Create atau get sync engine
 */
export function createOrGetSyncEngine(
  config: SyncEngineConfig
): SyncEngine {
  if (!syncEngine) {
    syncEngine = new SyncEngine(config);
  }
  return syncEngine;
}

/**
 * Export untuk app initialization
 */
export async function initSyncEngine(
  config: SyncEngineConfig
): Promise<SyncEngine> {
  const engine = createOrGetSyncEngine(config);
  await engine.start();
  return engine;
}

export async function cleanupSyncEngine(): Promise<void> {
  if (syncEngine) {
    await syncEngine.stop();
    syncEngine = null;
  }
}
