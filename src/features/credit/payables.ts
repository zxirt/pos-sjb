import { db } from "@/db/db";
import { newSyncBase, touch, softDelete } from "@/db/helpers";
import { nowIso } from "@/lib/format";
import type { Payable, Payment, Supplier } from "@/db/types";
import { hitungSisa, hitungStatus } from "./payments";

/**
 * Data layer HUTANG (payables) — utang toko ke supplier. Mekanika pembayaran
 * sama persis dengan piutang (recompute dari jumlah − Σ pembayaran). Berbeda
 * dari piutang, hutang dibuat MANUAL (tak lewat keranjang): pemilik mencatat
 * utang ke supplier beserta nominal, jatuh tempo, dan catatan.
 */

export interface PayableFormData {
  supplier_id: string;
  jumlah: number;
  jatuh_tempo: string | null;
  catatan: string;
}

export async function createPayable(d: PayableFormData): Promise<void> {
  const p: Payable = {
    ...newSyncBase(),
    supplier_id: d.supplier_id,
    purchase_id: null, // hutang dicatat manual (bukan dari pembelian barang)
    jumlah: d.jumlah,
    jatuh_tempo: d.jatuh_tempo,
    sisa: d.jumlah,
    status: "belum",
    catatan: d.catatan,
  };
  await db.payables.add(p);
}

/** Ubah detail hutang (jumlah/jatuh tempo/catatan) lalu hitung ulang sisa/status. */
export async function updatePayable(id: string, d: PayableFormData): Promise<void> {
  await db.transaction("rw", db.payables, db.payments, async () => {
    await db.payables.update(id, {
      supplier_id: d.supplier_id,
      jumlah: d.jumlah,
      jatuh_tempo: d.jatuh_tempo,
      catatan: d.catatan,
      ...touch(),
    });
    await recomputePayable(id);
  });
}

export async function deletePayable(id: string): Promise<void> {
  await db.payables.update(id, softDelete());
}

async function pembayaranPayable(payableId: string): Promise<Payment[]> {
  return db.payments
    .where("ref_id")
    .equals(payableId)
    .filter((p) => p.deleted === 0 && p.ref_type === "hutang")
    .toArray();
}

/** Hitung ulang sisa & status sebuah hutang dari seluruh pembayarannya. */
export async function recomputePayable(payableId: string): Promise<void> {
  const p = await db.payables.get(payableId);
  if (!p) return;
  const bayar = (await pembayaranPayable(payableId)).map((x) => x.jumlah);
  await db.payables.update(payableId, {
    sisa: hitungSisa(p.jumlah, bayar),
    status: hitungStatus(p.jumlah, bayar),
    ...touch(),
  });
}

/**
 * Catat pembayaran hutang lalu hitung ulang sisa/status (atomik).
 * `tanggal` (ISO) bisa diisi tanggal lampau bila lupa dicatat; default sekarang.
 */
export async function bayarHutang(
  payableId: string,
  jumlah: number,
  metode = "tunai",
  tanggal?: string,
): Promise<void> {
  if (jumlah <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
  const payment: Payment = {
    ...newSyncBase(),
    ref_type: "hutang",
    ref_id: payableId,
    jumlah,
    tanggal: tanggal ?? nowIso(),
    metode,
  };
  await db.transaction("rw", db.payments, db.payables, async () => {
    await db.payments.add(payment);
    await recomputePayable(payableId);
  });
}

export interface PayableView extends Payable {
  supplierNama: string;
  noNota: string; // dari pembelian (beli/…) bila ada; "" untuk hutang manual
}

async function withSupplier(rows: Payable[]): Promise<PayableView[]> {
  const ids = [...new Set(rows.map((r) => r.supplier_id))];
  const suppliers = await db.suppliers.bulkGet(ids);
  const nama = new Map<string, string>();
  suppliers.forEach((s?: Supplier) => {
    if (s) nama.set(s.id, s.nama);
  });

  const purchaseIds = [...new Set(rows.map((r) => r.purchase_id).filter(Boolean) as string[])];
  const purchases = await db.purchases.bulkGet(purchaseIds);
  const noNota = new Map<string, string>();
  purchases.forEach((p) => {
    if (p) noNota.set(p.id, p.no_nota);
  });

  return rows.map((r) => ({
    ...r,
    supplierNama: nama.get(r.supplier_id) ?? "(supplier terhapus)",
    noNota: r.purchase_id ? (noNota.get(r.purchase_id) ?? "") : "",
  }));
}

export async function listPayables(belumLunasSaja = false): Promise<PayableView[]> {
  let rows = await db.payables.where("deleted").equals(0).toArray();
  if (belumLunasSaja) rows = rows.filter((r) => r.status !== "lunas");
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return withSupplier(rows);
}

/** Hutang belum lunas ke satu supplier, tertua dulu. */
export async function hutangBelumLunasSupplier(
  supplierId: string,
): Promise<PayableView[]> {
  const rows = (await db.payables.where("deleted").equals(0).toArray()).filter(
    (r) => r.status !== "lunas" && r.supplier_id === supplierId,
  );
  rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return withSupplier(rows);
}

/** Bayar beberapa hutang sekaligus (alokasi FIFO). Atomik. */
export async function bayarHutangBatch(
  alokasi: { id: string; bayar: number }[],
  metode = "tunai",
  tanggal?: string,
): Promise<void> {
  const valid = alokasi.filter((a) => a.bayar > 0);
  if (valid.length === 0) throw new Error("Tidak ada yang dibayar.");
  const tgl = tanggal ?? nowIso();
  await db.transaction("rw", db.payments, db.payables, async () => {
    for (const a of valid) {
      await db.payments.add({
        ...newSyncBase(),
        ref_type: "hutang",
        ref_id: a.id,
        jumlah: a.bayar,
        tanggal: tgl,
        metode,
      });
      await recomputePayable(a.id);
    }
  });
}

export async function totalSisaHutang(): Promise<number> {
  const rows = await db.payables
    .where("deleted")
    .equals(0)
    .filter((r) => r.status !== "lunas")
    .toArray();
  return rows.reduce((s, r) => s + r.sisa, 0);
}

export async function riwayatPembayaranHutang(payableId: string): Promise<Payment[]> {
  const rows = await pembayaranPayable(payableId);
  return rows.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/** Ubah nominal sebuah pembayaran hutang lalu hitung ulang sisa/status. */
export async function editPembayaranHutang(
  paymentId: string,
  jumlah: number,
  tanggal?: string,
): Promise<void> {
  if (jumlah <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
  await db.transaction("rw", db.payments, db.payables, async () => {
    const p = await db.payments.get(paymentId);
    if (!p) return;
    await db.payments.update(paymentId, {
      jumlah,
      ...(tanggal ? { tanggal } : {}),
      ...touch(),
    });
    await recomputePayable(p.ref_id);
  });
}

/** Hapus (batalkan) sebuah pembayaran hutang lalu hitung ulang sisa/status. */
export async function hapusPembayaranHutang(paymentId: string): Promise<void> {
  await db.transaction("rw", db.payments, db.payables, async () => {
    const p = await db.payments.get(paymentId);
    if (!p) return;
    await db.payments.update(paymentId, softDelete());
    await recomputePayable(p.ref_id);
  });
}
