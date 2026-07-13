/**
 * Fase 5: Sync Engine types & interfaces
 * LWW strategy: updated_at determined by server (tidak dikirim dari klien)
 * Stock ledger: append-only, recompute after pull
 */

import type {
  Category,
  Unit,
  Item,
  ItemUnit,
  Supplier,
  Customer,
  Transaction,
  TransactionItem,
  StockLedger,
  Receivable,
  Payable,
  Payment,
  Purchase,
  PurchaseItem,
  Settings,
} from "@/db/types";

// ============================================================================
// Sync table registry — yang perlu di-sync
// ============================================================================
export const SYNC_TABLES = [
  "settings",
  "categories",
  "units",
  "items",
  "item_units",
  "suppliers",
  "customers",
  "purchases",
  "purchase_items",
  "transactions",
  "transaction_items",
  "receivables",
  "payables",
  "payments",
  "stock_ledger",
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

// Type map untuk table name → entity type
export interface SyncTableMap {
  settings: Settings;
  categories: Category;
  units: Unit;
  items: Item;
  item_units: ItemUnit;
  suppliers: Supplier;
  customers: Customer;
  purchases: Purchase;
  purchase_items: PurchaseItem;
  transactions: Transaction;
  transaction_items: TransactionItem;
  receivables: Receivable;
  payables: Payable;
  payments: Payment;
  stock_ledger: StockLedger;
}

// ============================================================================
// Push: baris "dirty" yang belum tersinkron ke server
// ============================================================================
export interface PushRow {
  table: SyncTableName;
  id: string;
  data: Record<string, any>; // exclude local-only fields (dirty, sync_state)
  deleted: 0 | 1; // soft delete flag
}

export interface PushRequest {
  store_id: string;
  rows: PushRow[];
}

export interface PushResponse {
  success: boolean;
  upserted: number; // baris berhasil INSERT/UPDATE
  deleted: number; // baris berhasil SOFT-DELETE
  errors?: Array<{ id: string; error: string }>;
}

// ============================================================================
// Pull: baris baru/terupdate dari server sejak cursor
// ============================================================================
export interface PullRow<T = any> {
  table: SyncTableName;
  id: string;
  data: T; // full record dari server (include updated_at)
  deleted: 0 | 1;
  updated_at: string; // ISO timestamp — server's LWW source
}

export interface PullRequest {
  store_id: string;
  tables: Array<{
    table: SyncTableName;
    cursor?: string; // ISO cursor sebelumnya (updated_at), atau undefined = sync all
  }>;
}

export interface PullResponse {
  rows: PullRow[];
  success: boolean;
}

// ============================================================================
// Merge: resolusi konflik LWW lokal vs server
// ============================================================================
export interface MergeResult {
  action: "insert" | "update" | "delete" | "skip"; // skip = sama, tidak perlu ubah
  local: Record<string, any> | null; // sebelum merge
  merged: Record<string, any> | null; // sesudah merge (null = deleted)
  reason?: string;
}

// ============================================================================
// Sync state & status
// ============================================================================
export enum SyncState {
  /** Awalnya, belum pernah di-sync */
  UNSYNC = "unsync",
  /** Dirty, menunggu push */
  DIRTY = "dirty",
  /** Sedang push/pull */
  SYNCING = "syncing",
  /** Berhasil sync, clean */
  SYNCED = "synced",
  /** Error saat sync, perlu retry */
  ERROR = "error",
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: string; // ISO
  syncError?: string;
  dirtyCount: Record<SyncTableName, number>; // baris dirty per table
  totalDirty: number;
}

// ============================================================================
// Sync engine config
// ============================================================================
export interface SyncEngineConfig {
  storeId: string;
  supabaseUrl: string;
  supabaseKey: string;
  /** Interval push otomatis (ms), 0 = manual only */
  pushIntervalMs?: number;
  /** Interval pull otomatis (ms), 0 = manual only */
  pullIntervalMs?: number;
  /** Callback saat sync dimulai */
  onSyncStart?: () => void;
  /** Callback saat sync selesai */
  onSyncEnd?: (status: SyncStatus) => void;
  /** Callback saat error */
  onSyncError?: (error: Error) => void;
}

// ============================================================================
// Stock ledger recompute
// ============================================================================
export interface StockRecomputeResult {
  itemId: string;
  newStok: number;
  deltaSum: number;
}
