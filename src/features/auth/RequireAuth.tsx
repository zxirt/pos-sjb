import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import type { Role } from "@/db/types";

/** Penjaga: tampilkan login bila belum masuk; blokir bila peran tak diizinkan. */
export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="text-warn" size={40} />
        <h2 className="text-lg font-bold">Akses dibatasi</h2>
        <p className="max-w-xs text-sm text-ink-soft">
          Menu ini hanya untuk Pemilik. Hubungi pemilik toko bila Anda perlu akses.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
