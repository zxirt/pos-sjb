import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, Camera, Plus, Star, PackageX } from "lucide-react";
import { db } from "@/db/db";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/cn";
import { searchItems, findByBarcode } from "@/features/items/items";
import type { Item, ItemUnit } from "@/db/types";
import { BarcodeScanner } from "./BarcodeScanner";

/**
 * Panel kiri kasir: kotak cari/scan (auto-fokus, dukung scanner HID via Enter),
 * tombol kamera, grid favorit, dan hasil pencarian. Tap item → onPickItem.
 * Scan barcode (HID/kamera) yang cocok di item_units → onPickBarcode(item, unit).
 */
export function ProductPicker({
  onPickItem,
  onPickBarcode,
  onAddManual,
}: {
  onPickItem: (item: Item) => void;
  onPickBarcode: (item: Item, unit: ItemUnit | null) => void;
  onAddManual: () => void;
}) {
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [notFound, setNotFound] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const favorit = useLiveQuery(
    () =>
      db.items
        .where("favorit")
        .equals(1)
        .filter((it) => it.deleted === 0)
        .toArray(),
    [],
  );
  const hasil = useLiveQuery(() => (query.trim() ? searchItems(query, 40) : []), [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /** Proses barcode dari scanner HID (Enter) atau kamera. */
  async function prosesBarcode(code: string) {
    const hit = await findByBarcode(code);
    if (hit) {
      onPickBarcode(hit.item, hit.unit);
      setQuery("");
      setNotFound("");
    } else {
      // Bukan barcode terdaftar → biarkan jadi teks pencarian.
      setNotFound(code);
    }
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      void prosesBarcode(query.trim());
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
            size={18}
          />
          <Input
            ref={inputRef}
            className="pl-10"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotFound("");
            }}
            onKeyDown={onKeyDown}
            placeholder="Cari / scan barcode… (Enter untuk scan)"
          />
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Scan kamera"
          onClick={() => setScanOpen(true)}
        >
          <Camera size={20} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Item manual" onClick={onAddManual}>
          <Plus size={20} />
        </Button>
      </div>

      {notFound && (
        <div className="rounded bg-warn/10 px-3 py-2 text-sm text-warn">
          Barcode "{notFound}" tidak ditemukan. Cari manual atau tambah item.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.trim() ? (
          <ResultList items={hasil ?? []} onPick={onPickItem} />
        ) : (
          <FavoritGrid items={favorit ?? []} onPick={onPickItem} />
        )}
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetect={(code) => {
          setScanOpen(false);
          void prosesBarcode(code);
        }}
      />
    </div>
  );
}

function FavoritGrid({ items, onPick }: { items: Item[]; onPick: (i: Item) => void }) {
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-soft">
        <Star size={28} className="text-line-strong" />
        <p className="text-sm">
          Belum ada favorit. Tandai bintang di menu Produk untuk akses cepat di sini.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onPick(it)}
          className="flex flex-col rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft"
        >
          <span className="line-clamp-2 text-sm font-semibold">{it.nama}</span>
          {it.merk && <span className="text-xs text-ink-soft">{it.merk}</span>}
          <span className="num mt-auto pt-2 font-bold text-accent">
            {formatRupiah(it.harga_jual)}
          </span>
        </button>
      ))}
    </div>
  );
}

function ResultList({ items, onPick }: { items: Item[]; onPick: (i: Item) => void }) {
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-soft">
        <PackageX size={28} className="text-line-strong" />
        <p className="text-sm">Tidak ada barang yang cocok.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => {
        const habis = it.stok <= 0;
        return (
          <li key={it.id}>
            <button
              onClick={() => onPick(it)}
              className="flex w-full items-center justify-between gap-3 px-2 py-3 text-left hover:bg-bg"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.nama}</span>
                <span className="block truncate text-xs text-ink-soft">
                  {it.merk && `${it.merk} · `}
                  <span className={cn("num", habis && "font-semibold text-warn")}>
                    Stok {it.stok} {it.satuan_dasar}
                  </span>
                </span>
              </span>
              <span className="num shrink-0 font-bold text-accent">
                {formatRupiah(it.harga_jual)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
