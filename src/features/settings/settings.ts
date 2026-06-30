import { db } from "@/db/db";
import { newSyncBase } from "@/db/helpers";
import type { Settings } from "@/db/types";

/**
 * Settings toko (satu baris). Dibuat dengan default saat pertama kali dipakai.
 * Pengaturan penuh (UI edit) dibangun di Fase 8; di sini hanya seed + baca.
 *
 * Default toggle: longgar (boleh stok minus & kasir boleh ubah harga) —
 * agar kasir tetap bisa bekerja sebelum Pengaturan tersedia. owner_pin "" =
 * gerbang PIN nonaktif sampai pemilik mengisinya di Fase 8.
 */

export const SETTINGS_ID = "settings_singleton";

function defaultSettings(): Settings {
  return {
    ...newSyncBase(),
    id: SETTINGS_ID,
    nama_toko: "",
    alamat_toko: "",
    kontak_toko: "",
    logo_url: "",
    pajak_persen: 0,
    diskon_default: 0,
    ukuran_printer: "58mm",
    struk_template: "",
    struk_tampil_logo: 1,
    struk_tampil_alamat: 1,
    struk_footer: "",
    stok_mode: "longgar",
    harga_mode: "longgar",
    owner_pin: "",
  };
}

/**
 * Seed baris Settings bila belum ada. Panggil dari useEffect (BUKAN dari
 * useLiveQuery — querier liveQuery berjalan di transaksi read-only).
 */
export async function seedSettingsIfEmpty(): Promise<void> {
  const existing = await db.settings.get(SETTINGS_ID);
  if (!existing) await db.settings.add(defaultSettings());
}

/**
 * Baca Settings (read-only, aman untuk useLiveQuery). Kembalikan default
 * in-memory bila baris belum sempat di-seed (tidak menulis ke DB).
 */
export async function readSettings(): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? defaultSettings();
}
