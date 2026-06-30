import { db } from "@/db/db";
import { newSyncBase, touch, softDelete } from "@/db/helpers";
import type { Category, Unit } from "@/db/types";

/**
 * CRUD Kategori & Satuan (dikelola di menu Produk).
 * Keduanya tabel sederhana ber-sync; dipakai dropdown form item.
 */

export async function addCategory(nama: string): Promise<void> {
  const c: Category = { ...newSyncBase(), nama: nama.trim() };
  await db.categories.add(c);
}

export async function renameCategory(id: string, nama: string): Promise<void> {
  await db.categories.update(id, { nama: nama.trim(), ...touch() });
}

export async function removeCategory(id: string): Promise<void> {
  await db.categories.update(id, softDelete());
}

export async function addUnit(nama: string): Promise<void> {
  const u: Unit = { ...newSyncBase(), nama: nama.trim() };
  await db.units.add(u);
}

export async function renameUnit(id: string, nama: string): Promise<void> {
  await db.units.update(id, { nama: nama.trim(), ...touch() });
}

export async function removeUnit(id: string): Promise<void> {
  await db.units.update(id, softDelete());
}

/** Kategori default toko bangunan & toserba (seed pertama kali). */
const DEFAULT_CATEGORIES = [
  "Semen",
  "Cat",
  "Keramik",
  "Besi & Baja",
  "Pipa & Sanitasi",
  "Cat & Kuas",
  "Listrik",
  "Toserba",
];
const DEFAULT_UNITS = ["PCS", "ZAK", "SAK", "DUS", "BATANG", "LEMBAR", "M2", "M3", "KG", "ROLL"];

/** Seed kategori & satuan default bila tabel masih kosong. */
export async function seedCatalogIfEmpty(): Promise<void> {
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(
      DEFAULT_CATEGORIES.map((nama) => ({ ...newSyncBase(), nama })),
    );
  }
  const unitCount = await db.units.count();
  if (unitCount === 0) {
    await db.units.bulkAdd(DEFAULT_UNITS.map((nama) => ({ ...newSyncBase(), nama })));
  }
}
