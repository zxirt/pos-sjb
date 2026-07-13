-- ============================================================================
-- SJB POS — Fase 5: Fix parameter names pada sync_push & sync_pull RPC
--
-- Masalah: client mengirim parameter dengan nama { store_id, rows/tables }
-- tapi fungsi mengharapkan { p_store_id, p_rows/p_tables }.
-- Supabase REST API cocokkan parameter by name → parameter jadi NULL.
-- ============================================================================

-- 1) sync_push: parameter store_id, rows (sesuai PushRequest client)
create or replace function sync_push(store_id uuid, rows jsonb)
returns jsonb language plpgsql security definer
as $$
declare
  v_row jsonb;
  v_table text;
  v_upserted int := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  for v_row in select jsonb_array_elements(rows)
  loop
    begin
      v_table := v_row->>'table';
      execute format('delete from %I where id = $1', v_table)
        using (v_row->>'id')::uuid;
      execute format(
        'insert into %I select * from jsonb_populate_record(null::%I, $1)',
        v_table, v_table
      ) using v_row->'data' || jsonb_build_object(
        'store_id', store_id,
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

-- 2) sync_pull: parameter store_id, tables (sesuai PullRequest client)
create or replace function sync_pull(store_id uuid, tables jsonb)
returns jsonb language plpgsql security definer
as $$
declare
  v_table jsonb;
  v_name text;
  v_cursor text;
  v_rows jsonb := '[]'::jsonb;
  v_batch jsonb;
begin
  for v_table in select jsonb_array_elements(tables)
  loop
    v_name := v_table->>'table';
    v_cursor := v_table->>'cursor';
    if v_cursor is null or v_cursor = '' then
      execute format(
        'select coalesce(jsonb_agg(jsonb_build_object(''table'', %L, ''id'', id, ''data'', to_jsonb(t.*) - ''dirty'' - ''sync_state'', ''deleted'', deleted, ''updated_at'', updated_at)), ''[]''::jsonb)
         from %I t where store_id = $1 and deleted = 0',
        v_name, v_name
      ) into v_batch using store_id;
    else
      execute format(
        'select coalesce(jsonb_agg(jsonb_build_object(''table'', %L, ''id'', id, ''data'', to_jsonb(t.*) - ''dirty'' - ''sync_state'', ''deleted'', deleted, ''updated_at'', updated_at)), ''[]''::jsonb)
         from %I t where store_id = $1 and updated_at > $2::timestamptz and deleted = 0',
        v_name, v_name
      ) into v_batch using store_id, v_cursor;
    end if;
    v_rows := v_rows || v_batch;
  end loop;
  return jsonb_build_object('rows', v_rows, 'success', true);
end;
$$;
