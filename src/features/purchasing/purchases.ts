import { db } from "@/db/db";
import { newSyncBase, touch } from "@/db/helpers";
import { nowIso } from "@/lib/format";
import { applyLedger, recomputeStock } from "@/features/items/stock";
import { qtyKeSatuanDasar } from "@/lib/pricing";
import { nextNoNota } from "@/features/sales/invoiceNumber";
import { hitungSisa, hitungStatus } from "@/features/credit/payments";
import { reversePurchaseEffects } from "@/features/history/history";
import type { Purchase, PurchaseItem, Payable, Payment, StatusTransaksi } from "@/db/types";

/**
 * Pembelian barang dari supplier (restock). Konsekuensinya:
 * 1. stok bertambah lewat stock_ledger (reason 'restock', menyimpan supplier_id
 *    + harga_beli per item → dipakai riwayat pembelian Fase 6),
 * 2. bila dibayar < total → sisanya jadi HUTANG (Payable) ke supplier.
 *
 * Delta ledger SELALU dalam satuan dasar (qty × konversi). Atomik (satu
 * transaksi Dexie).
 */

export interface PurchaseLineInput {
  item_id: string;
  nama: string;
  satuan: string;
  konversi: number; // → satuan dasar
  qty: number;
  harga_beli: number; // per satuan yang dibeli
}

export interface CheckoutPurchaseInput {
  supplierId: string;
  lines: PurchaseLineInput[];
  dibayar: number; // boleh 0
  tanggal: string | null; // ISO; null = sekarang
  jatuhTempo: string | null;
  catatan: string;
}

export interface CheckoutPurchaseResult {
  purchaseId: string;
  noNota: string;
  total: number;
  dibayar: number;
  sisa: number;
  status: StatusTransaksi;
}

export async function checkoutPurchase(
  input: CheckoutPurchaseInput,
): Promise<CheckoutPurchaseResult> {
  const { supplierId, lines, dibayar, jatuhTempo, catatan } = input;

  if (!supplierId) throw new Error("Pilih supplier.");
  const bersih = lines.filter((l) => l.item_id && l.qty > 0);
  if (bersih.length === 0) throw new Error("Tambahkan minimal satu barang.");

  const total = bersih.reduce((s, l) => s + Math.max(0, l.harga_beli) * l.qty, 0);
  const terbayar = Math.max(0, Math.min(dibayar, total));
  const tanggal = input.tanggal ?? nowIso();
  const status = hitungStatus(total, [terbayar]);
  const sisa = hitungSisa(total, [terbayar]);

  // Penomoran nota mengikuti bulan tanggal pembelian.
  const noNota = await nextNoNota("beli", new Date(tanggal));

  const purchase: Purchase = {
    ...newSyncBase(),
    no_nota: noNota,
    supplier_id: supplierId,
    tanggal,
    total,
    dibayar: terbayar,
    catatan: catatan.trim(),
    status,
  };

  const items: PurchaseItem[] = bersih.map((l) => ({
    ...newSyncBase(),
    purchase_id: purchase.id,
    item_id: l.item_id,
    nama: l.nama,
    satuan: l.satuan,
    konversi: l.konversi,
    qty: l.qty,
    harga_beli: l.harga_beli,
    subtotal: l.harga_beli * l.qty,
  }));

  const payable: Payable | null =
    sisa > 0
      ? {
          ...newSyncBase(),
          supplier_id: supplierId,
          purchase_id: purchase.id,
          jumlah: total,
          jatuh_tempo: jatuhTempo,
          sisa,
          status,
          catatan: catatan.trim(),
        }
      : null;

  const dpPayment: Payment | null =
    payable && terbayar > 0
      ? {
          ...newSyncBase(),
          ref_type: "hutang",
          ref_id: payable.id,
          jumlah: terbayar,
          tanggal,
          metode: "tunai",
        }
      : null;

  await db.transaction(
    "rw",
    [db.purchases, db.purchase_items, db.payables, db.payments, db.stock_ledger, db.items],
    async () => {
      await db.purchases.add(purchase);
      await db.purchase_items.bulkAdd(items);
      if (payable) await db.payables.add(payable);
      if (dpPayment) await db.payments.add(dpPayment);

      // Tambah stok per item (delta positif, satuan dasar) + simpan harga modal
      // per satuan dasar untuk riwayat pembelian.
      const ledgerInputs = bersih.map((l) => ({
        item_id: l.item_id,
        delta: qtyKeSatuanDasar(l.qty, l.konversi),
        reason: "restock" as const,
        ref_id: purchase.id,
        supplier_id: supplierId,
        harga_beli: l.konversi > 0 ? Math.round(l.harga_beli / l.konversi) : l.harga_beli,
      }));
      await applyLedger(ledgerInputs);
    },
  );

  return {
    purchaseId: purchase.id,
    noNota,
    total,
    dibayar: terbayar,
    sisa,
    status,
  };
}

export interface EditPurchaseInput extends CheckoutPurchaseInput {
  purchaseId: string;
}

/**
 * Edit pembelian tersimpan: pertahankan id & no_nota, batalkan efek lama
 * (purchase_items, ledger restock, payable + payment) lalu bangun ulang.
 * Stok dihitung ulang. Atomik.
 */
export async function editPurchase(input: EditPurchaseInput): Promise<void> {
  const { purchaseId, supplierId, lines, dibayar, jatuhTempo, catatan } = input;
  const old = await db.purchases.get(purchaseId);
  if (!old) throw new Error("Pembelian tidak ditemukan.");
  if (!supplierId) throw new Error("Pilih supplier.");

  const bersih = lines.filter((l) => l.item_id && l.qty > 0);
  if (bersih.length === 0) throw new Error("Tambahkan minimal satu barang.");

  const total = bersih.reduce((s, l) => s + Math.max(0, l.harga_beli) * l.qty, 0);
  const terbayar = Math.max(0, Math.min(dibayar, total));
  const tanggal = input.tanggal ?? old.tanggal;
  const status = hitungStatus(total, [terbayar]);
  const sisa = hitungSisa(total, [terbayar]);

  const items: PurchaseItem[] = bersih.map((l) => ({
    ...newSyncBase(),
    purchase_id: purchaseId,
    item_id: l.item_id,
    nama: l.nama,
    satuan: l.satuan,
    konversi: l.konversi,
    qty: l.qty,
    harga_beli: l.harga_beli,
    subtotal: l.harga_beli * l.qty,
  }));

  const payable: Payable | null =
    sisa > 0
      ? {
          ...newSyncBase(),
          supplier_id: supplierId,
          purchase_id: purchaseId,
          jumlah: total,
          jatuh_tempo: jatuhTempo,
          sisa,
          status,
          catatan: catatan.trim(),
        }
      : null;

  const dpPayment: Payment | null =
    payable && terbayar > 0
      ? {
          ...newSyncBase(),
          ref_type: "hutang",
          ref_id: payable.id,
          jumlah: terbayar,
          tanggal,
          metode: "tunai",
        }
      : null;

  await db.transaction(
    "rw",
    [db.purchases, db.purchase_items, db.payables, db.payments, db.stock_ledger, db.items],
    async () => {
      const oldItemIds = await reversePurchaseEffects(purchaseId);

      await db.purchases.update(purchaseId, {
        supplier_id: supplierId,
        tanggal,
        total,
        dibayar: terbayar,
        catatan: catatan.trim(),
        status,
        ...touch(),
      });

      await db.purchase_items.bulkAdd(items);
      if (payable) await db.payables.add(payable);
      if (dpPayment) await db.payments.add(dpPayment);

      const ledgerInputs = bersih.map((l) => ({
        item_id: l.item_id,
        delta: qtyKeSatuanDasar(l.qty, l.konversi),
        reason: "restock" as const,
        ref_id: purchaseId,
        supplier_id: supplierId,
        harga_beli: l.konversi > 0 ? Math.round(l.harga_beli / l.konversi) : l.harga_beli,
      }));
      await applyLedger(ledgerInputs);

      const newItemIds = new Set(ledgerInputs.map((l) => l.item_id));
      for (const id of oldItemIds) if (!newItemIds.has(id)) await recomputeStock(id);
    },
  );
}
