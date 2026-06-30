import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Users, Check, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { searchCustomers } from "@/features/customers/customers";
import type { Customer } from "@/db/types";

/**
 * Pemilih customer untuk penjualan piutang. Tombol menampilkan customer
 * terpilih; klik membuka modal cari & pilih. Piutang WAJIB punya customer.
 */
export function CustomerSelect({
  selected,
  onSelect,
}: {
  selected: Customer | null;
  onSelect: (c: Customer | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const customers = useLiveQuery(() => searchCustomers(query), [query]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          "flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left " +
          (selected
            ? "border-accent bg-accent-soft text-accent"
            : "border-dashed border-line-strong text-ink-soft hover:border-accent hover:text-accent")
        }
      >
        <Users size={18} />
        <span className="flex-1 font-semibold">
          {selected ? selected.nama : "Pilih customer (wajib untuk piutang)"}
        </span>
        {selected && (
          <X
            size={16}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
            aria-label="Hapus pilihan"
          />
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Pilih Customer" size="sm">
        <div className="flex flex-col gap-3 p-5">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau kontak…"
          />
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded border border-line">
            {customers?.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-bg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.nama}</div>
                    {c.kontak && (
                      <div className="truncate text-xs text-ink-soft">{c.kontak}</div>
                    )}
                  </div>
                  {selected?.id === c.id && <Check size={16} className="text-accent" />}
                </button>
              </li>
            ))}
            {customers?.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink-soft">
                Tak ada customer. Tambahkan dulu di menu Customer.
              </li>
            )}
          </ul>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
