import { db } from "@/db/db";
import { newSyncBase, touch, softDelete } from "@/db/helpers";
import { applyLedger, recomputeStock } from "./stock";
import type { Item, ItemUnit, HargaGrosir } from "@/db/types";
import type { BasisHarga } from "@/lib/pricing";

/** Data form item (tanpa field sync) untuk create/update. */
export interface ItemFormData {
  nama: string;
  merk: string;
  kategori: string;
  barcode: string;
  deskripsi: string;
  satuan_dasar: string;
  stok: number;
  stok_min: number;
  harga_beli: number;
  harga_jual: number;
  margin_persen: number;
  basis_harga: BasisHarga;
  harga_grosir: HargaGrosir[];
  favorit: 0 | 1;
  units: ItemUnitFormData[];
}

export interface ItemUnitFormData {
  id?: string; // ada bila edit baris lama
  satuan: string;
  konversi: number;
  barcode: string;
  harga_beli: number;
  harga_jual: number;
  margin_persen: number;
}

function toItemFields(d: ItemFormData) {
  return {
    nama: d.nama.trim(),
    merk: d.merk.trim(),
    kategori: d.kategori,
    barcode: d.barcode.trim(),
    deskripsi: d.deskripsi.trim(),
    satuan_dasar: d.satuan_dasar,
    stok_min: d.stok_min,
    harga_beli: d.harga_beli,
    harga_jual: d.harga_jual,
    margin_persen: d.margin_persen,
    basis_harga: d.basis_harga,
    harga_grosir: d.harga_grosir,
    favorit: d.favorit,
  };
}

/** Buat item baru + baris konversi + stok awal (via ledger). */
export async function createItem(d: ItemFormData): Promise<string> {
  const item: Item = {
    ...newSyncBase(),
    ...toItemFields(d),
    stok: 0, // diisi recompute dari ledger
  };

  await db.transaction(
    "rw",
    db.items,
    db.item_units,
    db.stock_ledger,
    async () => {
      await db.items.add(item);
      await saveUnits(item.id, d.units, []);
      // Stok awal sebagai baris ledger 'initial'.
      if (d.stok !== 0) {
        await applyLedger([
          {
            item_id: item.id,
            delta: d.stok,
            reason: "initial",
            harga_beli: d.harga_beli,
          },
        ]);
      } else {
        await recomputeStock(item.id);
      }
    },
  );

  return item.id;
}

/** Perbarui item + konversi. Penyesuaian stok dilakukan via ledger 'adjustment'. */
export async function updateItem(id: string, d: ItemFormData): Promise<void> {
  await db.transaction(
    "rw",
    db.items,
    db.item_units,
    db.stock_ledger,
    async () => {
      const existing = await db.items.get(id);
      if (!existing) return;

      await db.items.update(id, { ...toItemFields(d), ...touch() });

      const oldUnits = await db.item_units.where("item_id").equals(id).toArray();
      await saveUnits(id, d.units, oldUnits);

      // Selisih stok manual → koreksi via ledger (jaga prinsip delta).
      const selisih = d.stok - existing.stok;
      if (selisih !== 0) {
        await applyLedger([
          { item_id: id, delta: selisih, reason: "adjustment" },
        ]);
      }
    },
  );
}

/** Simpan baris konversi: tambah baru, update yang ada, soft-delete yang hilang. */
async function saveUnits(
  itemId: string,
  formUnits: ItemUnitFormData[],
  oldUnits: ItemUnit[],
): Promise<void> {
  const keepIds = new Set(formUnits.filter((u) => u.id).map((u) => u.id));

  // Soft-delete baris lama yang tidak ada lagi di form.
  for (const old of oldUnits) {
    if (!keepIds.has(old.id)) {
      await db.item_units.update(old.id, softDelete());
    }
  }

  for (const u of formUnits) {
    if (u.id) {
      await db.item_units.update(u.id, {
        satuan: u.satuan,
        konversi: u.konversi,
        barcode: u.barcode.trim(),
        harga_beli: u.harga_beli,
        harga_jual: u.harga_jual,
        margin_persen: u.margin_persen,
        ...touch(),
      });
    } else {
      const row: ItemUnit = {
        ...newSyncBase(),
        item_id: itemId,
        satuan: u.satuan,
        konversi: u.konversi,
        barcode: u.barcode.trim(),
        harga_beli: u.harga_beli,
        harga_jual: u.harga_jual,
        margin_persen: u.margin_persen,
      };
      await db.item_units.add(row);
    }
  }
}

export async function deleteItem(id: string): Promise<void> {
  await db.items.update(id, softDelete());
}

export async function toggleFavorit(id: string, favorit: 0 | 1): Promise<void> {
  await db.items.update(id, { favorit, ...touch() });
}

/**
 * Pencarian item: substring (bukan prefix kata pertama) di nama, merk, barcode.
 * "merdeka" menemukan "Semen Merdeka". Dataset 1 toko kecil → filter in-memory.
 */
export async function searchItems(query: string, limit = 30): Promise<Item[]> {
  const q = query.trim().toLowerCase();
  const all = await db.items.where("deleted").equals(0).toArray();
  if (!q) return all.slice(0, limit);
  return all
    .filter(
      (it) =>
        it.nama.toLowerCase().includes(q) ||
        it.merk.toLowerCase().includes(q) ||
        it.barcode.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

/**
 * Cari item berdasarkan barcode EXACT (dari scanner HID/kamera).
 * Cocokkan ke barcode item (satuan dasar) maupun barcode item_units (satuan
 * konversi). Bila cocok di item_units, kembalikan unit-nya agar kasir bisa
 * langsung jual pada satuan tersebut.
 */
export interface BarcodeHit {
  item: Item;
  unit: ItemUnit | null; // null = satuan dasar
}

export async function findByBarcode(barcode: string): Promise<BarcodeHit | null> {
  const code = barcode.trim();
  if (!code) return null;

  const item = await db.items
    .where("barcode")
    .equals(code)
    .filter((it) => it.deleted === 0)
    .first();
  if (item) return { item, unit: null };

  const unit = await db.item_units
    .where("barcode")
    .equals(code)
    .filter((u) => u.deleted === 0)
    .first();
  if (unit) {
    const parent = await db.items.get(unit.item_id);
    if (parent && parent.deleted === 0) return { item: parent, unit };
  }
  return null;
}

export type SortKey =
  | "nama"
  | "merk"
  | "kategori"
  | "harga_beli"
  | "harga_jual"
  | "margin_persen"
  | "stok";

export interface ItemFilter {
  query: string;
  kategori: string; // "" = semua
  merk: string; // "" = semua
  hanyaStokMenipis: boolean;
  sortBy: SortKey;
  sortDir: "asc" | "desc";
}

/** Daftar item terfilter + terurut untuk tampilan tabel. */
export async function listItems(f: ItemFilter): Promise<Item[]> {
  const q = f.query.trim().toLowerCase();
  let rows = await db.items.where("deleted").equals(0).toArray();

  if (q) {
    rows = rows.filter(
      (it) =>
        it.nama.toLowerCase().includes(q) ||
        it.merk.toLowerCase().includes(q) ||
        it.barcode.toLowerCase().includes(q),
    );
  }
  if (f.kategori) rows = rows.filter((it) => it.kategori === f.kategori);
  if (f.merk) rows = rows.filter((it) => it.merk === f.merk);
  if (f.hanyaStokMenipis) rows = rows.filter((it) => it.stok <= it.stok_min);

  const dir = f.sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[f.sortBy];
    const bv = b[f.sortBy];
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv, "id") * dir;
    }
    return ((av as number) - (bv as number)) * dir;
  });
  return rows;
}

/** Daftar merk unik (untuk dropdown filter). */
export async function listMerk(): Promise<string[]> {
  const rows = await db.items.where("deleted").equals(0).toArray();
  const set = new Set(rows.map((r) => r.merk).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b, "id"));
}

/**
 * Satu baris tampilan = satu SATUAN dari sebuah item.
 * Item dengan konversi dipecah jadi beberapa baris (dasar + tiap konversi),
 * masing-masing dengan harga & stok dalam satuan tersebut.
 */
export interface ItemUnitRow {
  itemId: string;
  rowKey: string; // unik per baris (itemId + satuan)
  item: Item; // item asli (untuk edit/hapus/favorit)
  satuan: string;
  konversi: number; // berapa satuan dasar per 1 satuan ini (1 = satuan dasar)
  isDasar: boolean;
  harga_beli: number;
  harga_jual: number;
  margin_persen: number;
  stok: number; // stok dinyatakan dalam satuan baris ini
}

/** listItems dipecah per satuan (dasar + konversi). */
export async function listItemRows(f: ItemFilter): Promise<ItemUnitRow[]> {
  const items = await listItems(f);
  const allUnits = await db.item_units.where("deleted").equals(0).toArray();
  const byItem = new Map<string, typeof allUnits>();
  for (const u of allUnits) {
    const arr = byItem.get(u.item_id) ?? [];
    arr.push(u);
    byItem.set(u.item_id, arr);
  }

  const rows: ItemUnitRow[] = [];
  for (const it of items) {
    // Baris satuan dasar.
    rows.push({
      itemId: it.id,
      rowKey: `${it.id}::__dasar`,
      item: it,
      satuan: it.satuan_dasar,
      konversi: 1,
      isDasar: true,
      harga_beli: it.harga_beli,
      harga_jual: it.harga_jual,
      margin_persen: it.margin_persen,
      stok: it.stok,
    });
    // Baris tiap satuan konversi.
    for (const u of byItem.get(it.id) ?? []) {
      rows.push({
        itemId: it.id,
        rowKey: `${it.id}::${u.id}`,
        item: it,
        satuan: u.satuan,
        konversi: u.konversi,
        isDasar: false,
        harga_beli: u.harga_beli,
        harga_jual: u.harga_jual,
        margin_persen: u.margin_persen,
        // stok dikonversi ke satuan ini (mis. 2000 KG ÷ 40 = 50 ZAK).
        stok: u.konversi > 0 ? it.stok / u.konversi : 0,
      });
    }
  }
  return rows;
}
