# Prompt Komprehensif: Aplikasi POS Toko (PWA, Offline-First, Zero-Cost)

> Salin seluruh isi dokumen ini sebagai prompt untuk membangun aplikasi. Dokumen ini sudah disusun lengkap berdasarkan kebutuhan: PWA, offline-first, multi-perangkat 1 toko, gratis, bahasa Indonesia.

---

## PERAN & TUJUAN

Bangun sebuah aplikasi **Point of Sale (POS)** untuk toko ritel kecil-menengah di Indonesia. Aplikasi harus **berbasis PWA (Progressive Web App)**, **offline-first**, dapat diakses **online maupun offline**, mendukung **beberapa perangkat dalam satu toko** dengan sinkronisasi data, seluruh antarmuka dalam **Bahasa Indonesia**, dan diupayakan **tanpa biaya (zero-cost)** dengan memanfaatkan layanan free tier.

---

## STACK TEKNOLOGI (WAJIB GRATIS)

- **Frontend / PWA**: React + Vite + TypeScript, dengan PWA plugin (`vite-plugin-pwa` / Workbox) untuk service worker, manifest, dan caching offline.
- **UI**: Tailwind CSS + komponen siap pakai (mis. shadcn/ui). Desain mobile-first, responsif untuk HP dan PC, mendukung layar sentuh.
- **State & Data lokal (offline-first)**: IndexedDB melalui **Dexie.js**. Semua transaksi & data master tersimpan lokal lebih dulu agar aplikasi tetap jalan penuh tanpa internet.
- **Backend / Cloud (sinkronisasi)**: **Supabase free tier** (PostgreSQL + Auth + Realtime + Row Level Security). Digunakan sebagai sumber kebenaran bersama antar perangkat.
- **Sinkronisasi**: pola offline-first — tulis ke lokal dulu, lalu sinkron dua arah ke Supabase saat online. Tangani konflik dengan strategi *last-write-wins* berbasis `updated_at` + log perubahan.
- **Hosting**: gratis di Vercel / Netlify / Cloudflare Pages.
- **Hindari semua layanan berbayar.** Jika sebuah fitur membutuhkan biaya, sediakan alternatif gratis dan beri catatan.

---

## ARSITEKTUR OFFLINE-FIRST (PENTING)

1. Semua operasi (jual, simpan item, catat piutang) ditulis ke **IndexedDB lokal** terlebih dulu → UI langsung responsif, tidak menunggu jaringan.
2. **Sync engine** berjalan di background: mendorong perubahan lokal ke Supabase dan menarik perubahan dari perangkat lain saat online.
3. Setiap record punya: `id` (UUID dibuat di klien agar tidak bentrok), `updated_at`, `deleted` (soft delete), dan `dirty/synced` flag.
4. **Indikator status** di UI: Online/Offline, jumlah data belum tersinkron, tombol "Sinkron sekarang".
5. Service worker meng-cache app shell agar aplikasi terbuka instan walau offline.
6. Konflik antar perangkat: gunakan timestamp; untuk angka kritikal (stok) gunakan delta/penambahan, bukan menimpa nilai absolut, untuk menghindari kehilangan transaksi.

---

## OTENTIKASI & PERAN PENGGUNA

- Login via Supabase Auth (email/password). Mendukung mode offline (sesi tersimpan, tetap bisa transaksi tanpa internet).
- **Dua peran**:
  - **Pemilik (Admin)**: akses penuh — semua transaksi, manajemen item/supplier/customer, hutang-piutang, semua laporan keuangan, dan pengaturan.
  - **Kasir**: hanya transaksi (instan & piutang), cek harga, lihat stok. Tidak bisa mengubah pengaturan, harga modal, atau menghapus data, dan laporan dibatasi.
- Tegakkan otorisasi peran di sisi UI **dan** di Supabase Row Level Security (RLS).

---

## FITUR YANG HARUS DIBANGUN

### 1. Transaksi Instan (Penjualan Tunai)
- Tambah item ke keranjang via: ketik nama, pilih dari daftar, atau **scan barcode**.
- Bisa input item & harga manual (barang tanpa master).
- Hitung subtotal, diskon (nominal/persen), total, uang dibayar, kembalian.
- Kurangi stok otomatis. Simpan transaksi (lokal dulu, lalu sync).

### 2. Transaksi Piutang (Jual sekarang, bayar nanti)
- Wajib pilih **Customer** terdaftar.
- Catat sebagai piutang dengan **tanggal jatuh tempo** (opsional) dan saldo terutang.
- Mendukung **pembayaran sebagian/cicilan** dan **pelunasan**, dengan riwayat pembayaran.

### 3. Manajemen Item
- Field: nama, **kode barcode**, kategori, satuan (pcs/kg/dus/dll), **harga beli (modal)**, **harga jual eceran**, **harga grosir / multi-harga** (termasuk opsi harga khusus per customer), stok, **batas stok minimum**.
- **Peringatan stok menipis/habis**.
- Tambah/edit/hapus (soft delete), pencarian cepat, import/export sederhana (CSV) bila memungkinkan.

### 4. Supplier
- Input & kelola data supplier: nama, kontak, alamat, catatan.
- Terhubung ke pencatatan **hutang** ke supplier (pembelian/restock).

### 5. Customer
- Input & kelola data customer: nama, kontak, alamat, limit kredit (opsional), harga khusus (opsional).
- Hanya customer terdaftar yang boleh transaksi piutang.
- Tampilkan total piutang berjalan per customer.

### 6. Hutang & Piutang
- **Piutang**: dari penjualan kredit ke customer. Daftar, jatuh tempo, status (lunas/belum/sebagian), pencatatan pembayaran.
- **Hutang**: ke supplier dari pembelian/restock. Daftar, jatuh tempo, pelunasan.
- Ringkasan total piutang & hutang, serta yang jatuh tempo/terlambat.

### 7. Cek Harga (Price Lookup)
- Lookup cepat berdasarkan **nama barang** atau **scan/ketik kode barcode**.
- Tampilkan harga jual (eceran & grosir), stok tersedia. Mode ringan untuk kasir/pelanggan.

### 8. Scan Barcode (Wajib mendukung KEDUANYA)
- **Scanner Bluetooth (mode HID/keyboard)**: hasil scan masuk sebagai ketikan ke input yang sedang fokus. Sediakan field input scan yang auto-fokus dan deteksi Enter/akhiran untuk memproses.
- **Kamera HP sebagai scanner**: gunakan library berbasis browser gratis (mis. `@zxing/browser` atau `html5-qrcode`) untuk scan via kamera sebagai alternatif.
- Dukung input barcode di: transaksi (instan & piutang), manajemen item, dan cek harga.

### 9. Laporan Keuangan (semua wajib ada)
- **Penjualan harian/periode**: omzet, jumlah transaksi, item terlaris (filter hari/minggu/bulan/rentang tanggal).
- **Laba/Rugi (margin)**: berdasarkan harga beli vs harga jual.
- **Piutang & Hutang**: daftar lengkap + jatuh tempo.
- **Arus kas (cash flow)**: uang masuk vs keluar, termasuk pembayaran piutang & pelunasan hutang.
- Export laporan ke CSV/PDF (gratis, sisi klien).

### 10. Struk / Nota (Wajib mendukung KEDUANYA)
- **Cetak thermal printer** Bluetooth/USB (58mm & 80mm) — gunakan Web Bluetooth / format ESC-POS bila memungkinkan; sediakan fallback.
- **Struk digital**: bagikan via **WhatsApp** (link `wa.me` / share), atau ekspor **PDF/gambar**.
- Struk memuat: identitas toko, tanggal, daftar item, total, status (lunas/piutang), info customer bila kredit.

### 11. Pengaturan
- Profil toko (nama, alamat, logo, kontak — tampil di struk).
- Manajemen pengguna & peran (Admin/Kasir).
- Konfigurasi pajak/diskon default, format struk, ukuran printer.
- Kategori & satuan barang.
- Backup/restore data lokal, kontrol & status sinkronisasi.
- Preferensi (mata uang Rupiah, format tanggal Indonesia).

---

## SKEMA DATA (acuan, sesuaikan)

- `users` (id, nama, email, role, ...)
- `items` (id, nama, barcode, kategori, satuan, harga_beli, harga_jual, harga_grosir, stok, stok_min, updated_at, deleted)
- `suppliers` (id, nama, kontak, alamat, catatan, ...)
- `customers` (id, nama, kontak, alamat, limit_kredit, ...)
- `transactions` (id, tipe[tunai|piutang], tanggal, total, diskon, dibayar, kembalian, customer_id?, kasir_id, status, ...)
- `transaction_items` (id, transaction_id, item_id?, nama, qty, harga, subtotal)
- `receivables` (piutang: id, customer_id, transaction_id, jumlah, jatuh_tempo, sisa, status)
- `payables` (hutang: id, supplier_id, jumlah, jatuh_tempo, sisa, status)
- `payments` (id, ref_type[piutang|hutang], ref_id, jumlah, tanggal, metode)
- `settings` (profil toko, konfigurasi)

Semua tabel: `id` UUID dari klien, `created_at`, `updated_at`, `deleted` (soft delete) untuk mendukung sinkronisasi.

---

## PERSYARATAN NON-FUNGSIONAL

- **Bahasa Indonesia** untuk semua label, pesan, dan format (Rupiah, tanggal).
- **Mobile-first**, ramah layar sentuh, tombol besar untuk kasir cepat.
- **Performa**: pencarian item & cek harga instan dari data lokal.
- **Andal offline**: tidak ada fitur inti yang gagal saat internet putus.
- **PWA installable** di HP & PC (Add to Home Screen), ikon & splash screen.
- **Aman**: RLS di Supabase, peran ditegakkan, data sensitif terlindungi.
- **Zero-cost**: tetap dalam batas free tier; beri peringatan bila mendekati limit.

---

## OUTPUT YANG DIHARAPKAN

1. Struktur proyek lengkap & dapat dijalankan (`npm install` → `npm run dev`).
2. Konfigurasi PWA (manifest + service worker) yang benar.
3. Setup Supabase: skema SQL tabel + kebijakan RLS + petunjuk koneksi via env.
4. Sync engine offline-first (Dexie ↔ Supabase) yang berfungsi.
5. Semua fitur 1–11 di atas terimplementasi dengan UI Bahasa Indonesia.
6. README: cara setup Supabase gratis, deploy gratis (Vercel/Netlify), dan cara pakai scanner Bluetooth & kamera.
7. Data contoh (seed) untuk demo.

Bangun secara bertahap, mulai dari fondasi (PWA + data lokal + auth), lalu fitur transaksi inti, lalu sinkronisasi, lalu laporan & pengaturan. Jelaskan keputusan arsitektur penting dan setiap batasan free tier yang relevan.
