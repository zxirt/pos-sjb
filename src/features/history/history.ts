import { db } from "@/db/db";
import { softDelete, touch } from "@/db/helpers";
import { recomputeStock } from "@/features/items/stock";
import type { Transaction, Supplier, Customer } from "@/db/types";

/**
 * Riwayat transaksi: daftar penjualan (tunai/piutang) & pembelian, dengan
 * EDIT & HAPUS. Menghapus/mengubah transaksi harus membatalkan efek sampingnya
 * (stok via ledger, piutang/hutang, pembayaran) secara atomik.
 *
 * Pendekatan pembatalan: SOFT-DELETE seluruh baris turunan (transaction_items,
 * stock_ledger terkait, receivable + payment-nya / payable + payment-nya), lalu
 * hitung ulang stok item terdampak. Append-only ledger tetap terjaga (baris
 * lama hanya ditandai deleted, jumlah stok = Σ delta non-deleted).
 */

export type RiwayatJenis = "tunai" | "piutang" | "pembelian";

export interface RiwayatRow {
  id: string;
  jenis: RiwayatJenis;
  no_nota: string;
  tanggal: string;
  pihak: string; // customer / supplier / "Umum"
  total: number;
  dibayar: number;
  sisa: number;
  status: Transaction["status"];
  catatan: string;
}

/** Gabungan penjualan + pembelian, urut tanggal terbaru. Filter opsional. */
export async function listRiwayat(
  filter: "semua" | "penjualan" | "pembelian" = "semua",
  search: string = "",
  tglAwal?: string,
  tglAkhir?: string,
): Promise<RiwayatRow[]> {
  const rows: RiwayatRow[] = [];
  const q = search.toLowerCase().trim();

  if (filter !== "pembelian") {
    // transactions tak ber-index `deleted` → filter in-memory (data 1 toko terbatas).
    const trxs = (await db.transactions.toArray()).filter((t) => t.deleted === 0);

    const custIds = [
      ...new Set(trxs.map((t) => t.customer_id).filter(Boolean) as string[]),
    ];
    const customers = await db.customers.bulkGet(custIds);
    const custNama = new Map<string, string>();
    customers.forEach((c?: Customer) => c && custNama.set(c.id, c.nama));

    for (const t of trxs) {
      const dibayar = t.dibayar;
      rows.push({
        id: t.id,
        jenis: t.tipe,
        no_nota: t.no_nota,
        tanggal: t.tanggal,
        pihak: t.customer_id ? (custNama.get(t.customer_id) ?? "(dihapus)") : "Umum",
        total: t.total,
        dibayar,
        sisa: Math.max(0, t.total - dibayar),
        status: t.status,
        catatan: t.catatan,
      });
    }
  }

  if (filter !== "penjualan") {
    const purchases = await db.purchases.where("deleted").equals(0).toArray();
    const supIds = [...new Set(purchases.map((p) => p.supplier_id))];
    const suppliers = await db.suppliers.bulkGet(supIds);
    const supNama = new Map<string, string>();
    suppliers.forEach((s?: Supplier) => s && supNama.set(s.id, s.nama));

    for (const p of purchases) {
      rows.push({
        id: p.id,
        jenis: "pembelian",
        no_nota: p.no_nota,
        tanggal: p.tanggal,
        pihak: supNama.get(p.supplier_id) ?? "(dihapus)",
        total: p.total,
        dibayar: p.dibayar,
        sisa: Math.max(0, p.total - p.dibayar),
        status: p.status,
        catatan: p.catatan,
      });
    }
  }

  // Filter in-memory: search (no_nota, catatan, pihak) + rentang tanggal
  const hasil = rows.filter((r) => {
    if (q && !r.no_nota.toLowerCase().includes(q) && !(r.catatan?.toLowerCase() ?? "").includes(q) && !r.pihak.toLowerCase().includes(q)) return false;
    if (tglAwal && r.tanggal < tglAwal) return false;
    if (tglAkhir && r.tanggal > tglAkhir) return false;
    return true;
  });

  hasil.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  return hasil;
}

/** Item-item satu transaksi penjualan (non-deleted). */
export async function getSaleDetail(transactionId: string) {
  const trx = await db.transactions.get(transactionId);
  const items = (
    await db.transaction_items.where("transaction_id").equals(transactionId).toArray()
  ).filter((i) => i.deleted === 0);
  return { trx, items };
}

export async function getPurchaseDetail(purchaseId: string) {
  const purchase = await db.purchases.get(purchaseId);
  const items = (
    await db.purchase_items.where("purchase_id").equals(purchaseId).toArray()
  ).filter((i) => i.deleted === 0);
  return { purchase, items };
}

/**
 * Batalkan (soft-delete) seluruh efek samping sebuah PENJUALAN: transaction_items,
 * ledger 'sale' terkait, receivable + payment-nya. Mengembalikan item-id yang
 * stoknya perlu dihitung ulang. TIDAK menyentuh baris Transaction induk
 * (caller yang menghapus / membangun ulang).
 */
async function reverseSaleEffects(transactionId: string): Promise<string[]> {
  const items = await db.transaction_items
    .where("transaction_id")
    .equals(transactionId)
    .toArray();
  for (const it of items) {
    if (it.deleted === 0) await db.transaction_items.update(it.id, softDelete());
  }

  const ledgers = await db.stock_ledger.where("ref_id").equals(transactionId).toArray();
  const itemIds = new Set<string>();
  for (const lg of ledgers) {
    if (lg.deleted === 0 && lg.reason === "sale") {
      await db.stock_ledger.update(lg.id, softDelete());
      itemIds.add(lg.item_id);
    }
  }

  const receivables = await db.receivables
    .where("transaction_id")
    .equals(transactionId)
    .toArray();
  for (const r of receivables) {
    if (r.deleted === 1) continue;
    const pays = await db.payments.where("ref_id").equals(r.id).toArray();
    for (const p of pays) {
      if (p.deleted === 0) await db.payments.update(p.id, softDelete());
    }
    await db.receivables.update(r.id, softDelete());
  }

  return [...itemIds];
}

/** Hapus (batalkan) sebuah penjualan: kembalikan stok, hapus piutang & nota. */
export async function deleteSale(transactionId: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.transactions, db.transaction_items, db.stock_ledger, db.receivables, db.payments, db.items],
    async () => {
      const itemIds = await reverseSaleEffects(transactionId);
      await db.transactions.update(transactionId, softDelete());
      for (const id of itemIds) await recomputeStock(id);
    },
  );
}

/**
 * Batalkan efek samping PEMBELIAN: purchase_items, ledger 'restock' terkait,
 * payable + payment-nya. Kembalikan item-id untuk recompute stok.
 */
async function reversePurchaseEffects(purchaseId: string): Promise<string[]> {
  const items = await db.purchase_items.where("purchase_id").equals(purchaseId).toArray();
  for (const it of items) {
    if (it.deleted === 0) await db.purchase_items.update(it.id, softDelete());
  }

  const ledgers = await db.stock_ledger.where("ref_id").equals(purchaseId).toArray();
  const itemIds = new Set<string>();
  for (const lg of ledgers) {
    if (lg.deleted === 0 && lg.reason === "restock") {
      await db.stock_ledger.update(lg.id, softDelete());
      itemIds.add(lg.item_id);
    }
  }

  const payables = await db.payables.where("purchase_id").equals(purchaseId).toArray();
  for (const pay of payables) {
    if (pay.deleted === 1) continue;
    const ps = await db.payments.where("ref_id").equals(pay.id).toArray();
    for (const p of ps) {
      if (p.deleted === 0) await db.payments.update(p.id, softDelete());
    }
    await db.payables.update(pay.id, softDelete());
  }

  return [...itemIds];
}

/** Hapus (batalkan) sebuah pembelian: kurangi kembali stok, hapus hutang & nota. */
export async function deletePurchase(purchaseId: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.purchases, db.purchase_items, db.stock_ledger, db.payables, db.payments, db.items],
    async () => {
      const itemIds = await reversePurchaseEffects(purchaseId);
      await db.purchases.update(purchaseId, softDelete());
      for (const id of itemIds) await recomputeStock(id);
    },
  );
}

export { reverseSaleEffects, reversePurchaseEffects };

/** Ubah hanya catatan transaksi penjualan (tanpa sentuh stok/piutang). */
export async function updateSaleCatatan(transactionId: string, catatan: string): Promise<void> {
  await db.transactions.update(transactionId, { catatan: catatan.trim(), ...touch() });
}
