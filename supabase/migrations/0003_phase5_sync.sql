-- ============================================================================
-- SJB POS — Fase 5: Sync Engine preparation
-- Menambah kolom Fase 3/4 yang tertinggal di server + tabel purchases
-- ============================================================================

-- 1) Tambah kolom ke transactions (Fase 3: no_nota, catatan, biaya)
alter table if exists transactions
  add column if not exists no_nota text default '',
  add column if not exists catatan text default '',
  add column if not exists biaya jsonb default '[]'::jsonb;

-- 2) Buat tabel purchases (Fase 4/4c)
create table if not exists purchases (
  id uuid primary key, store_id uuid not null,
  no_nota text not null default '', supplier_id uuid not null,
  tanggal timestamptz not null default now(),
  total bigint not null default 0, dibayar bigint not null default 0,
  catatan text not null default '',
  status text not null default 'sebagian',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

-- 3) Buat tabel purchase_items (Fase 4/4c)
create table if not exists purchase_items (
  id uuid primary key, store_id uuid not null,
  purchase_id uuid not null, item_id uuid not null,
  nama text not null default '', satuan text not null default '',
  konversi numeric not null default 1, qty numeric not null default 0,
  harga_beli bigint not null default 0, subtotal bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted smallint not null default 0
);

-- 4) Ubah receivables.customer_id menjadi NULLABLE (piutang "Umum")
alter table if exists receivables
  alter column customer_id drop not null;

-- 5) Tambah kolom purchase_id ke payables (Fase 4/4c)
alter table if exists payables
  add column if not exists purchase_id uuid;

-- 6) Index untuk sinkronisasi (updated_at) + search
do $$
declare t text;
begin
  foreach t in array array['purchases', 'purchase_items'] loop
    execute format('create index if not exists idx_%s_updated on %I (updated_at)', t, t);
    -- trigger updated_at
    execute format('drop trigger if exists trg_%s_updated on %I', t, t);
    execute format('create trigger trg_%s_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- Additional indexes untuk search/query
create index if not exists idx_purchases_supplier_id on purchases (supplier_id);
create index if not exists idx_purchases_no_nota on purchases (no_nota);
create index if not exists idx_purchases_status on purchases (status);
create index if not exists idx_purchase_items_purchase_id on purchase_items (purchase_id);
create index if not exists idx_purchase_items_item_id on purchase_items (item_id);
create index if not exists idx_payables_purchase_id on payables (purchase_id);
create index if not exists idx_transactions_no_nota on transactions (no_nota);

-- 7) RLS untuk purchases dan purchase_items (hanya Pemilik)
alter table if exists purchases enable row level security;
alter table if exists purchase_items enable row level security;

-- purchases: SELECT semua peran; INSERT/UPDATE/DELETE hanya Pemilik
drop policy if exists p_purchases_sel on purchases;
create policy p_purchases_sel on purchases for select using (store_id = current_store_id());
drop policy if exists p_purchases_ins on purchases;
create policy p_purchases_ins on purchases for insert with check (store_id = current_store_id() and current_role_name() = 'pemilik');
drop policy if exists p_purchases_upd on purchases;
create policy p_purchases_upd on purchases for update using (store_id = current_store_id() and current_role_name() = 'pemilik');
drop policy if exists p_purchases_del on purchases;
create policy p_purchases_del on purchases for delete using (store_id = current_store_id() and current_role_name() = 'pemilik');

-- purchase_items: INSERT/UPDATE/DELETE hanya dalam konteks purchases (via purchase_id FK), Pemilik-only
drop policy if exists p_purchase_items_sel on purchase_items;
create policy p_purchase_items_sel on purchase_items for select using (store_id = current_store_id());
drop policy if exists p_purchase_items_ins on purchase_items;
create policy p_purchase_items_ins on purchase_items for insert with check (store_id = current_store_id() and current_role_name() = 'pemilik');
drop policy if exists p_purchase_items_upd on purchase_items;
create policy p_purchase_items_upd on purchase_items for update using (store_id = current_store_id() and current_role_name() = 'pemilik');
drop policy if exists p_purchase_items_del on purchase_items;
create policy p_purchase_items_del on purchase_items for delete using (store_id = current_store_id() and current_role_name() = 'pemilik');

-- 8) Realtime: publikasikan tabel baru
do $$
declare t text;
begin
  foreach t in array array['purchases', 'purchase_items'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 9) Informasi migration
comment on table purchases is 'Pembelian barang dari supplier (Fase 4/4c). Diisi via checkout atau manual form.';
comment on table purchase_items is 'Baris item dalam pembelian (Fase 4/4c).';
comment on column transactions.no_nota is 'Nomor nota transaksi unik per toko (Fase 3). Format: <prefix>/<thn>/<bln>/<perangkat>-<5digit>';
comment on column transactions.catatan is 'Catatan transaksi (Fase 3, via riwayat edit/DP).';
comment on column transactions.biaya is 'Array biaya tambahan [BiayaTambahan] — label + nominal free-text (ongkir, buruh, potong kayu).';
comment on column receivables.customer_id is 'ID customer (NULLABLE = piutang "Umum") — Fase 4.';
comment on column payables.purchase_id is 'ID purchase (NULLABLE = hutang manual). Fase 4/4c.';
