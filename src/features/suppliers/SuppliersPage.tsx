import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Search, Pencil, Trash2, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Field, Label } from "@/components/ui/Input";
import { Card, CardSection } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import type { Supplier } from "@/db/types";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  searchSuppliers,
  type SupplierFormData,
} from "./suppliers";

export function SuppliersPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Supplier | undefined>();

  const suppliers = useLiveQuery(() => searchSuppliers(query), [query]);

  async function handleDelete(s: Supplier) {
    if (confirm(`Hapus supplier "${s.nama}"?`)) await deleteSupplier(s.id);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Supplier</h1>
        <Button
          onClick={() => {
            setEdit(undefined);
            setOpen(true);
          }}
        >
          <Plus size={18} /> Tambah Supplier
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
        {suppliers?.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{s.nama}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                {s.kontak && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={13} /> {s.kontak}
                  </span>
                )}
                {s.alamat && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} /> {s.alamat}
                  </span>
                )}
              </div>
              {s.catatan && <div className="mt-1 text-sm text-ink-soft">{s.catatan}</div>}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  setEdit(s);
                  setOpen(true);
                }}
                aria-label="Edit"
              >
                <Pencil size={16} />
              </Button>
              <Button variant="secondary" size="icon" onClick={() => handleDelete(s)} aria-label="Hapus">
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
        {suppliers?.length === 0 && (
          <div className="p-8 text-center text-ink-soft">Belum ada supplier.</div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit Supplier" : "Tambah Supplier"}>
        <SupplierForm supplier={edit} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}

function SupplierForm({ supplier, onDone }: { supplier?: Supplier; onDone: () => void }) {
  const [nama, setNama] = useState(supplier?.nama ?? "");
  const [kontak, setKontak] = useState(supplier?.kontak ?? "");
  const [alamat, setAlamat] = useState(supplier?.alamat ?? "");
  const [catatan, setCatatan] = useState(supplier?.catatan ?? "");
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!nama.trim()) return setErr("Nama wajib diisi.");
    const data: SupplierFormData = { nama, kontak, alamat, catatan };
    if (supplier) await updateSupplier(supplier.id, data);
    else await createSupplier(data);
    onDone();
  }

  return (
    <div>
      <CardSection>
        <div className="grid gap-4">
          <Field>
            <Label htmlFor="snama">Nama</Label>
            <Input id="snama" value={nama} onChange={(e) => setNama(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="skontak">Kontak / No. HP</Label>
            <Input id="skontak" value={kontak} onChange={(e) => setKontak(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="salamat">Alamat</Label>
            <Input id="salamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="scatatan">Catatan</Label>
            <Input id="scatatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
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
