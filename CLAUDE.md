# CLAUDE.md — SJB POS

Panduan untuk Claude saat bekerja di repo ini. Aplikasi **POS PWA offline-first** untuk toko bangunan & toserba Indonesia. UI **Bahasa Indonesia**, target **zero-cost** (free tier).

> **Dokumen acuan lengkap**: [`SPESIFIKASI.md`](SPESIFIKASI.md) (single source of truth — fitur, skema data, detail semua fase, **blueprint Fase 5**). Untuk agen Codex: [`AGENTS.md`](AGENTS.md) (konvensi setara). Proyek ini akan dilanjutkan menggunakan **Codex** ke depannya — jaga ketiga dokumen (`CLAUDE.md`, `AGENTS.md`, `SPESIFIKASI.md`) tetap selaras saat ada perubahan besar.

## Perintah

```bash
npm run dev      # dev server (http://localhost:5173)
npm run build    # build produksi + type check (tsc -b && vite build)
npm test         # unit test (Vitest)
npm run lint     # ESLint
npx tsc -b       # type check saja (jalankan setelah perubahan besar)
```

Dev server dijalankan di background; restart **wajib** setiap `.env.local` berubah (Vite hanya baca env saat start).

## Stack

React 18 + Vite + TypeScript · Tailwind v3 (komponen UI custom ringan, bukan shadcn CLI) · Dexie.js (IndexedDB) · Supabase (Auth + Postgres + Realtime + RLS) · vite-plugin-pwa · lucide-react · date-fns · @zxing/browser (kamera barcode). Struk: HTML + `window.print()` (TANPA jspdf — sengaja tak dipasang; lihat `features/sales/printReceipt.ts`).

## Arsitektur & aturan WAJIB

- **Offline-first**: semua tulis ke Dexie dulu (UI instan via `useLiveQuery`), sync ke Supabase belakangan. JANGAN tulis langsung ke Supabase dari komponen fitur.
- **Uang = integer Rupiah** (tanpa desimal). Pakai `lib/money.ts`. Format hanya di view (`formatRupiah`).
- **Stok = delta append-only** lewat `stock_ledger` (`features/items/stock.ts`). `items.stok` adalah proyeksi cache = jumlah delta. JANGAN timpa `items.stok` langsung — selalu lewat `applyLedger()` lalu `recomputeStock()`. Delta SELALU dalam **satuan dasar**.
- **Bentuk sync di tiap record**: `id` (uuid client, `lib/uuid.ts`), `store_id`, `created_at`, `updated_at`, `deleted` (soft delete). Field lokal-saja: `dirty`, `sync_state`. Gunakan helper `db/helpers.ts`:
  - record baru → `newSyncBase()`
  - update → `...touch()`
  - hapus → `...softDelete()` (soft delete, bukan `.delete()`)
- **Skema Dexie** (`db/db.ts`): `.where("X")` hanya untuk field yang **di-index**. Perubahan skema = **`db.version(n)` BARU**, jangan ubah versi lama (PWA terpasang simpan IndexedDB lama). Versi saat ini: **v5**. (v2: index `deleted` di categories/units/item_units/payables. v3: index `deleted` di receivables/payments. v4: tabel `counters` lokal-saja + index `no_nota` di transactions. v5: tabel `purchases`/`purchase_items` + index `purchase_id` di payables.) Catatan: `transactions` TAK ber-index `deleted` → filter `deleted` di memori.
- **Peran**: `pemilik` (akses penuh) & `kasir` (transaksi + cek harga + lihat stok). Gating UI via `RequireAuth roles={[...]}` di `app/router.tsx` + RLS di Supabase. Kasir TIDAK boleh ubah master/harga beli/settings.
- **`useLiveQuery` = transaksi READ-ONLY**: querier-nya JANGAN menulis ke Dexie (mis. seed) — picu "Readwrite transaction in liveQuery context" & crash route. Pola: fungsi `readX()` murni-baca (fallback default in-memory bila belum ada), seed lewat `seedXIfEmpty()` di `useEffect` saat mount. Contoh: `features/settings/settings.ts` (`readSettings`/`seedSettingsIfEmpty`), `features/items/catalog.ts` (`seedCatalogIfEmpty`).

## Keputusan produk (dari user)

- **Satu toko** (`store_id` tunggal, `VITE_STORE_ID`).
- **Sync custom**, otomatis & terus-menerus saat online (TANPA timer 15/30 dtk) — dibangun di Fase 5.
- **Margin 2-arah** (`lib/pricing.ts`, ada unit test): ubah margin% → harga jual ikut, & sebaliknya. `basis_harga` menentukan mana yang dipertahankan saat harga beli berubah.
- **Konversi satuan** (`item_units`): stok disimpan dalam **satuan dasar**; satuan lain (TRUK/DUS/ZAK) = jalan pintas + opsi jual. "Hitung Harga Pokok Dasar" = harga satuan besar ÷ konversi. (Arah konversi <1 spt KG akan dibahas di Fase 3.)
- **Item** punya field **merk**. **Pencarian substring** (bukan prefix), 1 huruf langsung muncul, cocokkan nama+merk+barcode.
- **DUA toggle terpisah** (Pengaturan, Fase 8): (a) stok boleh minus STRICT/LONGGAR, (b) ubah harga di kasir STRICT/LONGGAR.
- **Favorit item global toko**. **Kategori & satuan** dikelola di menu **Produk** (bukan Pengaturan).
- Tabel Produk: satu **baris per satuan** (dasar + tiap konversi), harga/stok per satuan; sort klik header; filter kategori/merk/stok-menipis.
- **Kasir (Jual Tunai)**: diskon **per-baris item** (nominal/persen), BUKAN diskon transaksi. Harga grosir otomatis per qty; override manual matikan auto-grosir.
- **Edit harga di kasir**: pemilik bebas (peringatan merah bila < modal, tetap boleh). Kasir saat `harga_mode='strict'` butuh **PIN pemilik** (`Settings.owner_pin`); `'longgar'` bebas. Scan satuan-konversi → langsung pakai satuan itu; tap item multi-satuan → pilih satuan dulu.
- **Biaya tambahan** (ongkir/buruh/potong kayu): free-text label + nominal bebas, beberapa baris, di keranjang. Bukan item (tak potong stok), dilaporkan terpisah sebagai biaya (`Transaction.biaya[]`).
- **Cetak nota** opsional di layar sukses bayar: bisa lanjut tanpa cetak, atau cetak lalu transaksi baru. Cetak langsung tanpa edit (template editable = Fase 7).

## Struktur folder (feature-based)

```
src/
  app/        router, Layout (shell+nav), nav.ts
  db/         db.ts (skema Dexie), types.ts, helpers.ts        ← spine
  lib/        money, pricing, format (+todayInput/dateInputToIso), uuid, device, supabase, cn  ← spine
  features/   auth, items (catalog, stock, ItemForm), customers, suppliers, sales,
              credit (receivables/payables/payments/allocate, DebtsPage),
              purchasing (purchases, PurchaseForm, PurchasePage), history (riwayat+edit/hapus)
  components/ ui/ (Button, Input, Card, Modal, MoneyInput), SyncStatusBar, PagePlaceholder
  hooks/      useOnlineStatus
supabase/migrations/  0001_init.sql (tabel+RLS+trigger), 0002_seed_owner.sql
```

## Status fase

- [x] **Fase 0** Fondasi (PWA, shell, skema Dexie, lib/)
- [x] **Fase 1** Auth + peran (Supabase Auth, role guard, sesi offline, login sekali online)
- [x] **Fase 2** Data master — Produk (margin 2-arah, konversi, merk, tabel sort/filter, baris per satuan), Customer, Supplier, kategori & satuan
- [x] **Fase 3** Barcode + Jual Tunai (multi-satuan, favorit, diskon per-baris, **biaya tambahan** free-text+nominal, edit harga + otorisasi PIN/peran, scan HID+kamera, cek stok mode, **cetak nota** opsional di layar sukses) — `features/sales/` (cart.ts murni+test, checkout.ts, SalesPage 2-kolom). Settings di-seed otomatis (`features/settings/settings.ts`), default toggle `longgar`, field baru `owner_pin`. Biaya tambahan disimpan di `Transaction.biaya[]` (JSON, bukan item; untuk laporan biaya). Nota: `receipt.ts` (data) + `printReceipt.ts` (HTML + `window.print()` via iframe, @page 58/80mm, tanpa jspdf).
- [x] **Fase 4** Jual Piutang + Hutang(=Pembelian) + Pembayaran — `features/credit/` + `features/purchasing/`. Logika murni+test: `credit/payments.ts` (sisa & status = jumlah − Σ pembayaran), `sales/invoiceNumber.ts` (nomor nota). **Nomor nota** `<prefix>/<thn>/<bln>/<perangkat>-<5digit>` (cash/piu/beli), counter lokal per perangkat (`lib/device.ts`) reset/bulan, disimpan di tabel `counters` (lokal-saja). **Piutang** = sisa belum-lunas dari penjualan **tunai (kurang bayar)** ATAU **piutang** — `buildSale()` di `checkout.ts` bikin Receivable bila `dibayar<total` (tunai: customer opsional→"Umum"; piutang: wajib). Field `Transaction.no_nota` + `catatan` (tampil di daftar piutang). **Hutang = pembelian barang** dari supplier: `purchasing/checkoutPurchase()` → ledger `restock` (supplier_id+harga_beli utk riwayat Fase 6) + Payable bila kurang bayar; `PurchaseForm` (pilih supplier+barang+qty+harga). Hutang manual masih ada (`PayableForm`, `purchase_id=null`). `DebtsPage` 2 tab, badge status/terlambat, `PayBillModal` cicilan+riwayat. Sisa/status SELALU di-recompute dari pembayaran (aman saat sync). Skema Dexie **v5** (v3 index deleted receivables/payments; v4 counters + index no_nota; v5 purchases/purchase_items + payables.purchase_id). `Receivable.customer_id` & `Payable.purchase_id` nullable. `/piutang` pemilik+kasir, `/hutang-piutang` pemilik-only.
- [x] **Fase 4b** (lanjutan, dari koreksi user): **Riwayat Transaksi** (`features/history/`, menu `/riwayat` pemilik+kasir) — daftar semua penjualan (tunai/piutang) + pembelian (lunas & belum), **edit & hapus**. Edit/hapus = SOFT-DELETE seluruh turunan (items, ledger, receivable/payable + payment) lalu (untuk edit) bangun ulang dgn id/no_nota dipertahankan + recompute stok (`reverseSaleEffects`/`reversePurchaseEffects`, `editSale` di checkout.ts, `editPurchase` di purchases.ts). Pembelian: bisa **pilih satuan** (dasar/konversi) per baris + **tanggal pembelian** (`PurchaseForm` kini dipakai create & edit). Hutang & Piutang (`DebtsPage`): `PayBillModal` jadi **riwayat pelunasan** dgn **edit/hapus pembayaran** (recompute sisa) — `editPembayaran*`/`hapusPembayaran*` di receivables/payables.ts. Penjualan lunas tampil di **Riwayat** (bukan di list piutang). Helper baru: `cart.lineFromTransactionItem`, `CartPanel hideBayar`, `format.todayInput`/`dateInputToIso`. (Belum ada tabel/index baru — pakai skema v5.)
- [x] **Fase 4c** (lanjutan): **Menu Pembelian** terpisah (`/pembelian`, pemilik-only, `PurchasePage`) — tombol "Pembelian Barang" pindah ke sini dari Hutang-Piutang; daftar pembelian + edit dialihkan ke Riwayat. **Pelunasan per pihak** di Hutang-Piutang (`SettlementModal`): pilih customer/supplier → daftar tagihan belum lunas (multi-pilih centang) → input jumlah → **alokasi FIFO tertua-dulu** (`allocate.ts` murni+test) ke tagihan terpilih; tombol "Lunasi semua terpilih". Batch pay: `bayarPiutangBatch`/`bayarHutangBatch` (atomik, Payment + recompute per tagihan). Query: `piutangBelumLunasCustomer`/`hutangBelumLunasSupplier`. Piutang "Umum" (customer null) didukung di pelunasan. **Tanggal pembayaran bisa dipilih** (default hari ini, `max`=hari ini) di `PayBillModal` (pembayaran baru + saat edit baris riwayat) & `SettlementModal` — untuk mencatat pembayaran lampau yang lupa diinput; semua fungsi `bayar*`/`editPembayaran*`/`*Batch` punya param `tanggal?` (ISO, default `nowIso()`). DP saat checkout penjualan tetap pakai tanggal transaksi.
- [~] **Fase 5** Sync engine (otomatis, pull/push, konflik LWW, stok-ledger) — **DIMULAI, DIJEDA DI TAHAP DESAIN**. Blueprint lengkap di [`SPESIFIKASI.md` §10](SPESIFIKASI.md). ⚠️ Sebelum menulis kode sync, **tanyakan ulang ke user 2 keputusan tertunda** (LWW `updated_at` server/klien; sync `stock_ledger` merge-insert/LWW — §10.1). Prasyarat: perbaiki bug index `dirty` di `transactions` (skema **v6**) & buat migration server **`0003`** untuk tabel/kolom Fase 3/4 yang belum ada di Supabase (§10.2). ← BERIKUTNYA
- [ ] **Fase 6** Laporan + Cek Harga (margin + riwayat pembelian)
- [ ] **Fase 7** Struk/Nota (digital, **template editable**, thermal) — fondasi sudah ada di `features/sales/receipt.ts` + `printReceipt.ts`; Fase 7 tinggal tambah template token (`Settings.struk_template`), logo, & tuning thermal di atas struktur ini (JANGAN buat ulang).
- [ ] **Fase 8** Pengaturan + poles + seed + README + hardening

> Sebelum Fase 5: data hanya lokal (IndexedDB). Bar status "X belum tersinkron" itu normal — baris `dirty` menunggu sync engine (Fase 5).

## Catatan

- **Acuan utama**: [`SPESIFIKASI.md`](SPESIFIKASI.md) (fitur, skema, semua fase, blueprint Fase 5) + [`AGENTS.md`](AGENTS.md) (Codex). Plan lengkap: `C:\Users\xltnt\.claude\plans\saya-memiliki-prompt-aplikasi-pos-md-jazzy-wren.md`. Spec asli: `PROMPT-APLIKASI-POS.md`. Mockup form item: `scratchpad/mockup-input-barang.html`.
- `.env.local` (tidak di-commit): `VITE_SUPABASE_URL` (HANYA origin proyek, TANPA `/rest/v1`), `VITE_SUPABASE_ANON_KEY`, `VITE_STORE_ID`. Anon key format `sb_publishable_…` didukung.
- Verifikasi tiap fase: `npx tsc -b` + cek dev server, lalu konfirmasi alur ke user. Jalankan `npm test` jika mengubah `lib/pricing.ts` atau logika uang/stok.
