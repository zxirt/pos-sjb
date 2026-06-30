-- ============================================================================
-- SJB POS — Buat profil Pemilik pertama + baris settings awal.
--
-- JALANKAN SETELAH:
--   1) 0001_init.sql sudah dijalankan, DAN
--   2) Anda sudah membuat user di Supabase → Authentication → Users → Add user
--      (email + password). Salin USER ID (uuid) user tersebut.
--
-- Ganti nilai di blok DECLARE di bawah lalu Run.
-- ============================================================================
do $$
declare
  v_user_id uuid := 'TEMPEL-USER-ID-DARI-AUTH-DISINI';  -- <-- WAJIB diganti
  v_store_id uuid := '00000000-0000-0000-0000-000000000001'; -- samakan dgn VITE_STORE_ID
  v_nama text := 'Pemilik Toko';
  v_email text := 'pemilik@contoh.id';                   -- <-- samakan dgn email user
begin
  insert into profiles (id, store_id, nama, email, role)
  values (v_user_id, v_store_id, v_nama, v_email, 'pemilik')
  on conflict (id) do update
    set store_id = excluded.store_id, role = 'pemilik', nama = excluded.nama;

  -- Baris settings awal untuk toko (sekali saja).
  insert into settings (id, store_id, nama_toko, stok_mode, harga_mode, struk_template)
  values (gen_random_uuid(), v_store_id, 'Toko Saya', 'longgar', 'longgar', '')
  on conflict do nothing;
end $$;
