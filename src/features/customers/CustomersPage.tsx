import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Search, Pencil, Trash2, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Field, Label } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { CardSection } from "@/components/ui/Card";
import type { Customer } from "@/db/types";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  type CustomerFormData,
} from "./customers";

export function CustomersPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | undefined>();

  const customers = useLiveQuery(() => searchCustomers(query), [query]);

  function openAdd() {
    setEdit(undefined);
    setOpen(true);
  }
  function openEdit(c: Customer) {
    setEdit(c);
    setOpen(true);
  }
  async function handleDelete(c: Customer) {
    if (confirm(`Hapus customer "${c.nama}"?`)) await deleteCustomer(c.id);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Customer</h1>
        <Button onClick={openAdd}>
          <Plus size={18} /> Tambah Customer
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" size={18} />
        <Input
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama atau kontak…"
        />
      </div>

      <Card className="divide-y divide-line">
        {customers?.map((c) => (
          <Row key={c.id} c={c} onEdit={() => openEdit(c)} onDelete={() => handleDelete(c)} />
        ))}
        {customers?.length === 0 && (
          <div className="p-8 text-center text-ink-soft">Belum ada customer.</div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit Customer" : "Tambah Customer"}>
        <CustomerForm customer={edit} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}

function Row({ c, onEdit, onDelete }: { c: Customer; onEdit: () => void; onDelete: () => void }) {
  const piutang = useLiveQuery(async () => {
    const { totalPiutangCustomer } = await import("./customers");
    return totalPiutangCustomer(c.id);
  }, [c.id]);

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{c.nama}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-soft">
          {c.kontak && (
            <span className="inline-flex items-center gap-1">
              <Phone size={13} /> {c.kontak}
            </span>
          )}
          {c.alamat && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {c.alamat}
            </span>
          )}
        </div>
        {(piutang ?? 0) > 0 && (
          <div className="num mt-1 text-sm font-medium text-warn">
            Piutang berjalan: Rp {(piutang ?? 0).toLocaleString("id-ID")}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="secondary" size="icon" onClick={onEdit} aria-label="Edit">
          <Pencil size={16} />
        </Button>
        <Button variant="secondary" size="icon" onClick={onDelete} aria-label="Hapus">
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}

function CustomerForm({ customer, onDone }: { customer?: Customer; onDone: () => void }) {
  const [nama, setNama] = useState(customer?.nama ?? "");
  const [kontak, setKontak] = useState(customer?.kontak ?? "");
  const [alamat, setAlamat] = useState(customer?.alamat ?? "");
  const [limit, setLimit] = useState(customer?.limit_kredit ?? 0);
  const [hargaKhusus, setHargaKhusus] = useState<0 | 1>(customer?.harga_khusus ?? 0);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!nama.trim()) return setErr("Nama wajib diisi.");
    const data: CustomerFormData = {
      nama,
      kontak,
      alamat,
      limit_kredit: limit,
      harga_khusus: hargaKhusus,
    };
    if (customer) await updateCustomer(customer.id, data);
    else await createCustomer(data);
    onDone();
  }

  return (
    <div>
      <CardSection>
        <div className="grid gap-4">
          <Field>
            <Label htmlFor="cnama">Nama</Label>
            <Input id="cnama" value={nama} onChange={(e) => setNama(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="ckontak">Kontak / No. HP</Label>
            <Input id="ckontak" value={kontak} onChange={(e) => setKontak(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="calamat">Alamat</Label>
            <Input id="calamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="climit">Limit Kredit (opsional)</Label>
            <MoneyInput id="climit" value={limit} onChange={setLimit} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hargaKhusus === 1}
              onChange={(e) => setHargaKhusus(e.target.checked ? 1 : 0)}
              className="h-4 w-4"
            />
            Customer dapat harga khusus
          </label>
        </div>
      </CardSection>
      <div className="flex justify-end gap-3 border-t border-line px-5 py-4">
        {err && <span className="mr-auto text-sm text-danger">{err}</span>}
        <Button variant="secondary" onClick={onDone}>
          Batal
        </Button>
        <Button onClick={save}>Simpan</Button>
      </div>
    </div>
  );
}
