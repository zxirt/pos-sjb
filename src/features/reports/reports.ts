import { db } from "@/db/db";

export interface Periode {
  start: string; // ISO
  end: string; // ISO
}

export interface PenjualanReport {
  totalTransaksi: number;
  totalOmzet: number;
  totalItemTerjual: number;
  rataRataTransaksi: number;
}

export interface LabaRugiReport {
  totalPenjualan: number;
  totalModal: number;
  totalLaba: number;
  marginRata: number;
}

export interface PiutangHutangReport {
  totalPiutang: number;
  totalPiutangTerlambat: number;
  totalHutang: number;
  totalHutangTerlambat: number;
  countPiutang: number;
  countHutang: number;
}

export interface ArusKasReport {
  totalMasuk: number;
  totalKeluar: number;
  saldo: number;
}

function inPeriode(tanggal: string, p: Periode): boolean {
  return tanggal >= p.start && tanggal <= p.end;
}

export async function hitungPenjualan(p: Periode): Promise<PenjualanReport> {
  const trxList = await db.transactions
    .where("deleted")
    .equals(0)
    .filter((t) => t.tipe === "tunai" && inPeriode(t.tanggal, p))
    .toArray();

  const totalTransaksi = trxList.length;
  const totalOmzet = trxList.reduce((s, t) => s + t.total, 0);

  const itemIds = trxList.map((t) => t.id);
  let totalItemTerjual = 0;
  for (const id of itemIds) {
    const items = await db.transaction_items
      .where("transaction_id")
      .equals(id)
      .filter((i) => i.deleted === 0)
      .toArray();
    totalItemTerjual += items.reduce((s, i) => s + i.qty, 0);
  }

  return {
    totalTransaksi,
    totalOmzet,
    totalItemTerjual,
    rataRataTransaksi: totalTransaksi > 0 ? Math.round(totalOmzet / totalTransaksi) : 0,
  };
}

export async function hitungLabaRugi(p: Periode): Promise<LabaRugiReport> {
  const trxList = await db.transactions
    .where("deleted")
    .equals(0)
    .filter((t) => t.tipe === "tunai" && inPeriode(t.tanggal, p))
    .toArray();

  const itemIds = trxList.map((t) => t.id);
  let totalPenjualan = 0;
  let totalModal = 0;

  for (const id of itemIds) {
    const items = await db.transaction_items
      .where("transaction_id")
      .equals(id)
      .filter((i) => i.deleted === 0)
      .toArray();

    for (const it of items) {
      totalPenjualan += it.subtotal;
      if (it.item_id) {
        const item = await db.items.get(it.item_id);
        if (item) {
          totalModal += Math.round(item.harga_beli * it.qty * it.konversi);
        }
      }
    }
  }

  const totalLaba = totalPenjualan - totalModal;
  return {
    totalPenjualan,
    totalModal,
    totalLaba,
    marginRata: totalPenjualan > 0 ? Math.round((totalLaba / totalPenjualan) * 100) : 0,
  };
}

export async function hitungPiutangHutang(): Promise<PiutangHutangReport> {
  const allPiutang = await db.receivables
    .where("deleted")
    .equals(0)
    .filter((r) => r.sisa > 0)
    .toArray();

  const allHutang = await db.payables
    .where("deleted")
    .equals(0)
    .filter((p) => p.sisa > 0)
    .toArray();

  const now = new Date().toISOString();
  const totalPiutang = allPiutang.reduce((s, r) => s + r.sisa, 0);
  const totalPiutangTerlambat = allPiutang
    .filter((r) => r.jatuh_tempo && r.jatuh_tempo < now)
    .reduce((s, r) => s + r.sisa, 0);

  const totalHutang = allHutang.reduce((s, p) => s + p.sisa, 0);
  const totalHutangTerlambat = allHutang
    .filter((p) => p.jatuh_tempo && p.jatuh_tempo < now)
    .reduce((s, p) => s + p.sisa, 0);

  return {
    totalPiutang,
    totalPiutangTerlambat,
    totalHutang,
    totalHutangTerlambat,
    countPiutang: allPiutang.length,
    countHutang: allHutang.length,
  };
}

export async function hitungArusKas(p: Periode): Promise<ArusKasReport> {
  const payments = await db.payments
    .where("deleted")
    .equals(0)
    .filter((pm) => inPeriode(pm.tanggal, p))
    .toArray();

  const allTrx = await db.transactions
    .where("deleted")
    .equals(0)
    .filter((t) => t.tipe === "tunai" && inPeriode(t.tanggal, p))
    .toArray();

  const pembelian = await db.purchases
    .where("deleted")
    .equals(0)
    .filter((pu) => inPeriode(pu.tanggal, p))
    .toArray();

  const totalMasukPenjualan = allTrx.reduce((s, t) => s + t.dibayar, 0);
  const totalMasukPiutang = payments
    .filter((pm) => pm.ref_type === "piutang")
    .reduce((s, pm) => s + pm.jumlah, 0);

  const totalKeluarPembelian = pembelian.reduce((s, pu) => s + pu.dibayar, 0);
  const totalKeluarHutang = payments
    .filter((pm) => pm.ref_type === "hutang")
    .reduce((s, pm) => s + pm.jumlah, 0);

  const totalMasuk = totalMasukPenjualan + totalMasukPiutang;
  const totalKeluar = totalKeluarPembelian + totalKeluarHutang;

  return { totalMasuk, totalKeluar, saldo: totalMasuk - totalKeluar };
}

export function exportCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [headers.join(","), ...rows.map((r) => r.map(escCsv).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
