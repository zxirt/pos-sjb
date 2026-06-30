-- ============================================================================
-- SJB POS — Skema awal (tabel, trigger updated_at, index, RLS)
-- Jalankan di Supabase: SQL Editor → New query → tempel seluruh file → Run.
-- ============================================================================

-- Ekstensi untuk gen_random_uuid (biasanya sudah aktif di Supabase).
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) Trigger: stempel updated_at di server (mitigasi clock-skew antar perangkat)
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- 2) Profil pengguna + peran (terhubung ke auth.users bawaan Supabase)
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null,
  nama text not null default '',
  email text not null default '',
  role text not null default 'kasir' check (role in ('pemilik','kasir')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: ambil store_id & role pengguna yang sedang login (untuk RLS).
create or replace function current_store_id()
returns uuid as $$
  select store_id from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function current_role_name()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ----------------------------------------------------------------------------
-- 3) Tabel data (semua memiliki bentuk sync: id, store_id, timestamps, deleted)
--    Catatan: kolom lokal-saja (dirty/sync_state) TIDAK ada di server.
-- ----------------------------------------------------------------------------

create table if not exists categories (
  id uuid primary key, store_id uuid not null,
  nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists units (
  id uuid primary key, store_id uuid not null,
  nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists items (
  id uuid primary key, store_id uuid not null,
  nama text not null default '',
  merk text not null default '',
  kategori text not null default '',
  barcode text not null default '',
  deskripsi text not null default '',
  satuan_dasar text not null default '',
  stok numeric not null default 0,
  stok_min numeric not null default 0,
  harga_beli bigint not null default 0,
  harga_jual bigint not null default 0,
  margin_persen numeric not null default 0,
  basis_harga text not null default 'margin',
  harga_grosir jsonb not null default '[]'::jsonb,
  favorit smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists item_units (
  id uuid primary key, store_id uuid not null,
  item_id uuid not null,
  satuan text not null default '',
  konversi numeric not null default 1,
  barcode text not null default '',
  harga_beli bigint not null default 0,
  harga_jual bigint not null default 0,
  margin_persen numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists suppliers (
  id uuid primary key, store_id uuid not null,
  nama text not null default '', kontak text not null default '',
  alamat text not null default '', catatan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists customers (
  id uuid primary key, store_id uuid not null,
  nama text not null default '', kontak text not null default '',
  alamat text not null default '', limit_kredit bigint not null default 0,
  harga_khusus smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists transactions (
  id uuid primary key, store_id uuid not null,
  tipe text not null default 'tunai',
  tanggal timestamptz not null default now(),
  subtotal bigint not null default 0,
  diskon_nominal bigint not null default 0,
  diskon_persen numeric not null default 0,
  total bigint not null default 0,
  dibayar bigint not null default 0,
  kembalian bigint not null default 0,
  customer_id uuid, kasir_id uuid,
  status text not null default 'lunas',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists transaction_items (
  id uuid primary key, store_id uuid not null,
  transaction_id uuid not null, item_id uuid,
  nama text not null default '', satuan text not null default '',
  konversi numeric not null default 1, qty numeric not null default 0,
  harga bigint not null default 0, subtotal bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

-- Append-only: delta SELALU dalam satuan dasar.
create table if not exists stock_ledger (
  id uuid primary key, store_id uuid not null,
  item_id uuid not null, delta numeric not null default 0,
  reason text not null default 'adjustment',
  ref_id uuid, supplier_id uuid, harga_beli bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists receivables (
  id uuid primary key, store_id uuid not null,
  customer_id uuid not null, transaction_id uuid not null,
  jumlah bigint not null default 0, jatuh_tempo timestamptz,
  sisa bigint not null default 0, status text not null default 'belum',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists payables (
  id uuid primary key, store_id uuid not null,
  supplier_id uuid not null, jumlah bigint not null default 0,
  jatuh_tempo timestamptz, sisa bigint not null default 0,
  status text not null default 'belum', catatan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists payments (
  id uuid primary key, store_id uuid not null,
  ref_type text not null, ref_id uuid not null,
  jumlah bigint not null default 0, tanggal timestamptz not null default now(),
  metode text not null default 'tunai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

create table if not exists settings (
  id uuid primary key, store_id uuid not null,
  nama_toko text not null default '', alamat_toko text not null default '',
  kontak_toko text not null default '', logo_url text not null default '',
  pajak_persen numeric not null default 0, diskon_default bigint not null default 0,
  ukuran_printer text not null default '58mm',
  struk_template text not null default '', struk_tampil_logo smallint not null default 1,
  struk_tampil_alamat smallint not null default 1, struk_footer text not null default '',
  stok_mode text not null default 'longgar', harga_mode text not null default 'longgar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

-- ----------------------------------------------------------------------------
-- 4) Index untuk sinkronisasi (filter updated_at) + scan barcode
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','units','items','item_units','suppliers','customers',
    'transactions','transaction_items','stock_ledger','receivables',
    'payables','payments','settings'
  ] loop
    execute format('create index if not exists idx_%s_updated on %I (updated_at)', t, t);
    -- trigger updated_at
    execute format('drop trigger if exists trg_%s_updated on %I', t, t);
    execute format('create trigger trg_%s_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

create index if not exists idx_items_barcode on items (barcode);
create index if not exists idx_item_units_barcode on item_units (barcode);
create index if not exists idx_profiles_updated on profiles (updated_at);
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 5) Row Level Security
--    Dasar: hanya baris dengan store_id = toko milik pengguna login.
--    Peran: Kasir tidak boleh UPDATE/DELETE master & settings.
-- ----------------------------------------------------------------------------

-- Aktifkan RLS di semua tabel.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','units','items','item_units','suppliers','customers',
    'transactions','transaction_items','stock_ledger','receivables',
    'payables','payments','settings'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- profiles: pengguna boleh lihat/ubah profil di toko yang sama.
drop policy if exists p_profiles_select on profiles;
create policy p_profiles_select on profiles for select
  using (store_id = current_store_id());
drop policy if exists p_profiles_upd on profiles;
create policy p_profiles_upd on profiles for update
  using (id = auth.uid() or current_role_name() = 'pemilik');

-- Tabel transaksi yang BOLEH ditulis Kasir (insert + update untuk pembayaran).
-- transactions, transaction_items, receivables, payments, stock_ledger(sale)
do $$
declare t text;
begin
  foreach t in array array['transactions','transaction_items','receivables','payments'] loop
    execute format('drop policy if exists p_%s_all on %I', t, t);
    execute format($f$create policy p_%s_all on %I
      for all using (store_id = current_store_id())
      with check (store_id = current_store_id())$f$, t, t);
  end loop;
end $$;

-- stock_ledger: semua peran boleh INSERT & SELECT (append-only), tak ada update.
drop policy if exists p_ledger_select on stock_ledger;
create policy p_ledger_select on stock_ledger for select using (store_id = current_store_id());
drop policy if exists p_ledger_insert on stock_ledger;
create policy p_ledger_insert on stock_ledger for insert with check (store_id = current_store_id());

-- Master & settings: SELECT semua peran; tulis (insert/update/delete) hanya Pemilik.
do $$
declare t text;
begin
  foreach t in array array['categories','units','items','item_units','suppliers','customers','settings'] loop
    execute format('drop policy if exists p_%s_sel on %I', t, t);
    execute format('create policy p_%s_sel on %I for select using (store_id = current_store_id())', t, t);
    execute format('drop policy if exists p_%s_ins on %I', t, t);
    execute format($f$create policy p_%s_ins on %I for insert with check (store_id = current_store_id() and current_role_name() = 'pemilik')$f$, t, t);
    execute format('drop policy if exists p_%s_upd on %I', t, t);
    execute format($f$create policy p_%s_upd on %I for update using (store_id = current_store_id() and current_role_name() = 'pemilik')$f$, t, t);
    execute format('drop policy if exists p_%s_del on %I', t, t);
    execute format($f$create policy p_%s_del on %I for delete using (store_id = current_store_id() and current_role_name() = 'pemilik')$f$, t, t);
  end loop;
end $$;

-- payables: utang ke supplier — hanya Pemilik.
drop policy if exists p_payables_all on payables;
create policy p_payables_all on payables for all
  using (store_id = current_store_id() and current_role_name() = 'pemilik')
  with check (store_id = current_store_id() and current_role_name() = 'pemilik');

-- ----------------------------------------------------------------------------
-- 6) Realtime: publikasikan perubahan agar perangkat lain dapat notifikasi pull.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','units','items','item_units','suppliers','customers',
    'transactions','transaction_items','stock_ledger','receivables',
    'payables','payments','settings'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
