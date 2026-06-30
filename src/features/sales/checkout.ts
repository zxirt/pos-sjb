import { db } from "@/db/db";
import { newSyncBase } from "@/db/helpers";
import { nowIso } from "@/lib/format";
import { applyLedger } from "@/features/items/stock";
import type {
  Transaction,
  TransactionItem,
  Receivable,
  Payment,
  ModeKetat,
  BiayaTambahan,
  Settings,
  StatusTransaksi,
  TipeTransaksi,
} from "@/db/types";
import { type CartLine, hargaEfektif, lineSubtotal, cartTotals } from "./cart";
import { qtyKeSatuanDasar } from "@/lib/pricing";
import { hitungSisa, hitungStatus } from "@/features/credit/payments";
import { nextNoNota, type InvoicePrefix } from "./invoiceNumber";
import { reverseSaleEffects } from "@/features/history/history";
import { recomputeStock } from "@/features/items/stock";
import { type ReceiptData, tokoFromSettings } from "./receipt";

export interface StokKurang {
  nama: string;
  satuan: string;
  diminta: number; // qty dlm satuan dasar
  tersedia: number; // stok dasar saat ini
}

/**
 * Cek baris mana yang membuat stok minus (dalam satuan dasar).
 * Hanya item ber-master yang dicek. Beberapa baris item sama dijumlahkan.
 */
export async function cekStok(lines: CartLine[]): Promise<StokKurang[]> {
  const butuhPerItem = new Map<string, number>();
  for (const l of lines) {
    if (!l.item_id) continue;
    const dasar = qtyKeSatuanDasar(l.qty, l.konversi);
    butuhPerItem.set(l.item_id, (butuhPerItem.get(l.item_id) ?? 0) + dasar);
  }

  const kurang: StokKurang[] = [];
  for (const [itemId, butuh] of butuhPerItem) {
    const item = await db.items.get(itemId);
    if (!item) continue;
    if (butuh > item.stok) {
      kurang.push({
        nama: item.nama,
        satuan: item.satuan_dasar,
        diminta: butuh,
        tersedia: item.stok,
      });
    }
  }
  return kurang;
}

/** Apakah checkout boleh lanjut berdasar mode stok? (true = lanjut). */
export function bolehLanjut(mode: ModeKetat, kurang: StokKurang[]): boolean {
  return mode === "longgar" || kurang.length === 0;
}

// ── Inti penjualan (dipakai tunai & piutang) ─────────────────────────────

interface SaleCore {
  lines: CartLine[];
  biaya: BiayaTambahan[];
  dibayar: number; // tunai: uang diserahkan; piutang: DP
  customerId: string | null;
  catatan: string;
  jatuhTempo: string | null;
  kasirId: string;
  settings: Settings;
  tipe: TipeTransaksi;
  prefix: InvoicePrefix;
}

interface SaleCoreResult {
  trx: Transaction;
  trxItems: TransactionItem[];
  receivable: Receivable | null;
  receipt: ReceiptData;
}

/**
 * Membangun & menyimpan satu penjualan (atomik, satu transaksi Dexie):
 * Transaction + TransactionItem[] + ledger 'sale' (delta satuan dasar) +
 * (bila belum lunas) Receivable + Payment untuk porsi yang dibayar.
 *
 * Piutang muncul bila dibayar < total — berlaku untuk TUNAI (kurang bayar)
 * MAUPUN PIUTANG (DP). Caller mengecek stok_mode lebih dulu (cekStok).
 */
async function buildSale(input: SaleCore): Promise<SaleCoreResult> {
  const {
    lines,
    biaya,
    dibayar,
    customerId,
    catatan,
    jatuhTempo,
    kasirId,
    settings,
    tipe,
    prefix,
  } = input;

  const biayaBersih = biaya
    .map((b) => ({ label: b.label.trim(), nominal: Math.max(0, b.nominal) }))
    .filter((b) => b.label !== "" && b.nominal > 0);

  if (lines.length === 0 && biayaBersih.length === 0)
    throw new Error("Keranjang kosong.");

  const totals = cartTotals(lines, biayaBersih);
  const total = totals.total;
  const tanggal = nowIso();

  // Porsi yang benar-benar dibayar saat transaksi (tak melebihi total).
  const terbayar = Math.max(0, Math.min(dibayar, total));
  // Kembalian hanya relevan untuk tunai (uang diserahkan > total).
  const kembalian = tipe === "tunai" ? Math.max(0, dibayar - total) : 0;

  const status = hitungStatus(total, [terbayar]);
  const sisa = hitungSisa(total, [terbayar]);
  const adaPiutang = sisa > 0;

  const noNota = await nextNoNota(prefix, new Date(tanggal));

  const trx: Transaction = {
    ...newSyncBase(),
    no_nota: noNota,
    tipe,
    tanggal,
    subtotal: totals.barang,
    diskon_nominal: 0,
    diskon_persen: 0,
    biaya: biayaBersih,
    total,
    dibayar: terbayar,
    kembalian,
    customer_id: customerId,
    kasir_id: kasirId,
    catatan: catatan.trim(),
    status,
  };

  const trxItems: TransactionItem[] = lines.map((l) => ({
    ...newSyncBase(),
    transaction_id: trx.id,
    item_id: l.item_id,
    nama: l.nama,
    satuan: l.satuan,
    konversi: l.konversi,
    qty: l.qty,
    harga: hargaEfektif(l),
    diskon_nominal: l.diskon_persen > 0 ? 0 : l.diskon_nominal,
    diskon_persen: l.diskon_persen,
    subtotal: lineSubtotal(l),
  }));

  // Sisa > 0 → catat piutang (customer boleh null = piutang umum).
  const receivable: Receivable | null = adaPiutang
    ? {
        ...newSyncBase(),
        customer_id: customerId,
        transaction_id: trx.id,
        jumlah: total,
        jatuh_tempo: jatuhTempo,
        sisa,
        status,
      }
    : null;

  // Porsi terbayar dicatat sebagai Payment piutang HANYA bila ada baris piutang
  // (agar recompute sisa konsisten). Tunai lunas tak butuh baris piutang/payment.
  const dpPayment: Payment | null =
    receivable && terbayar > 0
      ? {
          ...newSyncBase(),
          ref_type: "piutang",
          ref_id: receivable.id,
          jumlah: terbayar,
          tanggal,
          metode: "tunai",
        }
      : null;

  await db.transaction(
    "rw",
    [
      db.transactions,
      db.transaction_items,
      db.receivables,
      db.payments,
      db.stock_ledger,
      db.items,
    ],
    async () => {
      await db.transactions.add(trx);
      await db.transaction_items.bulkAdd(trxItems);
      if (receivable) await db.receivables.add(receivable);
      if (dpPayment) await db.payments.add(dpPayment);

      const ledgerInputs = lines
        .filter((l) => l.item_id)
        .map((l) => ({
          item_id: l.item_id as string,
          delta: -qtyKeSatuanDasar(l.qty, l.konversi),
          reason: "sale" as const,
          ref_id: trx.id,
        }));
      if (ledgerInputs.length) await applyLedger(ledgerInputs);
    },
  );

  return {
    trx,
    trxItems,
    receivable,
    receipt: { trx, items: trxItems, toko: tokoFromSettings(settings) },
  };
}

// ── Penjualan TUNAI ───────────────────────────────────────────────────────

export interface CheckoutInput {
  lines: CartLine[];
  biaya: BiayaTambahan[];
  dibayar: number; // uang diserahkan
  customerId: string | null; // opsional; perlu bila kurang bayar (jadi piutang)
  catatan: string;
  kasirId: string;
  settings: Settings;
}

export interface CheckoutResult {
  transactionId: string;
  noNota: string;
  total: number;
  dibayar: number;
  kembalian: number;
  sisa: number; // > 0 bila kurang bayar (jadi piutang)
  status: StatusTransaksi;
  receipt: ReceiptData;
}

/**
 * Simpan transaksi TUNAI. Bila uang dibayar KURANG dari total, sisanya otomatis
 * tercatat sebagai piutang (customer opsional; tanpa customer = piutang umum).
 */
export async function checkoutTunai(input: CheckoutInput): Promise<CheckoutResult> {
  const r = await buildSale({
    lines: input.lines,
    biaya: input.biaya,
    dibayar: input.dibayar,
    customerId: input.customerId,
    catatan: input.catatan,
    jatuhTempo: null,
    kasirId: input.kasirId,
    settings: input.settings,
    tipe: "tunai",
    prefix: "cash",
  });
  return {
    transactionId: r.trx.id,
    noNota: r.trx.no_nota,
    total: r.trx.total,
    dibayar: r.trx.dibayar,
    kembalian: r.trx.kembalian,
    sisa: r.receivable?.sisa ?? 0,
    status: r.trx.status,
    receipt: r.receipt,
  };
}

// ── Penjualan PIUTANG (kredit) ──────────────────────────────────────────

export interface CheckoutPiutangInput {
  lines: CartLine[];
  biaya: BiayaTambahan[];
  dibayar: number; // DP/uang muka (boleh 0)
  customerId: string; // WAJIB untuk piutang
  catatan: string;
  jatuhTempo: string | null;
  kasirId: string;
  settings: Settings;
}

export interface CheckoutPiutangResult {
  transactionId: string;
  noNota: string;
  receivableId: string | null;
  total: number;
  dibayar: number;
  sisa: number;
  status: StatusTransaksi;
  receipt: ReceiptData;
}

/**
 * Simpan penjualan PIUTANG (kredit). Customer WAJIB. DP opsional → tercatat
 * sebagai pembayaran awal; sisanya jadi piutang. Bila DP melunasi penuh,
 * status langsung 'lunas' tanpa baris piutang.
 */
export async function checkoutPiutang(
  input: CheckoutPiutangInput,
): Promise<CheckoutPiutangResult> {
  if (!input.customerId) throw new Error("Penjualan piutang wajib memilih customer.");
  const r = await buildSale({
    lines: input.lines,
    biaya: input.biaya,
    dibayar: input.dibayar,
    customerId: input.customerId,
    catatan: input.catatan,
    jatuhTempo: input.jatuhTempo,
    kasirId: input.kasirId,
    settings: input.settings,
    tipe: "piutang",
    prefix: "piu",
  });
  return {
    transactionId: r.trx.id,
    noNota: r.trx.no_nota,
    receivableId: r.receivable?.id ?? null,
    total: r.trx.total,
    dibayar: r.trx.dibayar,
    sisa: r.receivable?.sisa ?? 0,
    status: r.trx.status,
    receipt: r.receipt,
  };
}

// ── EDIT penjualan (tunai/piutang) ────────────────────────────────────────

export interface EditSaleInput {
  transactionId: string;
  lines: CartLine[];
  biaya: BiayaTambahan[];
  dibayar: number;
  customerId: string | null;
  catatan: string;
  jatuhTempo: string | null;
}

/**
 * Edit penjualan yang sudah tersimpan. MEMPERTAHANKAN id, no_nota, tipe, tanggal,
 * dan kasir transaksi; membatalkan efek lama (items, ledger sale, receivable +
 * payment) lalu membangun ulang dari data baru. Atomik (satu transaksi Dexie).
 *
 * Catatan: jumlah "dibayar" diperlakukan sebagai porsi terbayar baru (DP/uang
 * masuk). Riwayat cicilan lama yang melebihi DP awal tidak dipertahankan saat
 * edit isi transaksi — edit isi mengatur ulang keadaan keuangan transaksi itu.
 */
export async function editSale(input: EditSaleInput): Promise<void> {
  const { transactionId, lines, biaya, dibayar, customerId, catatan, jatuhTempo } = input;

  const old = await db.transactions.get(transactionId);
  if (!old) throw new Error("Transaksi tidak ditemukan.");

  const biayaBersih = biaya
    .map((b) => ({ label: b.label.trim(), nominal: Math.max(0, b.nominal) }))
    .filter((b) => b.label !== "" && b.nominal > 0);

  if (lines.length === 0 && biayaBersih.length === 0)
    throw new Error("Keranjang kosong.");

  const totals = cartTotals(lines, biayaBersih);
  const total = totals.total;
  const terbayar = Math.max(0, Math.min(dibayar, total));
  const kembalian = old.tipe === "tunai" ? Math.max(0, dibayar - total) : 0;
  const status = hitungStatus(total, [terbayar]);
  const sisa = hitungSisa(total, [terbayar]);

  const trxItems: TransactionItem[] = lines.map((l) => ({
    ...newSyncBase(),
    transaction_id: transactionId,
    item_id: l.item_id,
    nama: l.nama,
    satuan: l.satuan,
    konversi: l.konversi,
    qty: l.qty,
    harga: hargaEfektif(l),
    diskon_nominal: l.diskon_persen > 0 ? 0 : l.diskon_nominal,
    diskon_persen: l.diskon_persen,
    subtotal: lineSubtotal(l),
  }));

  const receivable: Receivable | null =
    sisa > 0
      ? {
          ...newSyncBase(),
          customer_id: customerId,
          transaction_id: transactionId,
          jumlah: total,
          jatuh_tempo: jatuhTempo,
          sisa,
          status,
        }
      : null;

  const dpPayment: Payment | null =
    receivable && terbayar > 0
      ? {
          ...newSyncBase(),
          ref_type: "piutang",
          ref_id: receivable.id,
          jumlah: terbayar,
          tanggal: old.tanggal,
          metode: "tunai",
        }
      : null;

  await db.transaction(
    "rw",
    [db.transactions, db.transaction_items, db.receivables, db.payments, db.stock_ledger, db.items],
    async () => {
      const itemIds = await reverseSaleEffects(transactionId);

      await db.transactions.update(transactionId, {
        subtotal: totals.barang,
        biaya: biayaBersih,
        total,
        dibayar: terbayar,
        kembalian,
        customer_id: customerId,
        catatan: catatan.trim(),
        status,
        updated_at: nowIso(),
        dirty: 1,
        sync_state: "pending",
      });

      await db.transaction_items.bulkAdd(trxItems);
      if (receivable) await db.receivables.add(receivable);
      if (dpPayment) await db.payments.add(dpPayment);

      const ledgerInputs = lines
        .filter((l) => l.item_id)
        .map((l) => ({
          item_id: l.item_id as string,
          delta: -qtyKeSatuanDasar(l.qty, l.konversi),
          reason: "sale" as const,
          ref_id: transactionId,
        }));
      if (ledgerInputs.length) await applyLedger(ledgerInputs);

      // Item yang muncul di efek lama tapi tidak di ledger baru perlu recompute.
      const newItemIds = new Set(ledgerInputs.map((l) => l.item_id));
      for (const id of itemIds) if (!newItemIds.has(id)) await recomputeStock(id);
    },
  );
}
