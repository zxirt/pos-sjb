import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, Package, History, DollarSign, Truck } from "lucide-react";
import { db } from "@/db/db";
import { formatRupiah } from "@/lib/money";
import { formatTanggal } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CekHargaPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useLiveQuery(async () => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await db.items.where("deleted").equals(0).toArray();
    return all
      .filter(
        (it) =>
          it.nama.toLowerCase().includes(q) ||
          it.merk.toLowerCase().includes(q) ||
          it.barcode.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [query]);

  const item = useLiveQuery(async () => {
    if (!selectedId) return null;
    return (await db.items.get(selectedId)) ?? null;
  }, [selectedId]);

  const units = useLiveQuery(async () => {
    if (!selectedId) return [];
    return db.item_units
      .where("item_id")
      .equals(selectedId)
      .filter((u) => u.deleted === 0)
      .toArray();
  }, [selectedId]);

  const ledger = useLiveQuery(async () => {
    if (!selectedId) return [];
    return db.stock_ledger
      .where("item_id")
      .equals(selectedId)
      .filter((l) => l.deleted === 0 && l.reason === "restock")
      .reverse()
      .sortBy("created_at");
  }, [selectedId]);

  const suppliers = useLiveQuery(async () => {
    const ids = [...new Set((ledger ?? []).map((l) => l.supplier_id).filter(Boolean))] as string[];
    if (ids.length === 0) return new Map<string, string>();
    const rows = await Promise.all(ids.map((id) => db.suppliers.get(id)));
    return new Map(rows.filter(Boolean).map((s) => [s!.id, s!.nama]));
  }, [ledger]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-bold">Cek Harga</h1>

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="text"
          placeholder="Cari nama, merk, atau barcode..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
          className="w-full rounded-lg border border-line bg-surface py-2.5 pl-10 pr-4 text-sm focus:border-accent focus:outline-none"
          autoFocus
        />
      </div>

      {query && items && items.length > 0 && !selectedId && (
        <div className="mb-4 space-y-1">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => { setSelectedId(it.id); setQuery(""); }}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left hover:border-accent"
            >
              <div>
                <div className="font-medium">{it.nama}</div>
                {it.merk && <div className="text-xs text-ink-soft">{it.merk}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold text-accent">{formatRupiah(it.harga_jual)}</div>
                {it.barcode && <div className="text-xs text-ink-soft">#{it.barcode}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {query && items?.length === 0 && (
        <p className="py-8 text-center text-ink-soft">Tidak ditemukan</p>
      )}

      {item && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-xl font-bold">{item.nama}</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              {item.merk && (
                <div><span className="text-ink-soft">Merk:</span> {item.merk}</div>
              )}
              <div><span className="text-ink-soft">Kategori:</span> {item.kategori || "-"}</div>
              {item.barcode && (
                <div><span className="text-ink-soft">Barcode:</span> #{item.barcode}</div>
              )}
              <div><span className="text-ink-soft">Satuan dasar:</span> {item.satuan_dasar}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-sm text-ink-soft">
                <DollarSign size={16} /> Harga Jual
              </div>
              <div className="mt-1 text-xl font-bold text-good">{formatRupiah(item.harga_jual)}</div>
              <div className="text-xs text-ink-soft">Modal: {formatRupiah(item.harga_beli)}</div>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-sm text-ink-soft">
                <Package size={16} /> Stok
              </div>
              <div className={cn("mt-1 text-xl font-bold", item.stok <= item.stok_min ? "text-danger" : "text-ink")}>
                {item.stok} {item.satuan_dasar}
              </div>
              <div className="text-xs text-ink-soft">Min: {item.stok_min}</div>
            </div>
          </div>

          {(item.harga_grosir?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="mb-2 text-sm font-semibold">Harga Grosir</div>
              <div className="space-y-1 text-sm">
                {item.harga_grosir.map((g, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-ink-soft">Min {g.min_qty} {item.satuan_dasar}</span>
                    <span className="font-medium">{formatRupiah(g.harga)}/{item.satuan_dasar}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {units && units.length > 0 && (
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="mb-2 text-sm font-semibold">Satuan Lain</div>
              <div className="space-y-2 text-sm">
                {units!.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded bg-bg px-3 py-2">
                    <div>
                      <span className="font-medium">1 {u.satuan}</span>
                      <span className="text-ink-soft"> = {u.konversi} {item.satuan_dasar}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-accent">{formatRupiah(u.harga_jual)}</div>
                      <div className="text-xs text-ink-soft">Modal {formatRupiah(u.harga_beli)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ledger && ledger.length > 0 && (
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <History size={16} /> Riwayat Pembelian ({ledger.length})
              </div>
              <div className="space-y-1 text-sm">
                {ledger.slice(-20).reverse().map((l) => {
                  const supNama = l.supplier_id ? suppliers?.get(l.supplier_id) : null;
                  return (
                    <div key={l.id} className="flex items-center justify-between rounded bg-bg px-3 py-2">
                      <div>
                        <div className="flex items-center gap-1">
                          <Truck size={12} className="text-ink-soft" />
                          <span>{supNama || "Supplier"}</span>
                        </div>
                        <div className="text-xs text-ink-soft">{formatTanggal(l.created_at)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-good">+{l.delta} {item.satuan_dasar}</div>
                        {l.harga_beli != null && (
                          <div className="text-xs text-ink-soft">{formatRupiah(l.harga_beli)}/satuan</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
