import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TrendingUp, DollarSign, Users, Wallet, Download, type LucideIcon } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import { todayInput, dateInputToIso } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  hitungPenjualan,
  hitungLabaRugi,
  hitungPiutangHutang,
  hitungArusKas,
  exportCsv,
  type Periode,
} from "./reports";

type Tab = "penjualan" | "labarugi" | "piutang" | "aruskas";

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "penjualan", label: "Penjualan", icon: TrendingUp },
  { key: "labarugi", label: "Laba / Rugi", icon: DollarSign },
  { key: "piutang", label: "Piutang & Hutang", icon: Users },
  { key: "aruskas", label: "Arus Kas", icon: Wallet },
];

export function LaporanPage() {
  const [tab, setTab] = useState<Tab>("penjualan");
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return todayInput(d);
  });
  const [end, setEnd] = useState(todayInput);

  const periode: Periode = {
    start: dateInputToIso(start) ?? new Date(0).toISOString(),
    end: dateInputToIso(end) ?? new Date().toISOString(),
  };

  const penjualan = useLiveQuery(() => hitungPenjualan(periode), [start, end]);
  const labaRugi = useLiveQuery(() => hitungLabaRugi(periode), [start, end]);
  const piutang = useLiveQuery(() => hitungPiutangHutang(), []);
  const arusKas = useLiveQuery(() => hitungArusKas(periode), [start, end]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-lg font-bold">Laporan</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Dari:
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Sampai:
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            max={todayInput()}
            className="rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-bg p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-surface text-accent shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "penjualan" && penjualan && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card label="Omzet" value={formatRupiah(penjualan.totalOmzet)} />
            <Card label="Total Transaksi" value={String(penjualan.totalTransaksi)} />
            <Card label="Item Terjual" value={String(penjualan.totalItemTerjual)} />
            <Card label="Rata-rata/Transaksi" value={formatRupiah(penjualan.rataRataTransaksi)} />
          </div>
          <ExportButton
            label="CSV Penjualan"
            onExport={() =>
              exportCsv("penjualan", ["Periode", start, end], [
                ["Omzet", String(penjualan.totalOmzet)],
                ["Transaksi", String(penjualan.totalTransaksi)],
                ["Item Terjual", String(penjualan.totalItemTerjual)],
                ["Rata-rata", String(penjualan.rataRataTransaksi)],
              ])
            }
          />
        </div>
      )}

      {tab === "labarugi" && labaRugi && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card label="Total Penjualan" value={formatRupiah(labaRugi.totalPenjualan)} />
            <Card label="Total Modal" value={formatRupiah(labaRugi.totalModal)} />
            <Card
              label="Laba Kotor"
              value={formatRupiah(labaRugi.totalLaba)}
              className={labaRugi.totalLaba >= 0 ? "text-good" : "text-danger"}
            />
            <Card label="Margin Rata-rata" value={`${labaRugi.marginRata}%`} />
          </div>
          <ExportButton
            label="CSV Laba/Rugi"
            onExport={() =>
              exportCsv("labarugi", ["Periode", start, end], [
                ["Penjualan", String(labaRugi.totalPenjualan)],
                ["Modal", String(labaRugi.totalModal)],
                ["Laba", String(labaRugi.totalLaba)],
                ["Margin", `${labaRugi.marginRata}%`],
              ])
            }
          />
        </div>
      )}

      {tab === "piutang" && piutang && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card label="Total Piutang" value={formatRupiah(piutang.totalPiutang)} count={piutang.countPiutang} />
            <Card
              label="Piutang Terlambat"
              value={formatRupiah(piutang.totalPiutangTerlambat)}
              className="text-danger"
            />
            <Card label="Total Hutang" value={formatRupiah(piutang.totalHutang)} count={piutang.countHutang} />
            <Card
              label="Hutang Terlambat"
              value={formatRupiah(piutang.totalHutangTerlambat)}
              className="text-danger"
            />
          </div>
          <ExportButton
            label="CSV Piutang/Hutang"
            onExport={() =>
              exportCsv("piutang_hutang", ["Item", "Nilai"], [
                ["Piutang", String(piutang.totalPiutang)],
                ["Piutang Terlambat", String(piutang.totalPiutangTerlambat)],
                ["Hutang", String(piutang.totalHutang)],
                ["Hutang Terlambat", String(piutang.totalHutangTerlambat)],
              ])
            }
          />
        </div>
      )}

      {tab === "aruskas" && arusKas && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card label="Total Pemasukan" value={formatRupiah(arusKas.totalMasuk)} className="text-good" />
            <Card label="Total Pengeluaran" value={formatRupiah(arusKas.totalKeluar)} className="text-danger" />
            <Card
              label="Saldo Bersih"
              value={formatRupiah(arusKas.saldo)}
              className={arusKas.saldo >= 0 ? "text-good" : "text-danger"}
            />
          </div>
          <ExportButton
            label="CSV Arus Kas"
            onExport={() =>
              exportCsv("arus_kas", ["Periode", start, end], [
                ["Pemasukan", String(arusKas.totalMasuk)],
                ["Pengeluaran", String(arusKas.totalKeluar)],
                ["Saldo", String(arusKas.saldo)],
              ])
            }
          />
        </div>
      )}
    </div>
  );
}

function Card({ label, value, count, className }: { label: string; value: string; count?: number; className?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={cn("mt-1 text-xl font-bold", className)}>{value}</div>
      {count != null && <div className="text-xs text-ink-soft">{count} pihak</div>}
    </div>
  );
}

function ExportButton({ label, onExport }: { label: string; onExport: () => void }) {
  return (
    <button
      onClick={onExport}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-bg"
    >
      <Download size={16} /> {label}
    </button>
  );
}
