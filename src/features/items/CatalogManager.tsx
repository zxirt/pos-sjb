import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2 } from "lucide-react";
import { db } from "@/db/db";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  addCategory,
  removeCategory,
  addUnit,
  removeUnit,
} from "./catalog";

/** Dialog kelola Kategori & Satuan — diakses dari menu Produk. */
export function CatalogManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Kelola Kategori & Satuan" size="md">
      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <ListEditor
          judul="Kategori"
          placeholder="cth. Semen"
          live={() => db.categories.where("deleted").equals(0).toArray()}
          onAdd={addCategory}
          onRemove={removeCategory}
        />
        <ListEditor
          judul="Satuan"
          placeholder="cth. ZAK"
          live={() => db.units.where("deleted").equals(0).toArray()}
          onAdd={addUnit}
          onRemove={removeUnit}
        />
      </div>
    </Modal>
  );
}

function ListEditor({
  judul,
  placeholder,
  live,
  onAdd,
  onRemove,
}: {
  judul: string;
  placeholder: string;
  live: () => Promise<{ id: string; nama: string }[]>;
  onAdd: (nama: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const items = useLiveQuery(live, []);
  const [val, setVal] = useState("");

  async function add() {
    const v = val.trim();
    if (!v) return;
    await onAdd(v);
    setVal("");
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">{judul}</h3>
      <div className="mb-3 flex gap-2">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
        />
        <Button size="icon" onClick={add} aria-label={`Tambah ${judul}`}>
          <Plus size={18} />
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {items?.map((it) => (
          <li
            key={it.id}
            className="flex items-center justify-between rounded border border-line px-3 py-2 text-sm"
          >
            <span>{it.nama}</span>
            <button
              onClick={() => onRemove(it.id)}
              className="text-ink-soft hover:text-danger"
              aria-label={`Hapus ${it.nama}`}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {items?.length === 0 && (
          <li className="py-3 text-center text-sm text-ink-soft">Belum ada {judul.toLowerCase()}.</li>
        )}
      </ul>
    </div>
  );
}
