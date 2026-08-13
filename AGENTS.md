# AGENTS.md — SJB POS

Panduan untuk agen AI (Codex CLI, dll.) yang bekerja di repo ini. Aplikasi **POS PWA offline-first** untuk toko bangunan & toserba Indonesia. UI **Bahasa Indonesia**, target **zero-cost** (free tier).

> **Dokumen acuan lengkap**: baca [`SPESIFIKASI.md`](SPESIFIKASI.md) — berisi fitur, arsitektur, skema data, status semua fase, dan **blueprint Fase 5 (sync engine)** yang sedang berjalan. File ini (`AGENTS.md`) hanya ringkasan konvensi; `SPESIFIKASI.md` yang mengikat. [`CLAUDE.md`](CLAUDE.md) berisi info setara untuk agen Claude.

## Perintah

```bash
npm run dev      # dev server (http://localhost:5173)
npm run build    # build produksi + type check (tsc -b && vite build)
npm test         # unit test (Vitest)
npm run lint     # ESLint
npx tsc -b       # type check saja (jalankan setelah perubahan besar)
```

Dev server di background; **restart wajib** setiap `.env.local` berubah (Vite hanya baca env saat start).

## Stack

React 18 + Vite + TypeScript · Tailwind v3 (komponen UI custom ringan) · Dexie.js (IndexedDB) · Supabase (Auth + Postgres + Realtime + RLS) · vite-plugin-pwa · lucide-react · date-fns · @zxing/browser. Struk: HTML + `window.print()` (TANPA jspdf — sengaja).

## Aturan WAJIB (ringkas — detail di SPESIFIKASI.md §2)

1. **Offline-first**: tulis ke **Dexie dulu** (UI instan via `useLiveQuery`), sync ke Supabase belakangan. **JANGAN** tulis langsung ke Supabase dari komponen fitur — hanya sync engine (Fase 5).
2. **Uang = integer Rupiah** (tanpa desimal), pakai `lib/money.ts`. Format hanya di view.
3. **Stok = delta append-only** lewat `stock_ledger` (`features/items/stock.ts`). `items.stok` = proyeksi cache = Σ delta. JANGAN timpa langsung — lewat `applyLedger()` + `recomputeStock()`. Delta **selalu satuan dasar**.
4. **Bentuk sync tiap record** (`SyncBase`): `id` (UUID klien), `store_id`, `created_at`, `updated_at`, `deleted`. Lokal-saja: `dirty`, `sync_state`. Helper `db/helpers.ts`: baru→`newSyncBase()`, update→`...touch()`, hapus→`...softDelete()` (soft delete, **bukan** `.delete()`).
5. **Skema Dexie** (`db/db.ts`): `.where("X")` hanya untuk field **ber-index**. Ubah skema = **`db.version(n)` BARU**, jangan ubah versi lama. Versi saat ini **v5** (Fase 5 menambah v6).
6. **Peran**: `pemilik` (penuh) & `kasir` (transaksi + cek harga + lihat stok). Gating `RequireAuth roles={[...]}` + RLS Supabase. Kasir TIDAK ubah master/harga beli/settings.
7. **`useLiveQuery` = READ-ONLY**: querier JANGAN menulis ke Dexie (mis. seed) → crash. Pola: `readX()` murni-baca + `seedXIfEmpty()` di `useEffect`.
8. **Atomik**: operasi finansial multi-tabel pakai `db.transaction("rw", [...], ...)`.
9. **Edit/hapus transaksi**: soft-delete turunan lalu bangun ulang (`features/history/history.ts`).

## Status Proyek

**Fase 5 (Sync Engine)**: ✅ SELESAI dengan keputusan CLIENT-WINS + push individual delta. Implementasi lengkap di `src/lib/sync/`, skema Dexie v6-v9, migration server 0003-0005. Semua test lulus (80 tests passed).

Sync engine otomatis & event-driven (tanpa timer), terintegrasi di `Layout.tsx` dengan `SyncStatusBar`. Offline-first tetap jalan penuh. Detail lengkap di [`SPESIFIKASI.md` §10](SPESIFIKASI.md).

## Verifikasi

`npx tsc -b` + cek dev server, lalu konfirmasi alur ke user. `npm test` jika mengubah `lib/pricing.ts` atau logika uang/stok. Jangan klaim selesai tanpa bukti (lulus type-check/test).

## Catatan

- `.env.local` (tidak di-commit): `VITE_SUPABASE_URL` (HANYA origin, TANPA `/rest/v1`), `VITE_SUPABASE_ANON_KEY`, `VITE_STORE_ID`.
- Spec produk asli: `PROMPT-APLIKASI-POS.md`. Mockup form item: `scratchpad/mockup-input-barang.html` (bila ada).
