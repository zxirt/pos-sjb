import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const STORE_ID =
  (import.meta.env.VITE_STORE_ID as string | undefined) ??
  "00000000-0000-0000-0000-000000000001";

/**
 * Klien Supabase. Bisa null bila env belum diisi — aplikasi tetap jalan
 * sepenuhnya offline (Dexie), sync dinonaktifkan sampai env tersedia.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true, // sesi disimpan → offline setelah login sekali
          autoRefreshToken: true,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
