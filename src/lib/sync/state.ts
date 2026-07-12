/**
 * Sync state management: in-memory state for UI
 * Subscription pattern: listeners get notified on state change
 */

import type { SyncStatus, SyncTableName } from "./types";
import { SYNC_TABLES } from "./types";
import { countDirtyPerTable } from "./push";

// ============================================================================
// Internal state
// ============================================================================

interface SyncStateInternal {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | undefined;
  syncError: string | undefined;
  dirtyCount: Record<SyncTableName, number>;
}

const state: SyncStateInternal = {
  isOnline: false,
  isSyncing: false,
  lastSyncAt: undefined,
  syncError: undefined,
  dirtyCount: Object.fromEntries(
    SYNC_TABLES.map((table) => [table, 0])
  ) as Record<SyncTableName, number>,
};

// ============================================================================
// Subscribers (pub/sub pattern)
// ============================================================================

type StateListener = (state: SyncStateInternal) => void;
const listeners = new Set<StateListener>();

export function subscribeSyncStatus(listener: StateListener): () => void {
  listeners.add(listener);
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener({ ...state }));
}

// ============================================================================
// Getters
// ============================================================================

export function getIsOnline(): boolean {
  return state.isOnline;
}

export function getIsSyncing(): boolean {
  return state.isSyncing;
}

export function getSyncStatus(): SyncStatus {
  const totalDirty = Object.values(state.dirtyCount).reduce(
    (sum: number, count: number) => sum + count,
    0
  );
  return {
    isOnline: state.isOnline,
    isSyncing: state.isSyncing,
    lastSyncAt: state.lastSyncAt,
    syncError: state.syncError,
    dirtyCount: state.dirtyCount,
    totalDirty,
  };
}

// ============================================================================
// Setters
// ============================================================================

export function setIsOnline(online: boolean): void {
  state.isOnline = online;
  notifyListeners();
}

/**
 * Update dirty count (dari push.countDirtyPerTable)
 */
export async function updateDirtyCount(): Promise<void> {
  const counts = await countDirtyPerTable();
  state.dirtyCount = counts;
  notifyListeners();
}

/**
 * Mark sync start
 */
export function markSyncStart(): void {
  state.isSyncing = true;
  state.syncError = undefined;
  notifyListeners();
}

/**
 * Mark sync end (success)
 */
export function markSyncEnd(): void {
  state.isSyncing = false;
  state.lastSyncAt = new Date().toISOString();
  state.syncError = undefined;
  notifyListeners();
  // Update dirty count
  updateDirtyCount();
}

/**
 * Mark sync error
 */
export function markSyncErrorState(error: Error | string): void {
  state.isSyncing = false;
  state.syncError = typeof error === "string" ? error : error.message;
  notifyListeners();
}

/**
 * Reset sync state
 */
export function resetSyncState(): void {
  state.isSyncing = false;
  state.lastSyncAt = undefined;
  state.syncError = undefined;
  state.dirtyCount = Object.fromEntries(
    SYNC_TABLES.map((table: SyncTableName) => [table, 0])
  ) as Record<SyncTableName, number>;
  notifyListeners();
}
