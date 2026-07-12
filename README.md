# SJB POS — Aplikasi Kasir Toko Bangunan & Toserba

Aplikasi **Point of Sale (POS)** berbasis **PWA, offline-first**, untuk toko bangunan & toserba di Indonesia. Jalan penuh tanpa internet, mendukung beberapa perangkat dalam satu toko dengan sinkronisasi, dan diupayakan **tanpa biaya** (free tier).

## Teknologi

- **Frontend/PWA**: React + Vite + TypeScript + `vite-plugin-pwa`
- **UI**: Tailwind CSS (komponen ringan custom)
- **Data lokal**: IndexedDB via Dexie.js (offline-first)
- **Cloud/sync**: Supabase (PostgreSQL + Auth + Realtime + RLS)
- **Barcode**: `@zxing/browser` (kamera) + scanner Bluetooth HID
- **Hosting**: Cloudflare Pages / Vercel / Netlify

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi kredensial Supabase (opsional saat dev offline)
npm run dev                  # http://localhost:5173
```

Tanpa `.env.local`, aplikasi tetap jalan **sepenuhnya offline** (data di IndexedDB); sinkronisasi nonaktif sampai env Supabase diisi.

### Perintah lain

```bash
npm run build     # build produksi (+ type check) → dist/
npm run preview   # pratinjau hasil build
npm test          # unit test (Vitest)
npm run lint      # ESLint
```

## Status Pengembangan (per fase)

- [x] **Fase 0 — Fondasi**: PWA, app shell + navigasi, skema Dexie (bentuk sync), util `lib/`, bar status sync.
- [x] **Fase 1 — Auth + peran** (Pemilik/Kasir, sesi offline)
- [x] **Fase 2 — Data master** (Produk dgn margin/konversi/merk, Customer, Supplier, kategori & satuan)
- [x] **Fase 3 — Barcode + Jual Tunai** (multi-satuan, diskon baris, biaya tambahan, cetak nota)
- [x] **Fase 4 — Jual Piutang + Hutang/Pembelian + Pembayaran** (+ Riwayat, Pembelian, pelunasan FIFO)
- [x] **Fase 5 — Sync engine** (otomatis & terus-menerus; event-driven tanpa timer, LWW server wins, realtime subscription)
- [x] **Fase 6 — Cek Harga** (lookup + riwayat pembelian) + **Laporan** (penjualan, laba/rugi, piutang/hutang, arus kas, CSV)
- [x] **Fase 7 — Struk/Nota** (template token `{nama_toko}`, `{items}`, `{total}`, dll; dukungan `struk_template` di pengaturan; share via WhatsApp)
- [x] **Fase 8 — Pengaturan** (profil toko, aturan stok/harga, owner PIN, manajemen pengguna, backup/restore JSON)

> Spesifikasi lengkap (fitur, skema data, detail semua fase, blueprint Fase 5): **[`SPESIFIKASI.md`](SPESIFIKASI.md)**. Panduan agen: [`CLAUDE.md`](CLAUDE.md) (Claude) · [`AGENTS.md`](AGENTS.md) (Codex).

## Arsitektur singkat

- **Offline-first**: semua operasi ditulis ke IndexedDB dulu (UI instan), lalu disinkron ke Supabase saat online.
- **Uang** disimpan sebagai integer Rupiah (tanpa desimal) untuk hindari drift.
- **Stok** dicatat sebagai delta append-only (ledger) dalam satuan dasar — mencegah penjualan hilang saat dua perangkat jual barang sama bersamaan.
- **Konversi satuan**: stok disimpan dalam satuan dasar; satuan besar (truk/dus) adalah jalan pintas input & opsi jual.

Detail desain & rencana lengkap ada di `PROMPT-APLIKASI-POS.md` dan dokumen rencana.
