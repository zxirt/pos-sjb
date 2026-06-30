import Dexie, { type Table } from "dexie";
import type {
  User,
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
  SyncCursor,
  Counter,
} from "./types";

/**
 * Database lokal (IndexedDB via Dexie).
 *
 * Aturan versi: setiap perubahan skema = db.version(n) BARU + upgrade().
 * Jangan pernah mengubah definisi versi lama — PWA yang sudah terpasang
 * menyimpan IndexedDB versi lama di perangkat pengguna.
 *
 * Index dipilih untuk: scan/cari instan (barcode, nama, merk, kategori),
 * filter favorit, dan sinkronisasi (updated_at, dirty).
 */
export class PosDB extends Dexie {
  users!: Table<User, string>;
  categories!: Table<Category, string>;
  units!: Table<Unit, string>;
  items!: Table<Item, string>;
  item_units!: Table<ItemUnit, string>;
  suppliers!: Table<Supplier, string>;
  customers!: Table<Customer, string>;
  transactions!: Table<Transaction, string>;
  transaction_items!: Table<TransactionItem, string>;
  stock_ledger!: Table<StockLedger, string>;
  receivables!: Table<Receivable, string>;
  payables!: Table<Payable, string>;
  payments!: Table<Payment, string>;
  purchases!: Table<Purchase, string>;
  purchase_items!: Table<PurchaseItem, string>;
  settings!: Table<Settings, string>;
  sync_cursors!: Table<SyncCursor, string>;
  counters!: Table<Counter, string>;

  constructor() {
    super("sjb_pos");

    const v1Stores = {
      users: "id, email, role, updated_at, dirty",
      categories: "id, nama, updated_at, dirty",
      units: "id, nama, updated_at, dirty",
      items:
        "id, nama, merk, kategori, barcode, favorit, updated_at, dirty, deleted",
      item_units: "id, item_id, barcode, updated_at, dirty",
      suppliers: "id, nama, updated_at, dirty, deleted",
      customers: "id, nama, updated_at, dirty, deleted",
      transactions:
        "id, tipe, tanggal, customer_id, kasir_id, status, updated_at, dirty",
      transaction_items: "id, transaction_id, item_id, updated_at, dirty",
      stock_ledger: "id, item_id, reason, ref_id, supplier_id, updated_at, dirty",
      receivables:
        "id, customer_id, transaction_id, status, jatuh_tempo, updated_at, dirty",
      payables: "id, supplier_id, status, jatuh_tempo, updated_at, dirty",
      payments: "id, ref_type, ref_id, tanggal, updated_at, dirty",
      settings: "id, updated_at, dirty",
      sync_cursors: "table", // lokal-saja, tidak ikut sync
    };
    this.version(1).stores(v1Stores);

    // v2: tambah index `deleted` di tabel yang difilter via .where("deleted").
    this.version(2).stores({
      categories: "id, nama, updated_at, dirty, deleted",
      units: "id, nama, updated_at, dirty, deleted",
      item_units: "id, item_id, barcode, updated_at, dirty, deleted",
      payables: "id, supplier_id, status, jatuh_tempo, updated_at, dirty, deleted",
    });

    // v3 (Fase 4): index `deleted` di receivables (daftar piutang filter via
    // .where("deleted")) + index `deleted` di payments.
    this.version(3).stores({
      receivables:
        "id, customer_id, transaction_id, status, jatuh_tempo, updated_at, dirty, deleted",
      payments: "id, ref_type, ref_id, tanggal, updated_at, dirty, deleted",
    });

    // v4 (Fase 4): tabel `counters` (penomoran nota, lokal-saja) + index
    // `no_nota` & `status` di transactions (daftar piutang juga mengambil
    // transaksi tunai yang belum lunas).
    this.version(4).stores({
      counters: "key", // lokal-saja, tidak ikut sync
      transactions:
        "id, no_nota, tipe, tanggal, customer_id, kasir_id, status, updated_at, dirty",
    });

    // v5 (Fase 4): pembelian dari supplier (hutang = pembelian barang).
    // payables menambah index purchase_id.
    this.version(5).stores({
      purchases:
        "id, no_nota, supplier_id, tanggal, status, updated_at, dirty, deleted",
      purchase_items: "id, purchase_id, item_id, updated_at, dirty, deleted",
      payables:
        "id, supplier_id, purchase_id, status, jatuh_tempo, updated_at, dirty, deleted",
    });
  }
}

export const db = new PosDB();
