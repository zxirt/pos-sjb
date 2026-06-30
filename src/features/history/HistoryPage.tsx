import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Trash2, ShoppingCart, CreditCard, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatRupiah } from "@/lib/money";
import { formatTanggalJam } from "@/lib/format";
import { cn } from "@/lib/cn";
import { statusBadge } from "@/features/credit/StatusBadge";
import { listRiwayat, deleteSale, deletePurchase, type RiwayatRow } from "./history";
import { SaleEditModal } from "./SaleEditModal";
import { PurchaseForm } from "@/features/purchasing/PurchaseForm";

type Filter = "semua" | "penjualan" | "pembelian";

/**
 * Riwayat Transaksi: daftar penjualan (tunai/piutang) & pembelian, terbaru di
 * atas. Bisa EDIT (ubah isi → stok & piutang/hutang dihitung ulang) & HAPUS
 * (batalkan transaksi → kembalikan stok).
 */
export function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("semua");
  const rows = useLiveQuery(() => listRiwayat(filter), [filter]);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null);

  async function hapus(r: RiwayatRow) {
    const label = r.jenis === "pembelian" ? "pembelian" : "penjualan";
    if (!confirm(`Hapus ${label} ${r.no_nota}? Stok akan dikembalikan.`)) return;
    if (r.jenis === "pembelian") await deletePurchase(r.id);
    else await deleteSale(r.id);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Riwayat Transaksi</h1>

      <div className="mb-4 flex gap-2">
        <TabBtn active={filter === "semua"} onClick={() => setFilter("semua")}>
          Semua
        </TabBtn>
        <TabBtn active={filter === "penjualan"} onClick={() => setFilter("penjualan")}>
          Penjualan
        </TabBtn>
        <TabBtn active={filter === "pembelian"} onClick={() => setFilter("pembelian")}>
          Pembelian
        </TabBtn>
      </div>

      <Card className="divide-y divide-line">
        {rows?.map((r) => (
          <Row
            key={r.id}
            r={r}
            onEdit={() =>
              r.jenis === "pembelian" ? setEditPurchaseId(r.id) : setEditSaleId(r.id)
            }
            onDelete={() => hapus(r)}
          />
        ))}
        {rows?.length === 0 && (
          <div className="p-8 text-center text-ink-soft">Belum ada transaksi.</div>
        )}
      </Card>

      <SaleEditModal
        open={!!editSaleId}
        transactionId={editSaleId}
        onClose={() => setEditSaleId(null)}
      />
      <PurchaseForm
        open={!!editPurchaseId}
        purchaseId={editPurchaseId}
        onClose={() => setEditPurchaseId(null)}
      />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-accent text-white" : "bg-surface text-ink-soft hover:bg-bg",
      )}
    >
      {children}
    </button>
  );
}

const JENIS_META = {
  tunai: { icon: ShoppingCart, label: "Tunai", cls: "text-accent" },
  piutang: { icon: CreditCard, label: "Piutang", cls: "text-warn" },
  pembelian: { icon: ShoppingBag, label: "Pembelian", cls: "text-ink-soft" },
} as const;

function Row({
  r,
  onEdit,
  onDelete,
}: {
  r: RiwayatRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = JENIS_META[r.jenis];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 p-4">
      <Icon size={20} className={cn("shrink-0", meta.cls)} aria-label={meta.label} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num font-semibold">{r.no_nota}</span>
          {statusBadge(r.status)}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-soft">
          <span>{formatTanggalJam(r.tanggal)}</span>
          <span>{r.pihak}</span>
        </div>
        {r.catatan && <div className="mt-0.5 text-sm text-ink-soft">“{r.catatan}”</div>}
        <div className="num mt-1 text-sm">
          <span className="font-semibold">{formatRupiah(r.total)}</span>
          {r.sisa > 0 && (
            <span className="ml-2 text-warn">sisa {formatRupiah(r.sisa)}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="secondary" size="icon" onClick={onEdit} aria-label="Edit">
          <Pencil size={16} />
        </Button>
        <Button variant="secondary" size="icon" onClick={onDelete} aria-label="Hapus">
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}
