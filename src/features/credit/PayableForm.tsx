import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input, Select } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { searchSuppliers } from "@/features/suppliers/suppliers";
import { createPayable, updatePayable, type PayableFormData } from "./payables";
import type { Payable } from "@/db/types";

/** Form tambah/edit HUTANG ke supplier (dicatat manual oleh pemilik). */
export function PayableForm({
  open,
  payable,
  onClose,
}: {
  open: boolean;
  payable?: Payable;
  onClose: () => void;
}) {
  const suppliers = useLiveQuery(() => searchSuppliers(""), []);
  const [supplierId, setSupplierId] = useState(payable?.supplier_id ?? "");
  const [jumlah, setJumlah] = useState(payable?.jumlah ?? 0);
  const [jatuhTempo, setJatuhTempo] = useState(
    payable?.jatuh_tempo ? payable.jatuh_tempo.slice(0, 10) : "",
  );
  const [catatan, setCatatan] = useState(payable?.catatan ?? "");
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!supplierId) return setErr("Pilih supplier.");
    if (jumlah <= 0) return setErr("Jumlah hutang harus lebih dari 0.");
    const data: PayableFormData = {
      supplier_id: supplierId,
      jumlah,
      jatuh_tempo: jatuhTempo ? new Date(jatuhTempo + "T00:00:00").toISOString() : null,
      catatan: catatan.trim(),
    };
    if (payable) await updatePayable(payable.id, data);
    else await createPayable(data);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={payable ? "Edit Hutang" : "Tambah Hutang"} size="sm">
      <div className="flex flex-col gap-4 p-5">
        <Field>
          <Label htmlFor="psupplier">Supplier</Label>
          <Select
            id="psupplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">— Pilih supplier —</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="pjumlah">Jumlah Hutang</Label>
          <MoneyInput id="pjumlah" value={jumlah} onChange={setJumlah} />
        </Field>
        <Field>
          <Label htmlFor="pjt">Jatuh Tempo (opsional)</Label>
          <Input
            id="pjt"
            type="date"
            value={jatuhTempo}
            onChange={(e) => setJatuhTempo(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="pcatatan">Catatan (opsional)</Label>
          <Input
            id="pcatatan"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. PO semen 50 sak"
          />
        </Field>
        <div className="flex justify-end gap-2">
          {err && <span className="mr-auto self-center text-sm text-danger">{err}</span>}
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}
