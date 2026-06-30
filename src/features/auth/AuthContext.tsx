import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Role } from "@/db/types";

export interface CurrentUser {
  id: string;
  nama: string;
  email: string;
  role: Role;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  /** true jika Supabase belum dikonfigurasi (mode dev/offline penuh). */
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const PROFILE_CACHE_KEY = "sjb_profile_cache";

/** Simpan profil ke localStorage agar peran tetap diketahui saat offline. */
function cacheProfile(u: CurrentUser | null) {
  if (u) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(u));
  else localStorage.removeItem(PROFILE_CACHE_KEY);
}
function readCachedProfile(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Ambil profil (nama + peran) dari tabel profiles untuk user yang login. */
  const loadProfile = useCallback(
    async (userId: string, email: string): Promise<CurrentUser | null> => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("nama, role")
        .eq("id", userId)
        .single();

      if (error || !data) {
        // Online tapi profil belum ada → pakai cache bila ada.
        return readCachedProfile();
      }
      const profile: CurrentUser = {
        id: userId,
        email,
        nama: data.nama || email,
        role: (data.role as Role) ?? "kasir",
      };
      cacheProfile(profile);
      return profile;
    },
    [],
  );

  // Inisialisasi: pulihkan sesi + dengarkan perubahan auth.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      const { data } = await supabase!.auth.getSession();
      const session = data.session;
      if (!active) return;

      if (session?.user) {
        // Tampilkan dulu dari cache (instan, jalan offline), lalu segarkan online.
        const cached = readCachedProfile();
        if (cached) setUser(cached);
        const fresh = await loadProfile(session.user.id, session.user.email ?? "");
        if (active && fresh) setUser(fresh);
      }
      if (active) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        cacheProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: "Supabase belum dikonfigurasi." };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: terjemahkanError(error.message) };
      if (data.user) {
        const profile = await loadProfile(data.user.id, data.user.email ?? "");
        setUser(profile);
      }
      return { error: null };
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    cacheProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, configured: isSupabaseConfigured, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

/** Pesan error login dalam Bahasa Indonesia. */
function terjemahkanError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Email atau kata sandi salah.";
  if (/email not confirmed/i.test(msg)) return "Email belum dikonfirmasi.";
  if (/network|fetch/i.test(msg)) return "Tidak ada koneksi. Periksa internet Anda.";
  return msg;
}
