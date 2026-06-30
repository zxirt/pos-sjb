import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";

/**
 * Tambah item MANUAL (tanpa master): nama + harga. Tidak memotong stok.
 * Untuk barang yang belum/tak punya master.
 */
export function ManualItemModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (nama: string, harga: number) => void;
}) {
  const [nama, setNama] = useState("");
  const [harga, setHarga] = useState(0);

  useEffect(() => {
    if (open) {
      setNama("");
      setHarga(0);
    }
  }, [open]);

  function tambah() {
    if (!nama.trim() || harga <= 0) return;
    onAdd(nama.trim(), harga);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Item Manual" size="sm">
      <div className="flex flex-col gap-4 p-5">
        <Field>
          <Label htmlFor="manual-nama">Nama barang</Label>
          <Input
            id="manual-nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="mis. Jasa potong, barang lepas…"
            autoFocus
          />
        </Field>
        <Field>
          <Label htmlFor="manual-harga">Harga</Label>
          <MoneyInput id="manual-harga" value={harga} onChange={setHarga} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!nama.trim() || harga <= 0} onClick={tambah}>
            Tambah ke Keranjang
          </Button>
        </div>
      </div>
    </Modal>
  );
}
