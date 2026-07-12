import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { SYNC_TABLES } from "./types";

export type OnRemoteChange = () => void;

/**
 * Subscribe ke postgres_changes via Supabase Realtime.
 * Saat ada perubahan dari perangkat lain → trigger pull.
 */
export function subscribeRemoteChanges(
  supabase: SupabaseClient,
  storeId: string,
  onChange: OnRemoteChange,
): RealtimeChannel {
  const channel = supabase
    .channel(`store-${storeId}-changes`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        filter: `store_id=eq.${storeId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe perubahan untuk tabel tertentu (lebih terarah).
 */
export function subscribeTableChanges(
  supabase: SupabaseClient,
  storeId: string,
  table: (typeof SYNC_TABLES)[number],
  onChange: OnRemoteChange,
): RealtimeChannel {
  const channel = supabase
    .channel(`store-${storeId}-${table}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `store_id=eq.${storeId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return channel;
}
