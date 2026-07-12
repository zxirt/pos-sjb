import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, X, Store, LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { SyncStatusBar } from "@/components/SyncStatusBar";
import { useAuth } from "@/features/auth/AuthContext";
import { initSyncEngine, cleanupSyncEngine } from "@/lib/sync";
import { supabase, isSupabaseConfigured, STORE_ID } from "@/lib/supabase";
import { cn } from "@/lib/cn";

/**
 * Shell aplikasi: sidebar (desktop) / drawer (mobile) + bar status sync.
 * Engine sync dimulai saat user login & Supabase terkonfigurasi.
 */
export function Layout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const role = user?.role ?? "kasir";
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  useEffect(() => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    void initSyncEngine({
      storeId: STORE_ID,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    });
    return () => {
      void cleanupSyncEngine();
    };
  }, [user]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      {/* Sidebar / Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-60 border-r border-line bg-surface transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <Store className="text-accent" size={22} />
          <span className="font-bold">SJB POS</span>
          <button
            className="ml-auto md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded px-3 py-2.5 text-[15px] font-medium touch-target",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-ink-soft hover:bg-bg hover:text-ink",
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-3 border-t border-line px-3 py-3">
          <div className="mb-2 px-1 text-xs text-ink-soft">
            <div className="font-medium text-ink">{user?.nama}</div>
            {role === "pemilik" ? "Pemilik" : "Kasir"}
          </div>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm font-medium text-ink-soft hover:bg-bg hover:text-danger touch-target"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>

      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-ink/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Konten */}
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu size={22} />
          </button>
          <span className="font-bold">SJB POS</span>
        </header>
        <SyncStatusBar />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
