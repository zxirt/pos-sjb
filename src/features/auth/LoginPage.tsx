import { useState } from "react";
import { Store, Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";
import { Button } from "@/components/ui/Button";
import { Input, Field, Label } from "@/components/ui/Input";
import { Card, CardSection } from "@/components/ui/Card";

export function LoginPage() {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
            <Store size={28} />
          </div>
          <h1 className="text-2xl font-bold">SJB POS</h1>
          <p className="text-sm text-ink-soft">Masuk untuk mulai transaksi</p>
        </div>

        <Card>
          <CardSection>
            {!configured && (
              <div className="mb-4 rounded bg-warn-soft px-3 py-2 text-sm text-warn">
                Supabase belum dikonfigurasi. Isi <code>.env.local</code> lalu jalankan ulang.
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@toko.id"
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="password">Kata Sandi</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>

              {error && (
                <p className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
              )}

              <Button type="submit" size="lg" disabled={busy || !configured}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : null}
                {busy ? "Memproses…" : "Masuk"}
              </Button>
            </form>
          </CardSection>
        </Card>

        <p className="mt-4 text-center text-xs text-ink-soft">
          Setelah masuk sekali saat online, aplikasi tetap bisa dipakai offline.
        </p>
      </div>
    </div>
  );
}
