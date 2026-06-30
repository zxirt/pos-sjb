import type { BasisHarga } from "@/lib/pricing";

/**
 * Bentuk record bersama untuk SEMUA tabel yang disinkron.
 * - id: UUID dibuat di klien.
 * - updated_at: kunci last-write-wins.
 * - deleted: soft delete (tombstone) agar penghapusan merambat antar perangkat.
 * Field lokal-saja (dibuang sebelum push ke server):
 * - dirty: 1 = ada perubahan lokal belum ter-push.
 * - sync_state: status sinkron baris.
 */
export interface SyncBase {
  id: string;
  store_id: string;
  created_at: string;
  updated_at: string;
  deleted: 0 | 1;
  dirty: 0 | 1;
  sync_state: "pending" | "synced" | "conflict";
}

export type Role = "pemilik" | "kasir";

export interface User extends SyncBase {
  nama: string;
  email: string;
  role: Role;
}

export interface Category extends SyncBase {
  nama: string;
}

export interface Unit extends SyncBase {
  nama: string;
}

/** Tingkat harga grosir: harga berlaku mulai qty tertentu. */
export interface HargaGrosir {
  harga: number;
  min_qty: number;
}

export interface Item extends SyncBase {
  nama: string;
  merk: string;
  kategori: string;
  barcode: string;
  deskripsi: string;
  satuan_dasar: string;
  stok: number; // proyeksi cache (satuan dasar) = jumlah delta ledger
  stok_min: number;
  harga_beli: number; // per satuan dasar, integer IDR
  harga_jual: number; // per satuan dasar, integer IDR
  margin_persen: number;
  basis_harga: BasisHarga;
  harga_grosir: HargaGrosir[];
  favorit: 0 | 1; // global toko
}

/** Konversi satuan: 1 satuan ini = `konversi` satuan dasar. */
export interface ItemUnit extends SyncBase {
  item_id: string;
  satuan: string;
  konversi: number;
  barcode: string;
  harga_beli: number;
  harga_jual: number;
  margin_persen: number;
}

export interface Supplier extends SyncBase {
  nama: string;
  kontak: string;
  alamat: string;
  catatan: string;
}

export interface Customer extends SyncBase {
  nama: string;
  kontak: string;
  alamat: string;
  limit_kredit: number;
  harga_khusus: 0 | 1;
}

export type TipeTransaksi = "tunai" | "piutang";
export type StatusTransaksi = "lunas" | "sebagian" | "belum";

/**
 * Biaya tambahan transaksi (ongkir, buruh, potong kayu, dll).
 * Label & nominal bebas (free text + free input). BUKAN item/barang:
 * tidak menyentuh stok dan dilaporkan terpisah sebagai biaya, bukan penjualan.
 */
export interface BiayaTambahan {
  label: string;
  nominal: number; // integer IDR
}

export interface Transaction extends SyncBase {
  no_nota: string; // nomor nota, mis. cash/2026/06/A7-00001 (lihat invoiceNumber.ts)
  tipe: TipeTransaksi;
  tanggal: string;
  subtotal: number; // jumlah barang setelah diskon baris (tanpa biaya)
  diskon_nominal: number;
  diskon_persen: number;
  biaya: BiayaTambahan[]; // biaya tambahan; total transaksi = subtotal + Σ biaya
  total: number;
  dibayar: number;
  kembalian: number;
  customer_id: string | null;
  kasir_id: string;
  catatan: string; // catatan bebas (tampil juga di daftar piutang bila belum lunas)
  status: StatusTransaksi;
}

export interface TransactionItem extends SyncBase {
  transaction_id: string;
  item_id: string | null;
  nama: string; // snapshot nama saat transaksi
  satuan: string; // satuan yang dipilih saat jual
  konversi: number; // konversi satuan → satuan dasar (1 jika satuan dasar)
  qty: number;
  harga: number; // harga jual per satuan (yang dipakai)
  diskon_nominal: number; // diskon per-baris (integer IDR), per satuan? → total baris
  diskon_persen: number; // diskon per-baris (%), 0 jika pakai nominal
  subtotal: number; // (harga × qty) − diskon baris
}

export type LedgerReason =
  | "initial" // stok awal saat input item
  | "sale" // penjualan
  | "restock" // pembelian/restock dari supplier
  | "adjustment"; // koreksi manual

/** Append-only. Delta SELALU dalam satuan dasar. */
export interface StockLedger extends SyncBase {
  item_id: string;
  delta: number;
  reason: LedgerReason;
  ref_id: string | null; // id transaksi / pembelian terkait
  supplier_id: string | null; // untuk reason 'restock' → riwayat pembelian
  harga_beli: number | null; // harga modal saat restock → riwayat pembelian
}

export type RefType = "piutang" | "hutang";

export interface Receivable extends SyncBase {
  customer_id: string | null; // null = piutang umum (tanpa customer terdaftar)
  transaction_id: string;
  jumlah: number;
  jatuh_tempo: string | null;
  sisa: number;
  status: StatusTransaksi;
}

export interface Payable extends SyncBase {
  supplier_id: string;
  purchase_id: string | null; // pembelian sumber hutang (null = hutang dicatat manual)
  jumlah: number;
  jatuh_tempo: string | null;
  sisa: number;
  status: StatusTransaksi;
  catatan: string;
}

/**
 * Pembelian barang dari supplier (restock). Menambah stok via stock_ledger
 * (reason 'restock', menyimpan supplier_id + harga_beli → riwayat pembelian
 * Fase 6) dan—bila belum lunas—membuat Payable.
 */
export interface Purchase extends SyncBase {
  no_nota: string; // beli/2026/06/A7-00001
  supplier_id: string;
  tanggal: string;
  total: number;
  dibayar: number;
  catatan: string;
  status: StatusTransaksi;
}

export interface PurchaseItem extends SyncBase {
  purchase_id: string;
  item_id: string; // pembelian selalu barang ber-master (agar stok bertambah)
  nama: string; // snapshot
  satuan: string; // satuan yang dibeli
  konversi: number; // → satuan dasar
  qty: number;
  harga_beli: number; // per satuan yang dibeli (integer IDR)
  subtotal: number; // harga_beli × qty
}

export interface Payment extends SyncBase {
  ref_type: RefType;
  ref_id: string;
  jumlah: number;
  tanggal: string;
  metode: string;
}

/** Opsi STRICT/LONGGAR (dua toggle terpisah). */
export type ModeKetat = "strict" | "longgar";

export interface Settings extends SyncBase {
  nama_toko: string;
  alamat_toko: string;
  kontak_toko: string;
  logo_url: string;
  pajak_persen: number;
  diskon_default: number;
  ukuran_printer: "58mm" | "80mm";
  struk_template: string; // template token, dapat diedit
  struk_tampil_logo: 0 | 1;
  struk_tampil_alamat: 0 | 1;
  struk_footer: string;
  stok_mode: ModeKetat; // boleh stok minus?
  harga_mode: ModeKetat; // boleh ubah harga di kasir?
  owner_pin: string; // PIN pemilik untuk otorisasi ubah harga oleh kasir (strict)
}

/** Penanda high-water sinkronisasi per tabel (lokal-saja). */
export interface SyncCursor {
  table: string;
  last_pulled_at: string; // ISO; "" = belum pernah pull
}

/**
 * Counter penomoran nota (lokal-saja, per perangkat). key =
 * "<prefix>:<YYYY-MM>:<perangkat>" → urut terakhir yang dipakai.
 */
export interface Counter {
  key: string;
  value: number;
}

/** Daftar nama tabel yang disinkron, urut induk-sebelum-anak (integritas FK). */
export const SYNC_TABLES = [
  "settings",
  "users",
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
