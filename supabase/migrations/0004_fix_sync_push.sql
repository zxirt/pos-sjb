-- ============================================================================
-- SJB POS — Fase 5: Fix sync_push RPC
--
-- Masalah: RPC sync_push hanya mengisi kolom id/store_id/updated_at/deleted,
-- mengabaikan semua data kolom bisnis (nama, harga, total, dll.).
-- Akibatnya data di server kosong → pull kembali data kosong.
--
-- Perbaikan: gunakan jsonb_populate_record untuk insert/update seluruh kolom
-- dari JSONB client. Hapus baris lama dulu (clean slate) lalu insert fresh.
-- ============================================================================

create or replace function sync_push(p_store_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer
as $$
declare
  v_row jsonb;
  v_table text;
  v_upserted int := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  for v_row in select jsonb_array_elements(p_rows)
  loop
    begin
      v_table := v_row->>'table';

      -- Hapus baris lama (clean slate), lalu insert ulang dari JSONB
      -- jsonb_populate_record otomatis mapping key JSON → kolom tabel
      execute format('delete from %I where id = $1', v_table)
        using (v_row->>'id')::uuid;
      -- id, store_id, deleted sudah ada di v_row->'data'; override updated_at via server
      execute format(
        'insert into %I select * from jsonb_populate_record(null::%I, $1)',
        v_table, v_table
      ) using v_row->'data' || jsonb_build_object(
        'store_id', p_store_id,
        'updated_at', now()::text
      );

      v_upserted := v_upserted + 1;
    exception when others then
      v_errors := v_errors || jsonb_build_object('id', v_row->>'id', 'error', SQLERRM);
    end;
  end loop;

  return jsonb_build_object(
    'success', jsonb_array_length(v_errors) = 0,
    'upserted', v_upserted,
    'deleted', 0,
    'errors', v_errors
  );
end;
$$;
