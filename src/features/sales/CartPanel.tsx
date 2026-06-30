import { useState } from "react";
import {
  Trash2,
  Minus,
  Plus,
  Tag,
  Pencil,
  AlertTriangle,
  ShoppingCart,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { BiayaTambahan } from "@/db/types";
import {
  type CartLine,
  type CartTotals,
  hargaEfektif,
  lineSubtotal,
  diBawahModal,
} from "./cart";

/**
 * Panel kanan kasir: daftar baris keranjang dengan kontrol qty/harga/diskon,
 * biaya tambahan (free text + nominal), ringkasan total, dan tombol Bayar.
 * Diskon Fase 3 per-baris.
 */
export function CartPanel({
  lines,
  biaya,
  totals,
  onSetQty,
  onRemove,
  onEditHarga,
  onEditDiskon,
  onAddBiaya,
  onUpdateBiaya,
  onRemoveBiaya,
  onBayar,
  onClear,
  hideBayar = false,
}: {
  lines: CartLine[];
  biaya: BiayaTambahan[];
  totals: CartTotals;
  onSetQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onEditHarga: (line: CartLine) => void;
  onEditDiskon: (line: CartLine) => void;
  onAddBiaya: (b: BiayaTambahan) => void;
  onUpdateBiaya: (index: number, b: BiayaTambahan) => void;
  onRemoveBiaya: (index: number) => void;
  onBayar: () => void;
  onClear: () => void;
  /** Sembunyikan tombol Bayar (mis. saat dipakai di form edit transaksi). */
  hideBayar?: boolean;
}) {
  const kosong = lines.length === 0;
  const bisaBayar = !kosong || biaya.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-bold">
          <ShoppingCart size={18} /> Keranjang
          {!kosong && (
            <span className="num rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
              {totals.jumlahItem}
            </span>
          )}
        </h2>
        {(bisaBayar) && (
          <button
            onClick={onClear}
            className="text-sm text-ink-soft hover:text-danger"
          >
            Kosongkan
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {kosong ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-ink-soft">
            <ShoppingCart size={32} className="text-line-strong" />
            <p className="text-sm">Keranjang kosong. Cari, scan, atau pilih favorit.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <CartRow
                key={l.key}
                line={l}
                onSetQty={onSetQty}
                onRemove={onRemove}
                onEditHarga={onEditHarga}
                onEditDiskon={onEditDiskon}
              />
            ))}
          </ul>
        )}

        <BiayaSection
          biaya={biaya}
          onAdd={onAddBiaya}
          onUpdate={onUpdateBiaya}
          onRemove={onRemoveBiaya}
        />
      </div>

      <div className="border-t border-line p-4">
        <div className="mb-1 flex justify-between text-sm text-ink-soft">
          <span>Subtotal barang</span>
          <span className="num">{formatRupiah(totals.subtotal)}</span>
        </div>
        {totals.diskon > 0 && (
          <div className="mb-1 flex justify-between text-sm text-accent">
            <span>Diskon</span>
            <span className="num">−{formatRupiah(totals.diskon)}</span>
          </div>
        )}
        {totals.biaya > 0 && (
          <div className="mb-1 flex justify-between text-sm text-ink-soft">
            <span>Biaya tambahan</span>
            <span className="num">+{formatRupiah(totals.biaya)}</span>
          </div>
        )}
        <div className="mb-3 flex items-end justify-between border-t border-line pt-2">
          <span className="font-semibold">Total</span>
          <span className="num text-2xl font-bold">{formatRupiah(totals.total)}</span>
        </div>
        {!hideBayar && (
          <Button size="lg" className="w-full" disabled={!bisaBayar} onClick={onBayar}>
            Bayar
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Biaya tambahan: label bebas (ongkir, buruh, potong kayu, …) + nominal bebas.
 * Bisa beberapa baris. Inline edit langsung di keranjang.
 */
function BiayaSection({
  biaya,
  onAdd,
  onUpdate,
  onRemove,
}: {
  biaya: BiayaTambahan[];
  onAdd: (b: BiayaTambahan) => void;
  onUpdate: (index: number, b: BiayaTambahan) => void;
  onRemove: (index: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [nominal, setNominal] = useState(0);

  function reset() {
    setLabel("");
    setNominal(0);
    setAdding(false);
  }

  function tambah() {
    if (!label.trim() || nominal <= 0) return;
    onAdd({ label: label.trim(), nominal });
    reset();
  }

  return (
    <div className="border-t border-line bg-bg/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
        <Receipt size={13} /> Biaya Tambahan
      </div>

      {biaya.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {biaya.map((b, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={b.label}
                onChange={(e) => onUpdate(i, { ...b, label: e.target.value })}
                placeholder="Nama biaya"
                className="h-9 flex-1 py-0 text-sm"
              />
              <MoneyInput
                value={b.nominal}
                onChange={(v) => onUpdate(i, { ...b, nominal: v })}
                className="w-32"
              />
              <button
                onClick={() => onRemove(i)}
                aria-label="Hapus biaya"
                className="rounded p-1 text-ink-soft hover:bg-surface hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tambah()}
            placeholder="mis. Ongkir, Buruh, Potong kayu"
            className="h-9 flex-1 py-0 text-sm"
          />
          <MoneyInput value={nominal} onChange={setNominal} className="w-32" />
          <Button size="sm" className="h-9" onClick={tambah}>
            OK
          </Button>
          <button
            onClick={reset}
            aria-label="Batal"
            className="rounded p-1 text-ink-soft hover:text-ink"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded border border-dashed border-line-strong px-2.5 py-1.5 text-sm text-accent hover:bg-accent-soft"
        >
          <Plus size={14} /> Tambah biaya
        </button>
      )}
    </div>
  );
}

function CartRow({
  line,
  onSetQty,
  onRemove,
  onEditHarga,
  onEditDiskon,
}: {
  line: CartLine;
  onSetQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onEditHarga: (line: CartLine) => void;
  onEditDiskon: (line: CartLine) => void;
}) {
  const harga = hargaEfektif(line);
  const adaDiskon = line.diskon_nominal > 0 || line.diskon_persen > 0;
  const rugi = diBawahModal(line);

  return (
    <li className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{line.nama}</div>
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="rounded bg-bg px-1.5 py-0.5">{line.satuan}</span>
            <button
              onClick={() => onEditHarga(line)}
              className={cn(
                "inline-flex items-center gap-1 hover:text-accent",
                line.harga_override && "text-accent",
                rugi && "text-danger",
              )}
            >
              <span className="num">@ {formatRupiah(harga)}</span>
              {rugi && <AlertTriangle size={12} />}
              <Pencil size={11} />
            </button>
          </div>
        </div>
        <button
          onClick={() => onRemove(line.key)}
          aria-label="Hapus baris"
          className="rounded p-1 text-ink-soft hover:bg-bg hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            aria-label="Kurangi"
            onClick={() => onSetQty(line.key, line.qty - 1)}
          >
            <Minus size={14} />
          </Button>
          <input
            type="number"
            value={line.qty}
            min={0}
            onChange={(e) => onSetQty(line.key, parseFloat(e.target.value) || 0)}
            className="num h-8 w-14 rounded border border-line-strong bg-surface text-center text-sm outline-none focus:border-accent"
          />
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            aria-label="Tambah"
            onClick={() => onSetQty(line.key, line.qty + 1)}
          >
            <Plus size={14} />
          </Button>
          <button
            onClick={() => onEditDiskon(line)}
            className={cn(
              "ml-1 inline-flex h-8 items-center gap-1 rounded border border-dashed border-line-strong px-2 text-xs hover:border-accent hover:text-accent",
              adaDiskon && "border-accent text-accent",
            )}
          >
            <Tag size={12} />
            {adaDiskon
              ? line.diskon_persen > 0
                ? `${line.diskon_persen}%`
                : formatRupiah(line.diskon_nominal)
              : "Diskon"}
          </button>
        </div>
        <span className="num font-bold">{formatRupiah(lineSubtotal(line))}</span>
      </div>
    </li>
  );
}
