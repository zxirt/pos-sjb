import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Pencil, CalendarClock } from "lucide-react";
import { db } from "@/db/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatRupiah } from "@/lib/money";
import { formatTanggal } from "@/lib/format";
import { statusBadge } from "@/features/credit/StatusBadge";
import type { Supplier } from "@/db/types";
import { PurchaseForm } from "./PurchaseForm";

/**
 * Menu Pembelian: catat pembelian barang dari supplier (= sumber hutang) &
 * daftar pembelian terbaru. Edit pembelian dialihkan ke menu Riwayat (alur
 * edit penuh + recompute stok sudah di sana).
 */
export function PurchasePage() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const rows = useLiveQuery(async () => {
    const purchases = await db.purchases.where("deleted").equals(0).toArray();
    const supIds = [...new Set(purchases.map((p) => p.supplier_id))];
    const suppliers = await db.suppliers.bulkGet(supIds);
    const nama = new Map<string, string>();
    suppliers.forEach((s?: Supplier) => s && nama.set(s.id, s.nama));
    purchases.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    return purchases.map((p) => ({ ...p, supplierNama: nama.get(p.supplier_id) ?? "(dihapus)" }));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pembelian</h1>
        <Button onClick={() => setOpen(true)}>
          <ShoppingBag size={18} /> Pembelian Barang
        </Button>
      </div>

      <Card className="divide-y divide-line">
        {rows?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num font-semibold">{p.no_nota}</span>
                {statusBadge(p.status)}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                <span>{p.supplierNama}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={13} /> {formatTanggal(p.tanggal)}
                </span>
              </div>
              <div className="num mt-1 text-sm">
                <span className="font-semibold">{formatRupiah(p.total)}</span>
                {p.total > p.dibayar && (
                  <span className="ml-2 text-warn">
                    hutang {formatRupiah(p.total - p.dibayar)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Edit di Riwayat"
              onClick={() => nav("/riwayat")}
            >
              <Pencil size={16} />
            </Button>
          </div>
        ))}
        {rows?.length === 0 && (
          <div className="p-8 text-center text-ink-soft">Belum ada pembelian.</div>
        )}
      </Card>

      <PurchaseForm open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
