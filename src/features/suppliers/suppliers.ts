import { db } from "@/db/db";
import { newSyncBase, touch, softDelete } from "@/db/helpers";
import type { Supplier } from "@/db/types";

export interface SupplierFormData {
  nama: string;
  kontak: string;
  alamat: string;
  catatan: string;
}

export async function createSupplier(d: SupplierFormData): Promise<void> {
  const s: Supplier = { ...newSyncBase(), ...d, nama: d.nama.trim() };
  await db.suppliers.add(s);
}

export async function updateSupplier(id: string, d: SupplierFormData): Promise<void> {
  await db.suppliers.update(id, { ...d, nama: d.nama.trim(), ...touch() });
}

export async function deleteSupplier(id: string): Promise<void> {
  await db.suppliers.update(id, softDelete());
}

export async function searchSuppliers(query: string): Promise<Supplier[]> {
  const q = query.trim().toLowerCase();
  const all = await db.suppliers.where("deleted").equals(0).toArray();
  if (!q) return all;
  return all.filter(
    (s) => s.nama.toLowerCase().includes(q) || s.kontak.toLowerCase().includes(q),
  );
}
