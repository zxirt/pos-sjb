import { Modal } from "@/components/ui/Modal";
import { formatRupiah } from "@/lib/money";
import type { Item, ItemUnit } from "@/db/types";

/**
 * Pilih satuan saat menambah item multi-satuan ke keranjang.
 * Baris pertama = satuan dasar; sisanya = tiap konversi.
 * onPick(null) → satuan dasar; onPick(unit) → satuan konversi.
 */
export function UnitPickerModal({
  open,
  item,
  units,
  onClose,
  onPick,
}: {
  open: boolean;
  item: Item | null;
  units: ItemUnit[];
  onClose: () => void;
  onPick: (unit: ItemUnit | null) => void;
}) {
  if (!item) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Pilih satuan — ${item.nama}`} size="sm">
      <div className="flex flex-col divide-y divide-line p-2">
        <button
          onClick={() => onPick(null)}
          className="flex items-center justify-between rounded px-3 py-3 text-left hover:bg-bg"
        >
          <span>
            <span className="font-semibold">{item.satuan_dasar}</span>
            <span className="ml-2 text-xs text-ink-soft">satuan dasar</span>
          </span>
          <span className="num font-medium">{formatRupiah(item.harga_jual)}</span>
        </button>
        {units.map((u) => (
          <button
            key={u.id}
            onClick={() => onPick(u)}
            className="flex items-center justify-between rounded px-3 py-3 text-left hover:bg-bg"
          >
            <span>
              <span className="font-semibold">{u.satuan}</span>
              <span className="num ml-2 text-xs text-ink-soft">
                1 = {u.konversi} {item.satuan_dasar}
              </span>
            </span>
            <span className="num font-medium">{formatRupiah(u.harga_jual)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
