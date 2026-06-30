/**
 * Kode perangkat singkat untuk membuat nomor nota unik antar-perangkat tanpa
 * server (app offline-first multi-perangkat). Dua kasir yang offline bersamaan
 * tak akan menghasilkan nomor nota yang sama karena tiap perangkat punya kode
 * berbeda: cash/2026/06/A-00001 vs cash/2026/06/B-00001.
 *
 * Disimpan di localStorage (per perangkat, bukan ikut sync). Dibuat sekali saat
 * pertama dibutuhkan.
 */

const KEY = "sjb_device_code";

/** Karakter ringkas & jelas dibaca manusia (tanpa 0/O/1/I yang ambigu). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 2): string {
  let s = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

/** Kode perangkat (mis. "A7"). Stabil selama localStorage tidak dibersihkan. */
export function deviceCode(): string {
  let code = localStorage.getItem(KEY);
  if (!code) {
    code = randomCode();
    localStorage.setItem(KEY, code);
  }
  return code;
}
