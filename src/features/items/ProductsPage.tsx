import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  Search,
  Star,
  Pencil,
  Trash2,
  Settings2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { db } from "@/db/db";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { Item, ItemUnit } from "@/db/types";
import { ItemForm } from "./ItemForm";
import { CatalogManager } from "./CatalogManager";
import {
  toggleFavorit,
  deleteItem,
  listItemRows,
  listMerk,
  type SortKey,
  type ItemFilter,
} from "./items";
import { seedCatalogIfEmpty } from "./catalog";

const defaultFilter: ItemFilter = {
  query: "",
  kategori: "",
  merk: "",
  hanyaStokMenipis: false,
  sortBy: "nama",
  sortDir: "asc",
};

export function ProductsPage() {
  const [filter, setFilter] = useState<ItemFilter>(defaultFilter);
  const [formOpen, setFormOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | undefined>();
  const [editUnits, setEditUnits] = useState<ItemUnit[] | undefined>();

  useEffect(() => {
    void seedCatalogIfEmpty();
  }, []);

  const rows = useLiveQuery(() => listItemRows(filter), [filter]);
  const categories = useLiveQuery(
    () => db.categories.where("deleted").equals(0).toArray(),
    [],
  );
  const merkList = useLiveQuery(() => listMerk(), []);

  function set<K extends keyof ItemFilter>(key: K, val: ItemFilter[K]) {
    setFilter((f) => ({ ...f, [key]: val }));
  }

  function toggleSort(key: SortKey) {
    setFilter((f) =>
      f.sortBy === key
        ? { ...f, sortDir: f.sortDir === "asc" ? "desc" : "asc" }
        : { ...f, sortBy: key, sortDir: "asc" },
    );
  }

  async function openEdit(item: Item) {
    const units = await db.item_units
      .where("item_id")
      .equals(item.id)
      .filter((u) => u.deleted === 0)
      .toArray();
    setEditItem(item);
    setEditUnits(units);
    setFormOpen(true);
  }

  function openAdd() {
    setEditItem(undefined);
    setEditUnits(undefined);
    setFormOpen(true);
  }

  async function handleDelete(item: Item) {
    if (confirm(`Hapus "${item.nama}"? Data masih bisa dipulihkan dari backup.`)) {
      await deleteItem(item.id);
    }
  }

  const adaFilterAktif =
    filter.query || filter.kategori || filter.merk || filter.hanyaStokMenipis;

  const jumlahBarang = new Set(rows?.map((r) => r.itemId)).size;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Produk</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCatalogOpen(true)}>
            <Settings2 size={18} /> Kategori & Satuan
          </Button>
          <Button onClick={openAdd}>
            <Plus size={18} /> Tambah Barang
          </Button>
        </div>
      </div>

      {/* FILTER BAR */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" size={18} />
            <Input
              className="pl-10"
              value={filter.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Cari nama, merk, barcode… (1 huruf cukup)"
            />
          </div>
          <div className="w-40">
            <Select value={filter.kategori} onChange={(e) => set("kategori", e.target.value)}>
              <option value="">Semua Kategori</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.nama}>
                  {c.nama}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={filter.merk} onChange={(e) => set("merk", e.target.value)}>
              <option value="">Semua Merk</option>
              {merkList?.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex h-11 items-center gap-2 rounded border border-line-strong bg-surface px-3 text-sm">
            <input
              type="checkbox"
              checked={filter.hanyaStokMenipis}
              onChange={(e) => set("hanyaStokMenipis", e.target.checked)}
              className="h-4 w-4"
            />
            Stok menipis
          </label>
          {adaFilterAktif && (
            <Button variant="secondary" size="sm" onClick={() => setFilter(defaultFilter)}>
              <X size={15} /> Reset
            </Button>
          )}
        </div>
      </Card>

      <div className="mb-2 text-sm text-ink-soft">
        Total barang: <b className="text-ink">{jumlahBarang}</b> · Baris satuan:{" "}
        <b className="text-ink">{rows?.length ?? 0}</b>
      </div>

      {/* TABEL — satu baris per satuan (dasar + tiap konversi) */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-bg text-left text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="w-10 p-2"></th>
                <SortHead label="Nama" k="nama" filter={filter} onSort={toggleSort} />
                <SortHead label="Merk" k="merk" filter={filter} onSort={toggleSort} />
                <SortHead label="Kategori" k="kategori" filter={filter} onSort={toggleSort} />
                <th className="p-2 font-semibold">Barcode</th>
                <th className="p-2 font-semibold">Satuan</th>
                <SortHead label="H. Beli" k="harga_beli" filter={filter} onSort={toggleSort} align="right" />
                <SortHead label="H. Jual" k="harga_jual" filter={filter} onSort={toggleSort} align="right" />
                <SortHead label="Margin" k="margin_persen" filter={filter} onSort={toggleSort} align="right" />
                <SortHead label="Stok" k="stok" filter={filter} onSort={toggleSort} align="right" />
                <th className="w-20 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => {
                const item = r.item;
                const lowStock = item.stok <= item.stok_min;
                // Baris baru per item diberi garis atas tebal sebagai pemisah grup.
                return (
                  <tr
                    key={r.rowKey}
                    className={cn(
                      "hover:bg-bg/50",
                      r.isDasar ? "border-t-2 border-line-strong" : "border-t border-line/60",
                    )}
                  >
                    <td className="p-2 text-center align-top">
                      {r.isDasar && (
                        <button
                          onClick={() => toggleFavorit(item.id, item.favorit ? 0 : 1)}
                          aria-label="Favorit"
                        >
                          <Star
                            size={17}
                            className={
                              item.favorit
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-line-strong"
                            }
                          />
                        </button>
                      )}
                    </td>
                    {/* Nama/Merk/Kategori hanya di baris dasar agar grup terbaca */}
                    <td className="p-2 align-top">
                      {r.isDasar ? (
                        <span className="font-medium">{item.nama}</span>
                      ) : (
                        <span className="pl-3 text-ink-soft">↳</span>
                      )}
                    </td>
                    <td className="p-2 align-top text-ink-soft">
                      {r.isDasar ? item.merk || "—" : ""}
                    </td>
                    <td className="p-2 align-top">
                      {r.isDasar && item.kategori ? (
                        <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] text-ink-soft">
                          {item.kategori}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="num p-2 align-top text-ink-soft">
                      {r.isDasar ? item.barcode || "—" : ""}
                    </td>
                    <td className="p-2 align-top">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium",
                          r.isDasar ? "bg-accent-soft text-accent" : "bg-bg text-ink-soft",
                        )}
                        title={
                          r.isDasar
                            ? "Satuan dasar (acuan stok)"
                            : `1 ${r.satuan} = ${r.konversi} ${item.satuan_dasar}`
                        }
                      >
                        {r.satuan}
                        {!r.isDasar && <span className="num"> ×{r.konversi}</span>}
                      </span>
                    </td>
                    <td className="num p-2 text-right align-top text-ink-soft">
                      {formatRupiah(r.harga_beli)}
                    </td>
                    <td className="num p-2 text-right align-top font-medium">
                      {formatRupiah(r.harga_jual)}
                    </td>
                    <td className="num p-2 text-right align-top text-ink-soft">
                      {r.margin_persen.toFixed(1)}%
                    </td>
                    <td
                      className={cn(
                        "num p-2 text-right align-top",
                        r.isDasar && lowStock && "font-semibold text-warn",
                      )}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.isDasar && lowStock && <AlertTriangle size={13} />}
                        {r.isDasar ? r.stok : r.stok.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-2 align-top">
                      {r.isDasar && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => openEdit(item)}
                            aria-label="Edit"
                            className="h-8 w-8"
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            aria-label="Hapus"
                            className="h-8 w-8"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows?.length === 0 && (
          <div className="p-8 text-center text-ink-soft">
            {adaFilterAktif
              ? "Tidak ada barang yang cocok dengan filter."
              : "Belum ada barang. Klik “Tambah Barang”."}
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editItem ? "Edit Barang" : "Tambah Barang"}
        size="lg"
      >
        <ItemForm item={editItem} units={editUnits} onDone={() => setFormOpen(false)} />
      </Modal>

      <CatalogManager open={catalogOpen} onClose={() => setCatalogOpen(false)} />
    </div>
  );
}

function SortHead({
  label,
  k,
  filter,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  filter: ItemFilter;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = filter.sortBy === k;
  return (
    <th className={cn("p-2 font-semibold", align === "right" && "text-right")}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-ink",
          align === "right" && "flex-row-reverse",
          active && "text-accent",
        )}
      >
        {label}
        {active &&
          (filter.sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
}
