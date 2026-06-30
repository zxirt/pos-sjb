# SPESIFIKASI — SJB POS

> Dokumen acuan tunggal (single source of truth) untuk fitur, arsitektur, skema data, dan rencana semua fase aplikasi **SJB POS**. Ditujukan agar **siapa pun (manusia atau agen AI seperti Codex/Claude) dapat melanjutkan pengembangan** tanpa kehilangan konteks. Bahasa antarmuka & domain: **Bahasa Indonesia**.
>
> Baca bersama: [`CLAUDE.md`](CLAUDE.md) (panduan agen ringkas) · [`AGENTS.md`](AGENTS.md) (konvensi untuk Codex) · [`PROMPT-APLIKASI-POS.md`](PROMPT-APLIKASI-POS.md) (spec produk asli) · [`README.md`](README.md) (cara jalan).

---

## 1. Ringkasan Produk

**SJB POS** = aplikasi **Point of Sale** untuk **toko bangunan & toserba** kecil-menengah di Indonesia.

| Atribut | Keputusan |
|---|---|
| Bentuk | **PWA** (Progressive Web App), installable di HP & PC |
| Mode | **Offline-first** — jalan penuh tanpa internet |
| Multi-perangkat | **Satu toko**, beberapa perangkat, sinkron via Supabase |
| Biaya | **Zero-cost** (free tier Supabase + hosting gratis) |
| Bahasa | **Indonesia** untuk semua label, pesan, format (Rupiah, tanggal) |
| Peran | **Pemilik** (akses penuh) & **Kasir** (transaksi + cek harga + lihat stok) |

### Stack

- **Frontend/PWA**: React 18 + Vite + TypeScript + `vite-plugin-pwa`
- **UI**: Tailwind v3 + komponen ringan custom (`components/ui/`), `lucide-react`, `date-fns`
- **Data lokal**: IndexedDB via **Dexie.js** (+ `dexie-react-hooks` `useLiveQuery`)
- **Cloud/sync**: **Supabase** (PostgreSQL + Auth + Realtime + RLS)
- **Barcode**: `@zxing/browser` (kamera) + scanner Bluetooth HID (keyboard wedge)
- **Struk**: HTML + `window.print()` via iframe (**tanpa jspdf** — sengaja)
- **Hosting**: Cloudflare Pages / Vercel / Netlify (gratis)

---

## 2. Prinsip Arsitektur (WAJIB dipatuhi)

Aturan ini mengikat semua kode baru. Pelanggaran = bug data/sync.

1. **Offline-first**: semua tulis ke **Dexie dulu** (UI instan via `useLiveQuery`), sync ke Supabase belakangan. **JANGAN** tulis langsung ke Supabase dari komponen fitur — hanya sync engine (Fase 5) yang bicara ke Supabase.
2. **Uang = integer Rupiah** (tanpa desimal). Pakai `lib/money.ts`. Format hanya di view (`formatRupiah`). Hindari float → cegah drift.
3. **Stok = delta append-only** lewat `stock_ledger` (`features/items/stock.ts`). `items.stok` = **proyeksi cache** = Σ delta non-deleted. **JANGAN** timpa `items.stok` langsung — selalu lewat `applyLedger()` lalu `recomputeStock()`. Delta **SELALU dalam satuan dasar**. Pola ini mencegah "penjualan hilang" saat dua perangkat menjual barang sama offline.
4. **Bentuk sync di tiap record** (lihat `SyncBase` di [`src/db/types.ts`](src/db/types.ts)): `id` (UUID klien, `lib/uuid.ts`), `store_id`, `created_at`, `updated_at`, `deleted` (soft delete). Field **lokal-saja** (dibuang sebelum push): `dirty`, `sync_state`. Gunakan helper [`src/db/helpers.ts`](src/db/helpers.ts):
   - record baru → `newSyncBase()`
   - update → `...touch()`
   - hapus → `...softDelete()` (**bukan** `.delete()`)
5. **Skema Dexie** ([`src/db/db.ts`](src/db/db.ts)): `.where("X")` hanya untuk field **ber-index**. Perubahan skema = **`db.version(n)` BARU**, jangan ubah versi lama (PWA terpasang menyimpan IndexedDB lama). Versi saat ini: **v5** (lihat §6).
6. **Peran & otorisasi**: gating UI via `RequireAuth roles={[...]}` di `app/router.tsx` **+** RLS di Supabase. Kasir TIDAK boleh ubah master/harga beli/settings.
7. **`useLiveQuery` = transaksi READ-ONLY**: querier-nya JANGAN menulis ke Dexie (mis. seed) — memicu *"Readwrite transaction in liveQuery context"* & crash route. Pola: fungsi `readX()` murni-baca (fallback default in-memory bila belum ada), seed lewat `seedXIfEmpty()` di `useEffect` saat mount. Contoh: `features/settings/settings.ts`, `features/items/catalog.ts`.
8. **Atomik**: semua operasi finansial multi-tabel pakai `db.transaction("rw", [...], async () => {...})` agar tak ada data yatim.
9. **Edit/hapus transaksi = soft-delete turunan lalu bangun ulang** (lihat `features/history/history.ts`): membatalkan efek = soft-delete `transaction_items`/`purchase_items`, baris `stock_ledger` terkait, `receivable`/`payable` + `payment`-nya, lalu `recomputeStock`. Untuk edit, bangun ulang dengan `id`/`no_nota` dipertahankan.

---

## 3. Keputusan Produk (dari user — JANGAN diubah tanpa konfirmasi)

- **Satu toko** (`store_id` tunggal, `VITE_STORE_ID`).
- **Sync custom**, otomatis & terus-menerus saat online (**TANPA timer** 15/30 dtk) — dibangun di Fase 5.
- **Margin 2-arah** (`lib/pricing.ts`, ada unit test): ubah margin% → harga jual ikut, & sebaliknya. `basis_harga` menentukan mana yang dipertahankan saat harga beli berubah.
- **Konversi satuan** (`item_units`): stok disimpan dalam **satuan dasar**; satuan lain (TRUK/DUS/ZAK) = jalan pintas input + opsi jual. "Hitung Harga Pokok Dasar" = harga satuan besar ÷ konversi.
- **Item** punya field **merk**. **Pencarian substring** (bukan prefix), 1 huruf langsung muncul, cocokkan nama+merk+barcode. (Barcode = pencocokan **eksak**.)
- **DUA toggle terpisah** (Pengaturan, Fase 8): (a) stok boleh minus STRICT/LONGGAR, (b) ubah harga di kasir STRICT/LONGGAR.
- **Favorit item global toko**. **Kategori & satuan** dikelola di menu **Produk** (bukan Pengaturan).
- Tabel Produk: satu **baris per satuan** (dasar + tiap konversi), harga/stok per satuan; sort klik header; filter kategori/merk/stok-menipis.
- **Kasir (Jual Tunai)**: diskon **per-baris item** (nominal/persen), BUKAN diskon transaksi. Harga grosir otomatis per qty; override manual mematikan auto-grosir.
- **Edit harga di kasir**: pemilik bebas (peringatan merah bila < modal, tetap boleh). Kasir saat `harga_mode='strict'` butuh **PIN pemilik** (`Settings.owner_pin`); `'longgar'` bebas. Scan satuan-konversi → langsung pakai satuan itu; tap item multi-satuan → pilih satuan dulu.
- **Biaya tambahan** (ongkir/buruh/potong kayu): free-text label + nominal bebas, beberapa baris, di keranjang. Bukan item (tak potong stok), dilaporkan terpisah sebagai biaya (`Transaction.biaya[]`).
- **Cetak nota** opsional di layar sukses bayar: bisa lanjut tanpa cetak, atau cetak lalu transaksi baru. Cetak langsung tanpa edit (template editable = Fase 7).
- **Piutang** muncul dari penjualan **tunai (kurang bayar)** ATAU **piutang** bila `dibayar < total`. Tunai: customer opsional (tanpa customer = piutang "Umum"); piutang: customer wajib.
- **Hutang = pembelian barang** dari supplier (menambah stok). Hutang manual juga didukung (`purchase_id = null`).
- **Nomor nota**: `<prefix>/<thn>/<bln>/<perangkat>-<5digit>` (`cash`/`piu`/`beli`), counter **lokal per perangkat** (`lib/device.ts`), reset per bulan, disimpan di tabel `counters` (lokal-saja, tak ikut sync).
- **Tanggal pembayaran bisa dipilih** (default hari ini, `max` = hari ini) untuk mencatat pembayaran lampau yang lupa diinput.
- **Pelunasan per pihak** (Hutang-Piutang): pilih customer/supplier → daftar tagihan belum lunas (multi-pilih) → input jumlah → **alokasi FIFO tertua-dulu** (`allocate.ts`).

---

## 4. Peta Fitur (1–11, mapping ke kode)

| # | Fitur | Status | Lokasi kode |
|---|---|---|---|
| 1 | **Penjualan Tunai** (keranjang, barcode, manual, diskon baris, biaya tambahan, cek stok, cetak nota) | ✅ Fase 3 | `features/sales/` |
| 2 | **Penjualan Piutang** (customer wajib, DP, jatuh tempo, cicilan) | ✅ Fase 4 | `features/sales/checkout.ts`, `features/credit/` |
| 3 | **Manajemen Item** (margin 2-arah, konversi satuan, merk, grosir, stok min, baris per satuan, cari substring) | ✅ Fase 2 | `features/items/` |
| 4 | **Supplier** | ✅ Fase 2 | `features/suppliers/` |
| 5 | **Customer** (limit kredit, harga khusus) | ✅ Fase 2 | `features/customers/` |
| 6 | **Hutang & Piutang** (daftar, status, jatuh tempo/terlambat, cicilan, pelunasan FIFO per pihak, edit/hapus pembayaran) | ✅ Fase 4/4c | `features/credit/`, `features/purchasing/` |
| 7 | **Cek Harga** (lookup cepat + riwayat beli) | ⬜ Fase 6 | placeholder `/cek-harga` |
| 8 | **Scan Barcode** (HID + kamera @zxing) | ✅ Fase 3 | `features/sales/BarcodeScanner.tsx` |
| 9 | **Laporan** (penjualan, laba/rugi, piutang/hutang, arus kas, ekspor CSV/PDF) | ⬜ Fase 6 | placeholder `/laporan` |
| 10 | **Struk/Nota** (thermal 58/80mm + digital; template editable) | 🟡 fondasi ada (Fase 3) → editable Fase 7 | `features/sales/receipt.ts`, `printReceipt.ts` |
| 11 | **Pengaturan** (profil toko, toggle stok/harga, owner_pin, backup/restore) | 🟡 sebagian (seed + toggle) → lengkap Fase 8 | `features/settings/settings.ts`, placeholder `/pengaturan` |

Tambahan di luar daftar asli: **Riwayat Transaksi** (`features/history/`, Fase 4b) — daftar semua penjualan+pembelian dengan edit/hapus; **Pembelian** terpisah (`features/purchasing/`, Fase 4c, `/pembelian`).

---

## 5. Struktur Folder

```
src/
  app/        router.tsx, Layout.tsx (shell+nav), nav.ts
  db/         db.ts (skema Dexie), types.ts, helpers.ts          ← spine
  lib/        money, pricing(+test), format(+todayInput/dateInputToIso),
              uuid, device, supabase, cn                          ← spine
  features/
    auth/        AuthContext, LoginPage, RequireAuth
    items/       catalog (kategori+satuan), items, stock, ItemForm,
                 ProductsPage, CatalogManager
    customers/   customers, CustomersPage
    suppliers/   suppliers, SuppliersPage
    sales/       cart(+test), checkout, invoiceNumber(+test),
                 receipt, printReceipt(+test), SalesPage + modal2x
    credit/      receivables, payables, payments(+test),
                 allocate(+test), DebtsPage, CreditSalesPage,
                 PayBillModal, SettlementModal, PayableForm, dst
    purchasing/  purchases, PurchaseForm, PurchasePage
    history/     history, HistoryPage, SaleEditModal
    settings/    settings
  components/  ui/ (Button, Input, Card, Modal, MoneyInput),
               SyncStatusBar, PagePlaceholder
  hooks/       useOnlineStatus
supabase/migrations/  0001_init.sql, 0002_seed_owner.sql
                      (0003 — Fase 5: lihat §10.7, BELUM dibuat)
```

---

## 6. Skema Data

### 6.1 Bentuk sync bersama (`SyncBase`)

Semua tabel tersinkron meng-extend ini:

```ts
interface SyncBase {
  id: string;                 // UUID dibuat klien (crypto.randomUUID)
  store_id: string;           // VITE_STORE_ID (single store)
  created_at: string;         // ISO
  updated_at: string;         // ISO — kunci LWW
  deleted: 0 | 1;             // soft delete (tombstone)
  // lokal-saja (DIBUANG sebelum push ke Supabase):
  dirty: 0 | 1;               // 1 = ada perubahan belum ter-push
  sync_state: "pending" | "synced" | "conflict";
}
```

### 6.2 Tabel & field penting

(Detail lengkap di [`src/db/types.ts`](src/db/types.ts). Ringkas di sini.)

- **users**: nama, email, role (`pemilik`|`kasir`).
- **categories / units**: nama. (Master sederhana, soft-delete.)
- **items**: nama, merk, kategori, barcode, deskripsi, satuan_dasar, **stok** (proyeksi cache, satuan dasar), stok_min, harga_beli, harga_jual, margin_persen, basis_harga (`margin`|`harga_jual`), harga_grosir `HargaGrosir[]` (`{harga, min_qty}`), favorit.
- **item_units**: item_id, satuan, **konversi** (1 satuan = konversi satuan dasar), barcode, harga_beli, harga_jual, margin_persen.
- **suppliers**: nama, kontak, alamat, catatan.
- **customers**: nama, kontak, alamat, limit_kredit, harga_khusus.
- **transactions**: **no_nota**, tipe (`tunai`|`piutang`), tanggal, subtotal, diskon_nominal, diskon_persen, **biaya** `BiayaTambahan[]` (`{label, nominal}`), total, dibayar, kembalian, customer_id (nullable), kasir_id, **catatan**, status (`lunas`|`sebagian`|`belum`).
- **transaction_items**: transaction_id, item_id (nullable=manual), nama (snapshot), satuan, konversi, qty, harga, diskon_nominal, diskon_persen, subtotal.
- **stock_ledger** (append-only): item_id, **delta** (satuan dasar; − keluar, + masuk), reason (`initial`|`sale`|`restock`|`adjustment`), ref_id (transaksi/pembelian), supplier_id (restock), harga_beli (restock → riwayat beli Fase 6).
- **receivables**: customer_id (**nullable** = piutang umum), transaction_id, jumlah, jatuh_tempo, **sisa**, status. *(sisa & status SELALU di-recompute dari Σ payments.)*
- **payables**: supplier_id, **purchase_id** (nullable = hutang manual), jumlah, jatuh_tempo, **sisa**, status, catatan.
- **purchases**: no_nota, supplier_id, tanggal, total, dibayar, catatan, status.
- **purchase_items**: purchase_id, item_id, nama, satuan, konversi, qty, harga_beli, subtotal.
- **payments**: ref_type (`piutang`|`hutang`), ref_id, jumlah, tanggal, metode.
- **settings** (singleton, id=`settings_singleton`): nama_toko, alamat_toko, kontak_toko, logo_url, pajak_persen, diskon_default, ukuran_printer (`58mm`|`80mm`), struk_template, struk_tampil_logo, struk_tampil_alamat, struk_footer, **stok_mode** (`strict`|`longgar`), **harga_mode**, **owner_pin**.

### 6.3 Tabel lokal-saja (TIDAK ikut sync)

- **sync_cursors**: `{ table, last_pulled_at }` — high-water pull per tabel.
- **counters**: `{ key, value }` — penomoran nota per perangkat. key = `<prefix>:<YYYY-MM>:<perangkat>`.

### 6.4 Urutan sync (induk → anak, integritas FK)

`SYNC_TABLES` di `types.ts`:
```
settings, users, categories, units, items, item_units,
suppliers, customers, purchases, purchase_items,
transactions, transaction_items, receivables, payables,
payments, stock_ledger
```

### 6.5 Versi skema Dexie (jangan ubah versi lama)

| Versi | Perubahan |
|---|---|
| v1 | Semua tabel awal + index dasar |
| v2 | Index `deleted` di categories, units, item_units, payables |
| v3 | Index `deleted` di receivables, payments |
| v4 | Tabel `counters` (lokal) + index `no_nota`,`status` di transactions |
| v5 | Tabel `purchases`/`purchase_items` + index `purchase_id` di payables |
| **v6** | **(Fase 5 — BELUM)** kembalikan index `dirty` di `transactions` (lihat §10.2) |

> **Catatan**: `transactions` TAK ber-index `deleted` → filter `deleted` di memori.

---

## 7. Logika Bisnis Inti (ringkas, untuk acuan saat sync/laporan)

> Sumber lengkap ada di file masing-masing. Yang **murni & ber-test**: `lib/pricing.ts`, `lib/money.ts`, `features/sales/cart.ts`, `features/sales/invoiceNumber.ts`, `features/credit/payments.ts`, `features/credit/allocate.ts`. Jangan duplikasi — pakai ulang.

### Uang & harga (`lib/money.ts`, `lib/pricing.ts`)
- `formatRupiah/formatNumber/parseRupiah/roundRupiah` — semua integer IDR.
- `hargaJualDariMargin(beli, margin%)`, `marginDariHargaJual(beli, jual)` (1 desimal), `laba(beli, jual)`.
- `applyHargaChange(prev, change)` — update 2-arah margin↔harga jual; saat harga beli berubah, pertahankan field sesuai `basis`.
- `hargaPokokDasar(hargaSatuanBesar, konversi)` = ÷ konversi. `qtyKeSatuanDasar(qty, konversi)` = × konversi.

### Keranjang (`cart.ts`)
- `CartLine` (lihat file). `hargaGrosirBerlaku(grosir, qty)` pilih tier termurah yang `min_qty ≤ qty`. `hargaEfektif(line)`: override → `line.harga`, else auto-grosir. `lineSubtotal` = max(0, hargaEfektif×qty − diskon). `cartTotals(lines, biaya)`. Builder: `lineFromItem/lineFromItemUnit/lineFromTransactionItem/lineManual`. Mutasi immutable: `addLine` (merge same item+satuan bila keduanya non-override), `removeLine/setQty/setHarga/setDiskonNominal/setDiskonPersen`.

### Penjualan (`checkout.ts`)
- `cekStok(lines)` → `StokKurang[]`. `bolehLanjut(mode, kurang)` = longgar OR kosong.
- `checkoutTunai` / `checkoutPiutang` → atomik: Transaction + items + ledger `sale` + (bila sisa>0) Receivable + (bila terbayar>0) Payment.
  - `terbayar = clamp(dibayar, 0, total)`; `kembalian = tunai ? max(0, dibayar−total) : 0`; `sisa = max(0, total−terbayar)`.
- `editSale` — reverse efek lama lalu bangun ulang (id/no_nota tetap).

### Pembelian (`purchases.ts`)
- `checkoutPurchase` → atomik: Purchase + items + ledger `restock` (delta + satuan dasar; simpan `harga_beli ÷ konversi` per satuan dasar + supplier_id) + (bila sisa>0) Payable + Payment. `editPurchase` — reverse + rebuild.

### Kredit (`payments.ts`, `receivables.ts`, `payables.ts`, `allocate.ts`)
- Murni: `totalDibayar`, `hitungSisa`, `hitungStatus` (belum/sebagian/lunas), `terlambat(jatuhTempo, status, now)`.
- **Invariant kunci**: `sisa` & `status` Receivable/Payable **SELALU di-recompute** dari `jumlah − Σ payments` (lewat `recomputeReceivable`/`recomputePayable`) setiap kali payment ditambah/diedit/dihapus. Tidak pernah dikurangi manual → aman saat sync multi-perangkat.
- `bayar*`/`*Batch`/`editPembayaran*`/`hapusPembayaran*` punya param `tanggal?` (default `nowIso()`).
- `alokasiFifo(jumlah, tagihan[])` — alokasi tertua-dulu, tak melebihi sisa tiap tagihan.

### Penomoran nota (`invoiceNumber.ts`, `device.ts`)
- `nextNoNota(prefix, tanggal)` — atomik increment counter `<prefix>:<YYYY-MM>:<device>`. `deviceCode()` 2-char stabil di localStorage. Counter **tak ikut sync** (unik per perangkat → tak bentrok offline).

### Riwayat & pembatalan (`history.ts`)
- `reverseSaleEffects`/`reversePurchaseEffects` — soft-delete turunan + kembalikan item-id untuk recompute. `deleteSale`/`deletePurchase`/`editSale`/`editPurchase` membungkusnya atomik.

---

## 8. Otentikasi & Peran

- Login via **Supabase Auth** (email/password). Sesi disimpan (`persistSession`) → tetap bisa transaksi offline setelah login sekali online. Profil (nama+role) di-cache di localStorage (`sjb_profile_cache`) agar peran diketahui saat offline. Lihat `features/auth/AuthContext.tsx`.
- **Pemilik**: akses penuh. **Kasir**: Jual Tunai, Jual Piutang, Cek Harga, Riwayat, Customer (lihat `app/nav.ts`).
- Gating ganda: UI (`RequireAuth`) **+** RLS Supabase (`0001_init.sql` §5): master & settings tulis hanya pemilik; transaksi/piutang/payment/ledger boleh kasir; payables hanya pemilik.

---

## 9. Detail Semua Fase

> Legenda: ✅ selesai · 🟡 sebagian · ⬜ belum.

### ✅ Fase 0 — Fondasi
PWA (`vite-plugin-pwa`), app shell (`Layout` + sidebar/drawer + `SyncStatusBar`), skema Dexie (bentuk sync), `lib/` (uang integer IDR, margin 2-arah, konversi, uuid, device, format, supabase, cn).

### ✅ Fase 1 — Auth + peran
Supabase Auth, role guard (`RequireAuth`), sesi offline, login sekali online, cache profil.

### ✅ Fase 2 — Data master
Produk (margin 2-arah, konversi satuan, merk, tabel sort/filter, baris per satuan, grosir), Customer, Supplier, kategori & satuan (dikelola di menu Produk).

### ✅ Fase 3 — Barcode + Jual Tunai
Multi-satuan, favorit, diskon per-baris, **biaya tambahan** (free-text+nominal), edit harga + otorisasi PIN/peran, scan HID + kamera, cek stok per mode, **cetak nota** opsional. `cart.ts` (murni+test), `checkout.ts`, `SalesPage` 2-kolom. Settings di-seed otomatis (default toggle `longgar`, field `owner_pin`). Nota: `receipt.ts` (data) + `printReceipt.ts` (HTML + `window.print()` via iframe, `@page` 58/80mm, tanpa jspdf).

### ✅ Fase 4 — Jual Piutang + Hutang(=Pembelian) + Pembayaran
`features/credit/` + `features/purchasing/`. Logika murni+test: `payments.ts`, `invoiceNumber.ts`. **Nomor nota** per perangkat reset/bulan di tabel `counters`. **Piutang** dari penjualan tunai-kurang-bayar atau piutang. **Hutang = pembelian** dari supplier → ledger `restock` + Payable bila kurang bayar; hutang manual masih ada. `DebtsPage` 2 tab, badge status/terlambat, `PayBillModal` cicilan+riwayat. Skema Dexie v3/v4/v5.

### ✅ Fase 4b — Riwayat Transaksi + Edit/Hapus
`features/history/` (`/riwayat`, pemilik+kasir). Daftar semua penjualan + pembelian, edit & hapus = soft-delete turunan lalu rebuild (id/no_nota tetap) + recompute stok. Pembelian: pilih satuan per baris + tanggal beli. `PayBillModal` jadi riwayat pelunasan dgn edit/hapus pembayaran. Penjualan lunas tampil di Riwayat (bukan list piutang).

### ✅ Fase 4c — Menu Pembelian terpisah + Pelunasan per pihak
`/pembelian` (pemilik-only, `PurchasePage`). `SettlementModal` (Hutang-Piutang): pilih pihak → tagihan belum lunas (multi-pilih) → **alokasi FIFO** (`allocate.ts` murni+test) → batch pay (`bayarPiutangBatch`/`bayarHutangBatch`). **Tanggal pembayaran bisa dipilih** (default hari ini, max hari ini) di semua jalur bayar.

### 🟡 Fase 5 — **Sync Engine** ← BERIKUTNYA (blueprint di §10)
Otomatis & terus-menerus saat online; pull/push dua arah; konflik LWW; stok via ledger merge+recompute. **Dijeda di tahap desain** — dua keputusan menunggu jawaban user (lihat §10.1).

### ⬜ Fase 6 — Laporan + Cek Harga
Penjualan harian/periode (omzet, jml transaksi, terlaris), laba/rugi (harga beli vs jual), piutang/hutang + jatuh tempo, arus kas (masuk vs keluar termasuk pelunasan), ekspor CSV/PDF sisi klien. Cek Harga: lookup cepat (nama/barcode) → harga eceran+grosir, stok, **riwayat pembelian** (dari ledger `restock` yang menyimpan harga_beli+supplier_id).

### ⬜ Fase 7 — Struk/Nota (template editable, thermal)
Fondasi sudah ada (`receipt.ts` + `printReceipt.ts`). Fase 7 = tambah token template (`Settings.struk_template`), logo, tuning thermal **di atas struktur ini** (JANGAN buat ulang). Struk digital: share WhatsApp (`wa.me`) / ekspor PDF/gambar.

### ⬜ Fase 8 — Pengaturan + poles + seed + README + hardening
Profil toko lengkap, **dua toggle** stok/harga + owner_pin di UI, manajemen pengguna, backup/restore lokal, status sync, data seed demo, README setup Supabase+deploy gratis, hardening (limit free tier, error handling).

---

## 10. BLUEPRINT FASE 5 — Sync Engine (untuk dilanjutkan)

> Fase 5 dimulai lalu **dijeda di tahap desain**. Bagian ini adalah cetak biru lengkap agar implementasi konsisten dengan semua fase yang sudah ada. Tujuan: sinkron dua arah Dexie ↔ Supabase, **otomatis & terus-menerus saat online, tanpa timer berkala**, aman offline, konflik terselesaikan deterministik.

### 10.1 ⚠️ DUA KEPUTUSAN TERTUNDA (tanyakan user SEBELUM menulis kode sync)

User meminta kedua pertanyaan ini **ditanyakan ulang** di awal sesi Fase 5 berikutnya. Jangan asumsikan jawaban.

1. **Resolusi konflik LWW — `updated_at` ditentukan server atau klien?**
   - **Rekomendasi: stempel SERVER.** Trigger `set_updated_at()` di `0001_init.sql` sudah menulis `updated_at := now()` pada setiap UPDATE → semantik *"penulis terakhir yang sampai ke server menang"*. Kebal clock-skew antar perangkat; cursor pull (berbasis `updated_at` server) akurat & tak melewatkan baris.
   - Alternatif: stempel klien (pertahankan `updated_at` dari jam perangkat) — lebih sesuai intent tapi rawan clock-skew (perangkat berjam salah bisa selalu menang/kalah; baris bisa terlewat saat pull).
   - **Implikasi**: jika server menang, push **tidak** mengirim `updated_at` untuk diandalkan sebagai pemenang; pull mengambil `updated_at` server sebagai high-water cursor. (Lihat catatan trigger di §10.5.)

2. **Sync `stock_ledger` (append-only) — merge insert-saja + recompute, atau LWW?**
   - **Rekomendasi: merge INSERT-saja lalu `recomputeStock()`.** Ledger tak pernah di-UPDATE kecuali soft-delete (saat edit/hapus transaksi Fase 4b menandai `deleted=1`). Push semua baris dirty (termasuk yang baru di-soft-delete); pull baris ledger baru; setelah pull, recompute `items.stok` untuk item terdampak. Penjualan offline 2 perangkat dijumlahkan benar.
   - Alternatif (LWW seperti tabel lain) tidak cocok untuk append-only.

> Catatan memori: keputusan ini juga tercatat di memori proyek `fase5-sync-pending-decisions`.

### 10.2 Prasyarat / perbaikan yang HARUS dikerjakan dulu

1. **BUG index `dirty` di `transactions`**: redefinisi `db.version(4)` menulis ulang store `transactions` **tanpa** `dirty` → `SyncStatusBar.tsx:22` memanggil `.where("dirty").equals(1)` pada semua `SYNC_TABLES` termasuk transactions → akan **throw `SchemaError`** begitu ada baris. **Perbaiki dengan skema v6** yang mengembalikan index `dirty` (tetap tanpa `deleted` sesuai catatan):
   ```ts
   this.version(6).stores({
     transactions:
       "id, no_nota, tipe, tanggal, customer_id, kasir_id, status, updated_at, dirty",
   });
   ```
2. **Migration server `0003` tertinggal** ([`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) belum punya Fase 3/4): buat `0003_phase5_sync.sql` yang menambah:
   - Tabel **`purchases`** & **`purchase_items`** (kolom = `db/types.ts`).
   - Kolom baru di `transactions`: `no_nota text`, `catatan text`, `biaya jsonb default '[]'`.
   - `receivables.customer_id` jadi **NULLABLE** (piutang "Umum").
   - `payables.purchase_id uuid` (nullable).
   - Index `updated_at` + trigger `set_updated_at` + tambah ke publication `supabase_realtime` untuk tabel baru.
   - RLS untuk `purchases`/`purchase_items` (pola sama: transaksi boleh kasir? — pembelian hanya **pemilik**, samakan dengan `payables`).

### 10.3 Modul yang dibangun (struktur usulan)

```
src/lib/sync/
  index.ts        # createSyncEngine() — orchestrator + start/stop
  push.ts         # pushTable(name) / pushAll()
  pull.ts         # pullTable(name) / pullAll(); advance sync_cursors
  clean.ts        # stripLocal(row) buang dirty/sync_state; toRemote/fromRemote
  merge.ts        # mergeRow() LWW; recompute setelah pull ledger
  realtime.ts     # subscribe perubahan Supabase → trigger pull
  state.ts        # store status sync untuk SyncStatusBar (reaktif)
```
(Boleh disatukan bila lebih ringkas; yang penting pemisahan tanggung jawab jelas & ada unit test untuk bagian murni: `clean`, `merge`.)

### 10.4 PUSH (lokal → server)

Untuk tiap tabel berurutan **induk → anak** (`SYNC_TABLES`):
1. Ambil baris `dirty = 1` (untuk `transactions`: setelah v6 bisa `.where("dirty").equals(1)`).
2. `stripLocal()` → buang `dirty`, `sync_state` (kolom ini **tidak ada** di server).
3. `supabase.from(table).upsert(rows, { onConflict: "id" })`.
4. Bila sukses: set baris jadi `dirty: 0, sync_state: "synced"` di Dexie (jangan ubah `updated_at` agar tak memicu dirty lagi; gunakan `db.table.update(id, {...})` langsung, **bukan** `touch()`).
5. Bila gagal (offline/error): biarkan `dirty=1`, coba lagi nanti (tanpa kehilangan data).

Catatan: soft-delete = baris dengan `deleted=1` + `dirty=1` → ikut ter-push sebagai upsert (server menyimpan tombstone). Tidak ada hard delete.

### 10.5 PULL (server → lokal)

Untuk tiap tabel:
1. Baca cursor dari `sync_cursors` (`last_pulled_at`, "" = belum pernah).
2. `supabase.from(table).select("*").eq("store_id", STORE_ID).gt("updated_at", cursor).order("updated_at")`.
   - (Bila stempel klien dipilih, tetap pakai `updated_at` server untuk cursor agar tak ada baris terlewat; lihat keputusan §10.1.)
3. Untuk tiap baris remote → `mergeRow()` (LWW, §10.6) ke Dexie.
4. Advance cursor = `max(updated_at)` dari batch (atau waktu server terakhir). Simpan ke `sync_cursors`.
5. Setelah pull `stock_ledger`: kumpulkan `item_id` unik dari baris yang masuk → `recomputeStock(itemId)` untuk tiap item terdampak.

### 10.6 MERGE (LWW)

`mergeRow(local, remote)`:
- Tambahkan `dirty: 0, sync_state: "synced"` ke baris remote sebelum disimpan.
- Bila tak ada `local` → `put(remote)`.
- Bila ada `local`:
  - **Jika `local.dirty === 1`** (ada perubahan lokal belum ter-push) → **jangan timpa**; biarkan push mengirim versi lokal (atau, bila pakai stempel server, bandingkan `updated_at`: yang lebih besar menang). Untuk amannya: bila `remote.updated_at > local.updated_at` → remote menang (timpa) ; selain itu pertahankan lokal.
  - **Jika `local.dirty === 0`** → `remote.updated_at >= local.updated_at` ? `put(remote)` : skip.
- `stock_ledger`: tidak ada konflik nilai (append-only). Insert bila belum ada; bila ada & `remote.deleted=1` → set `deleted=1` (tombstone). Selalu recompute setelah batch.
- `settings`: singleton — LWW biasa.

### 10.7 ORCHESTRATOR & PEMICU (tanpa timer berkala)

`createSyncEngine()` mengekspos `start()`, `stop()`, `syncNow()`, dan status reaktif. Sync dijalankan saat:
1. **App start + sudah login + online** → `pullAll()` lalu `pushAll()` (pull dulu agar dapat data terbaru, lalu push lokal).
2. **Event `online`** (reconnect, dari `useOnlineStatus`/window) → `syncNow()`.
3. **Perubahan lokal (`dirty` bertambah)** → debounce singkat (mis. 300–800ms) lalu `pushAll()`. Pantau via Dexie hook (`db.on('changes')` dari `dexie-observable`/`dexie-syncable` **tidak** dipakai; cukup panggil trigger dari helper tulis atau `liveQuery` jumlah dirty). Pendekatan paling sederhana & sesuai aturan: **panggil `engine.notifyLocalChange()`** dari satu titik (mis. bungkus di `helpers.ts`/setelah `db.transaction`), atau pantau `liveQuery(() => totalDirty())` dan push saat naik.
4. **Realtime** (`realtime.ts`): `supabase.channel('store').on('postgres_changes', {schema:'public'}, () => debouncedPull())`. Saat perangkat lain menulis → tarik perubahan. Subscribe hanya saat online & login; unsubscribe saat logout/offline.
5. **Manual**: tombol di `SyncStatusBar` memanggil `syncNow()`.

Anti-reentrancy: jaga satu siklus sync berjalan pada satu waktu (mutex/flag `isSyncing`); jika dipicu saat berjalan, set flag `rerun` dan jalankan sekali lagi setelah selesai.

### 10.8 Integrasi UI

- Wire engine di `App.tsx`/`Layout` (atau context): `start()` saat `user` ada & `isSupabaseConfigured`; `stop()` saat logout. No-op penuh bila `!isSupabaseConfigured` (env kosong → tetap offline).
- `SyncStatusBar.tsx`: sambungkan tombol "Sinkron" ke `syncNow()`; tampilkan status (`menyinkron…`/`tersinkron`/`error`) dari `state.ts`; pertahankan hitungan dirty. **Pastikan v6 sudah ada** agar query dirty di transactions tak error.

### 10.9 Definisi selesai (acceptance)

- `npx tsc -b` lulus; unit test bagian murni (`clean`, `merge`) hijau; `npm test` tetap hijau.
- Dua perangkat (atau dua profil browser) dengan env Supabase sama: transaksi di A muncul di B otomatis saat online; edit offline lalu online → tergabung tanpa kehilangan data; stok hasil penjualan paralel = benar (Σ delta).
- Offline penuh tetap jalan; saat online kembali, semua `dirty` terkirim & bar status jadi "Tersinkron".
- Tak ada penulisan langsung ke Supabase dari komponen fitur (hanya engine).

---

## 11. Lingkungan & Perintah

`.env.local` (tidak di-commit; lihat `.env.example`):
- `VITE_SUPABASE_URL` — **HANYA origin** proyek (TANPA `/rest/v1`).
- `VITE_SUPABASE_ANON_KEY` — anon/publishable key (format `sb_publishable_…` didukung).
- `VITE_STORE_ID` — UUID toko (single-store).

> Tanpa `.env.local`, aplikasi tetap jalan **sepenuhnya offline**; sync nonaktif sampai env diisi. **Restart dev server wajib** tiap `.env.local` berubah (Vite hanya baca env saat start).

```bash
npm run dev      # dev server (http://localhost:5173)
npm run build    # build produksi + type check (tsc -b && vite build)
npm test         # unit test (Vitest)
npm run lint     # ESLint
npx tsc -b       # type check saja (jalankan setelah perubahan besar)
```

Verifikasi tiap fase: `npx tsc -b` + cek dev server, lalu konfirmasi alur ke user. Jalankan `npm test` jika mengubah `lib/pricing.ts` atau logika uang/stok.
