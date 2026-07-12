import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Save, Download, Upload, Shield, Settings2, FileText, Pin } from "lucide-react";
import { db } from "@/db/db";
import { touch } from "@/db/helpers";
import { readSettings, seedSettingsIfEmpty, SETTINGS_ID } from "./settings";
import { cn } from "@/lib/cn";
import type { Settings, User } from "@/db/types";

type Tab = "profil" | "struk" | "aturan" | "pengguna" | "data";

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profil");

  useEffect(() => {
    void seedSettingsIfEmpty();
  }, []);

  const settings = useLiveQuery(() => readSettings(), []);

  if (!settings) {
    return <div className="p-4 text-ink-soft">Memuat pengaturan...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-lg font-bold">Pengaturan</h1>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-bg p-1">
        {([
          { key: "profil" as Tab, label: "Profil Toko", icon: Settings2 },
          { key: "struk" as Tab, label: "Struk", icon: FileText },
          { key: "aturan" as Tab, label: "Aturan", icon: Shield },
          { key: "pengguna" as Tab, label: "Pengguna", icon: Pin },
          { key: "data" as Tab, label: "Data", icon: Download },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.key ? "bg-surface text-accent shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profil" && <ProfilForm settings={settings} />}
      {tab === "struk" && <StrukForm settings={settings} />}
      {tab === "aturan" && <AturanForm settings={settings} />}
      {tab === "pengguna" && <UserManager />}
      {tab === "data" && <DataManager />}
    </div>
  );
}

function ProfilForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Settings, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    await db.settings.update(SETTINGS_ID, {
      nama_toko: form.nama_toko,
      alamat_toko: form.alamat_toko,
      kontak_toko: form.kontak_toko,
      logo_url: form.logo_url,
      ...touch(),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Field label="Nama Toko">
        <input value={form.nama_toko} onChange={(e) => set("nama_toko", e.target.value)} className="input-text" />
      </Field>
      <Field label="Alamat">
        <textarea value={form.alamat_toko} onChange={(e) => set("alamat_toko", e.target.value)} className="input-text" rows={3} />
      </Field>
      <Field label="Kontak (Telp/WA)">
        <input value={form.kontak_toko} onChange={(e) => set("kontak_toko", e.target.value)} className="input-text" />
      </Field>
      <Field label="URL Logo">
        <input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} className="input-text" placeholder="https://..." />
      </Field>
      <SaveButton onClick={save} saving={saving} />
    </div>
  );
}

function StrukForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Settings, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    await db.settings.update(SETTINGS_ID, {
      ukuran_printer: form.ukuran_printer,
      struk_template: form.struk_template,
      struk_tampil_logo: form.struk_tampil_logo,
      struk_tampil_alamat: form.struk_tampil_alamat,
      struk_footer: form.struk_footer,
      ...touch(),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Field label="Ukuran Printer">
        <select
          value={form.ukuran_printer}
          onChange={(e) => set("ukuran_printer", e.target.value)}
          className="input-text"
        >
          <option value="58mm">58 mm</option>
          <option value="80mm">80 mm</option>
        </select>
      </Field>
      <Field label="Template Struk">
        <textarea
          value={form.struk_template}
          onChange={(e) => set("struk_template", e.target.value)}
          className="input-text font-mono text-xs"
          rows={8}
          placeholder="Kosongkan untuk template default. Token: {nama_toko}, {alamat}, {kontak}, {no_nota}, {tanggal}, {tipe}, {items}, {biaya}, {subtotal}, {total}, {bayar}, {kembali}, {sisa}, {footer}, {catatan}"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.struk_tampil_logo === 1}
          onChange={(e) => set("struk_tampil_logo", e.target.checked ? 1 : 0)}
          className="h-4 w-4"
        />
        Tampilkan logo di struk
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.struk_tampil_alamat === 1}
          onChange={(e) => set("struk_tampil_alamat", e.target.checked ? 1 : 0)}
          className="h-4 w-4"
        />
        Tampilkan alamat di struk
      </label>
      <Field label="Footer Struk">
        <input
          value={form.struk_footer}
          onChange={(e) => set("struk_footer", e.target.value)}
          className="input-text"
          placeholder="Terima kasih"
        />
      </Field>
      <SaveButton onClick={save} saving={saving} />
    </div>
  );
}

function AturanForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Settings, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const update: Record<string, any> = {
      stok_mode: form.stok_mode,
      harga_mode: form.harga_mode,
      pajak_persen: form.pajak_persen,
      diskon_default: form.diskon_default,
      ...touch(),
    };
    if (form.owner_pin) update.owner_pin = form.owner_pin;
    await db.settings.update(SETTINGS_ID, update);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Field label="Mode Stok">
        <select value={form.stok_mode} onChange={(e) => set("stok_mode", e.target.value)} className="input-text">
          <option value="longgar">Longgar (boleh minus)</option>
          <option value="strict">Strict (tidak boleh minus)</option>
        </select>
      </Field>
      <Field label="Mode Harga di Kasir">
        <select value={form.harga_mode} onChange={(e) => set("harga_mode", e.target.value)} className="input-text">
          <option value="longgar">Longgar (boleh ubah)</option>
          <option value="strict">Strict (perlu PIN)</option>
        </select>
      </Field>
      <Field label="PIN Pemilik (kosongkan = nonaktif)">
        <input
          type="password"
          value={form.owner_pin}
          onChange={(e) => set("owner_pin", e.target.value)}
          className="input-text"
          placeholder="PIN untuk otorisasi kasir"
          maxLength={6}
        />
      </Field>
      <Field label="Pajak (%)">
        <input
          type="number"
          min={0}
          max={100}
          value={form.pajak_persen}
          onChange={(e) => set("pajak_persen", Number(e.target.value))}
          className="input-text"
        />
      </Field>
      <Field label="Diskon Default (%)">
        <input
          type="number"
          min={0}
          max={100}
          value={form.diskon_default}
          onChange={(e) => set("diskon_default", Number(e.target.value))}
          className="input-text"
        />
      </Field>
      <SaveButton onClick={save} saving={saving} />
    </div>
  );
}

function UserManager() {
  const users = useLiveQuery(() => db.users.where("deleted").equals(0).toArray(), []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Kelola pengguna dengan akses ke aplikasi ini.</p>
      {!users || users.length === 0 ? (
        <p className="text-ink-soft">Belum ada pengguna.</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user }: { user: User }) {
  const [role, setRole] = useState(user.role);
  const saving = async () => {
    await db.users.update(user.id, { role, ...touch() });
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
      <div>
        <div className="font-medium">{user.nama}</div>
        <div className="text-xs text-ink-soft">{user.email}</div>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value as "pemilik" | "kasir"); void saving(); }}
          className="rounded border border-line bg-bg px-2 py-1 text-sm"
        >
          <option value="kasir">Kasir</option>
          <option value="pemilik">Pemilik</option>
        </select>
      </div>
    </div>
  );
}

function DataManager() {
  const [msg, setMsg] = useState<string | null>(null);

  const backup = async () => {
    const tables = [
      "categories", "units", "items", "item_units", "suppliers", "customers",
      "transactions", "transaction_items", "stock_ledger", "receivables",
      "payables", "payments", "purchases", "purchase_items", "settings",
    ] as const;
    const data: Record<string, any> = {};
    for (const t of tables) {
      data[t] = await (db as any)[t].toArray();
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sjb_pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup berhasil diunduh.");
    setTimeout(() => setMsg(null), 3000);
  };

  const restore = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!confirm("Yakin restore? Semua data saat ini akan ditimpa.")) return;
        for (const [table, rows] of Object.entries(data)) {
          if (Array.isArray(rows) && (db as any)[table]) {
            await (db as any)[table].clear();
            await (db as any)[table].bulkAdd(rows);
          }
        }
        setMsg("Restore berhasil. Muat ulang halaman.");
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) {
        setMsg("Gagal restore: " + (e as Error).message);
        setTimeout(() => setMsg(null), 5000);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Backup dan restore seluruh data aplikasi.</p>
      <div className="flex gap-3">
        <button onClick={() => void backup()} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-bg">
          <Download size={16} /> Backup (.json)
        </button>
        <button onClick={() => void restore()} className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10">
          <Upload size={16} /> Restore
        </button>
      </div>
      {msg && (
        <div className="rounded-lg bg-good/10 px-4 py-2 text-sm text-good">{msg}</div>
      )}
      <p className="text-xs text-ink-soft">Catatan: restore hanya untuk keadaan darurat. Backup menggunakan format JSON yang bisa dibaca.</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
    >
      <Save size={16} /> {saving ? "Menyimpan..." : "Simpan"}
    </button>
  );
}
