import { db } from "@/db/db";
import { newSyncBase, touch, softDelete } from "@/db/helpers";
import type { Customer } from "@/db/types";

export interface CustomerFormData {
  nama: string;
  kontak: string;
  alamat: string;
  limit_kredit: number;
  harga_khusus: 0 | 1;
}

export async function createCustomer(d: CustomerFormData): Promise<void> {
  const c: Customer = { ...newSyncBase(), ...d, nama: d.nama.trim() };
  await db.customers.add(c);
}

export async function updateCustomer(id: string, d: CustomerFormData): Promise<void> {
  await db.customers.update(id, { ...d, nama: d.nama.trim(), ...touch() });
}

export async function deleteCustomer(id: string): Promise<void> {
  await db.customers.update(id, softDelete());
}

/** Total piutang berjalan per customer (jumlah sisa receivable belum lunas). */
export async function totalPiutangCustomer(customerId: string): Promise<number> {
  const rows = await db.receivables
    .where("customer_id")
    .equals(customerId)
    .filter((r) => r.deleted === 0 && r.status !== "lunas")
    .toArray();
  return rows.reduce((sum, r) => sum + r.sisa, 0);
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const q = query.trim().toLowerCase();
  const all = await db.customers.where("deleted").equals(0).toArray();
  if (!q) return all;
  return all.filter(
    (c) => c.nama.toLowerCase().includes(q) || c.kontak.toLowerCase().includes(q),
  );
}
