import { db } from "@/db/db";
import { newSyncBase, touch, softDelete } from "@/db/helpers";
import { nowIso } from "@/lib/format";
import type { Receivable, Payment, Customer, Transaction } from "@/db/types";
import { hitungSisa, hitungStatus } from "./payments";

/**
 * Data layer PIUTANG (receivables). Sisa & status SELALU dihitung ulang dari
 * jumlah − Σ pembayaran (lihat recomputeReceivable), bukan dikurangi manual,
 * agar konsisten saat pembayaran disinkron dari perangkat lain (Fase 5).
 */

/** Semua pembayaran (non-deleted) untuk sebuah piutang. */
async function pembayaranReceivable(receivableId: string): Promise<Payment[]> {
  return db.payments
    .where("ref_id")
    .equals(receivableId)
    .filter((p) => p.deleted === 0 && p.ref_type === "piutang")
    .toArray();
}

/** Hitung ulang sisa & status sebuah piutang dari seluruh pembayarannya. */
export async function recomputeReceivable(receivableId: string): Promise<void> {
  const r = await db.receivables.get(receivableId);
  if (!r) return;
  const bayar = (await pembayaranReceivable(receivableId)).map((p) => p.jumlah);
  await db.receivables.update(receivableId, {
    sisa: hitungSisa(r.jumlah, bayar),
    status: hitungStatus(r.jumlah, bayar),
    ...touch(),
  });
}

/**
 * Catat pembayaran piutang lalu hitung ulang sisa/status (atomik).
 * `tanggal` (ISO) bisa diisi tanggal lampau bila pembayaran lupa dicatat;
 * default = sekarang.
 */
export async function bayarPiutang(
  receivableId: string,
  jumlah: number,
  metode = "tunai",
  tanggal?: string,
): Promise<void> {
  if (jumlah <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
  const payment: Payment = {
    ...newSyncBase(),
    ref_type: "piutang",
    ref_id: receivableId,
    jumlah,
    tanggal: tanggal ?? nowIso(),
    metode,
  };
  await db.transaction("rw", db.payments, db.receivables, async () => {
    await db.payments.add(payment);
    await recomputeReceivable(receivableId);
  });
}

export interface ReceivableView extends Receivable {
  customerNama: string;
  noNota: string; // dari transaksi (cash/… atau piu/…)
  catatan: string; // dari transaksi
}

/**
 * Lengkapi tiap baris piutang dengan nama customer + no_nota & catatan dari
 * transaksinya (untuk tampilan daftar). Customer null = "Umum".
 */
async function withDetail(rows: Receivable[]): Promise<ReceivableView[]> {
  const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[])];
  const customers = await db.customers.bulkGet(custIds);
  const nama = new Map<string, string>();
  customers.forEach((c?: Customer) => {
    if (c) nama.set(c.id, c.nama);
  });

  const trxIds = [...new Set(rows.map((r) => r.transaction_id))];
  const trxs = await db.transactions.bulkGet(trxIds);
  const trxMap = new Map<string, Transaction>();
  trxs.forEach((t?: Transaction) => {
    if (t) trxMap.set(t.id, t);
  });

  return rows.map((r) => {
    const t = trxMap.get(r.transaction_id);
    return {
      ...r,
      customerNama: r.customer_id
        ? (nama.get(r.customer_id) ?? "(customer terhapus)")
        : "Umum",
      noNota: t?.no_nota ?? "",
      catatan: t?.catatan ?? "",
    };
  });
}

/** Daftar piutang. `belumLunasSaja` menyembunyikan yang sudah lunas. */
export async function listReceivables(
  belumLunasSaja = false,
): Promise<ReceivableView[]> {
  let rows = await db.receivables.where("deleted").equals(0).toArray();
  if (belumLunasSaja) rows = rows.filter((r) => r.status !== "lunas");
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return withDetail(rows);
}

/** Piutang belum lunas milik satu customer (null = piutang umum), tertua dulu. */
export async function piutangBelumLunasCustomer(
  customerId: string | null,
): Promise<ReceivableView[]> {
  const rows = (await db.receivables.where("deleted").equals(0).toArray()).filter(
    (r) => r.status !== "lunas" && (r.customer_id ?? null) === customerId,
  );
  rows.sort((a, b) => a.created_at.localeCompare(b.created_at)); // tertua dulu
  return withDetail(rows);
}

/**
 * Bayar beberapa piutang sekaligus. `alokasi` = daftar {receivableId, jumlah}
 * (mis. dari alokasiFifo). Tiap baris menulis Payment + recompute, atomik.
 */
export async function bayarPiutangBatch(
  alokasi: { id: string; bayar: number }[],
  metode = "tunai",
  tanggal?: string,
): Promise<void> {
  const valid = alokasi.filter((a) => a.bayar > 0);
  if (valid.length === 0) throw new Error("Tidak ada yang dibayar.");
  const tgl = tanggal ?? nowIso();
  await db.transaction("rw", db.payments, db.receivables, async () => {
    for (const a of valid) {
      await db.payments.add({
        ...newSyncBase(),
        ref_type: "piutang",
        ref_id: a.id,
        jumlah: a.bayar,
        tanggal: tgl,
        metode,
      });
      await recomputeReceivable(a.id);
    }
  });
}

/** Total seluruh sisa piutang belum lunas. */
export async function totalSisaPiutang(): Promise<number> {
  const rows = await db.receivables
    .where("deleted")
    .equals(0)
    .filter((r) => r.status !== "lunas")
    .toArray();
  return rows.reduce((s, r) => s + r.sisa, 0);
}

/** Riwayat pembayaran sebuah piutang (terbaru dulu). */
export async function riwayatPembayaranPiutang(
  receivableId: string,
): Promise<Payment[]> {
  const rows = await pembayaranReceivable(receivableId);
  return rows.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/** Ubah nominal (& opsional tanggal) pembayaran piutang lalu hitung ulang. */
export async function editPembayaranPiutang(
  paymentId: string,
  jumlah: number,
  tanggal?: string,
): Promise<void> {
  if (jumlah <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
  await db.transaction("rw", db.payments, db.receivables, async () => {
    const p = await db.payments.get(paymentId);
    if (!p) return;
    await db.payments.update(paymentId, {
      jumlah,
      ...(tanggal ? { tanggal } : {}),
      ...touch(),
    });
    await recomputeReceivable(p.ref_id);
  });
}

/** Hapus (batalkan) sebuah pembayaran piutang lalu hitung ulang sisa/status. */
export async function hapusPembayaranPiutang(paymentId: string): Promise<void> {
  await db.transaction("rw", db.payments, db.receivables, async () => {
    const p = await db.payments.get(paymentId);
    if (!p) return;
    await db.payments.update(paymentId, softDelete());
    await recomputeReceivable(p.ref_id);
  });
}
