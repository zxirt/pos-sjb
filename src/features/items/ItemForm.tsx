import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, Star, Calculator } from "lucide-react";
import { db } from "@/db/db";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field, Label } from "@/components/ui/Input";
import { MoneyInput, NumberInput } from "@/components/ui/MoneyInput";
import { CardSection } from "@/components/ui/Card";
import { formatRupiah } from "@/lib/money";
import {
  applyHargaChange,
  hargaPokokDasar,
  type HargaState,
  type BasisHarga,
} from "@/lib/pricing";
import { cn } from "@/lib/cn";
import type { Item, ItemUnit } from "@/db/types";
import {
  createItem,
  updateItem,
  type ItemFormData,
  type ItemUnitFormData,
} from "./items";

interface Props {
  item?: Item; // ada bila edit
  units?: ItemUnit[]; // baris konversi yang sudah ada
  onDone: () => void;
}

type Gaya = "pasti" | "bulk";

const emptyUnit = (): ItemUnitFormData => ({
  satuan: "DUS",
  konversi: 1,
  barcode: "",
  harga_beli: 0,
  harga_jual: 0,
  margin_persen: 0,
});

export function ItemForm({ item, units: existingUnits, onDone }: Props) {
  const categories = useLiveQuery(
    () => db.categories.where("deleted").equals(0).toArray(),
    [],
  );
  const satuanList = useLiveQuery(
    () => db.units.where("deleted").equals(0).toArray(),
    [],
  );

  const [nama, setNama] = useState(item?.nama ?? "");
  const [merk, setMerk] = useState(item?.merk ?? "");
  const [kategori, setKategori] = useState(item?.kategori ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");
  const [deskripsi, setDeskripsi] = useState(item?.deskripsi ?? "");
  const [satuanDasar, setSatuanDasar] = useState(item?.satuan_dasar ?? "PCS");
  const [stok, setStok] = useState(item?.stok ?? 0);
  const [stokMin, setStokMin] = useState(item?.stok_min ?? 0);
  const [favorit, setFavorit] = useState<0 | 1>(item?.favorit ?? 0);

  const [harga, setHarga] = useState<HargaState>({
    hargaBeli: item?.harga_beli ?? 0,
    hargaJual: item?.harga_jual ?? 0,
    marginPersen: item?.margin_persen ?? 0,
    basis: item?.basis_harga ?? "margin",
  });

  const [gaya, setGaya] = useState<Gaya>(
    existingUnits && existingUnits.length > 0 ? "bulk" : "pasti",
  );
  const [unitRows, setUnitRows] = useState<ItemUnitFormData[]>(
    existingUnits?.map((u) => ({
      id: u.id,
      satuan: u.satuan,
      konversi: u.konversi,
      barcode: u.barcode,
      harga_beli: u.harga_beli,
      harga_jual: u.harga_jual,
      margin_persen: u.margin_persen,
    })) ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const laba = harga.hargaJual - harga.hargaBeli;

  function patchHarga(change: Partial<HargaState>) {
    setHarga((prev) => applyHargaChange(prev, change));
  }

  /** Update satu baris konversi + hitung margin/harga jual 2-arah per baris. */
  function patchUnit(i: number, change: Partial<ItemUnitFormData>) {
    setUnitRows((rows) =>
      rows.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...change };
        if (change.harga_beli !== undefined || change.margin_persen !== undefined) {
          const s = applyHargaChange(
            {
              hargaBeli: next.harga_beli,
              hargaJual: next.harga_jual,
              marginPersen: next.margin_persen,
              basis: "margin",
            },
            change.harga_beli !== undefined
              ? { hargaBeli: next.harga_beli }
              : { marginPersen: next.margin_persen },
          );
          next.harga_jual = s.hargaJual;
          next.margin_persen = s.marginPersen;
        } else if (change.harga_jual !== undefined) {
          const s = applyHargaChange(
            {
              hargaBeli: next.harga_beli,
              hargaJual: next.harga_jual,
              marginPersen: next.margin_persen,
              basis: "harga_jual",
            },
            { hargaJual: next.harga_jual },
          );
          next.margin_persen = s.marginPersen;
        }
        return next;
      }),
    );
  }

  /** Tombol "Hitung Harga Pokok Dasar": pakai baris konversi terbesar. */
  function hitungPokokDasar() {
    if (unitRows.length === 0) return;
    const big = unitRows.reduce((a, b) => (b.konversi > a.konversi ? b : a), unitRows[0]);
    if (big.konversi <= 0) {
      setErr("Konversi harus lebih dari 0.");
      return;
    }
    const per = hargaPokokDasar(big.harga_beli, big.konversi);
    patchHarga({ hargaBeli: per });
    setErr(null);
  }

  async function handleSave() {
    if (!nama.trim()) return setErr("Nama barang wajib diisi.");
    if (!satuanDasar) return setErr("Satuan dasar wajib dipilih.");
    setErr(null);
    setSaving(true);

    const data: ItemFormData = {
      nama,
      merk,
      kategori,
      barcode,
      deskripsi,
      satuan_dasar: satuanDasar,
      stok,
      stok_min: stokMin,
      harga_beli: harga.hargaBeli,
      harga_jual: harga.hargaJual,
      margin_persen: harga.marginPersen,
      basis_harga: harga.basis,
      harga_grosir: item?.harga_grosir ?? [],
      favorit,
      units: gaya === "bulk" ? unitRows : [],
    };

    try {
      if (item) await updateItem(item.id, data);
      else await createItem(data);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* IDENTITAS */}
      <CardSection title="Identitas Barang">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="nama">Nama Barang</Label>
            <Input
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="cth. Semen Merdeka 40kg"
            />
          </Field>
          <Field>
            <Label htmlFor="merk">Merk</Label>
            <Input
              id="merk"
              value={merk}
              onChange={(e) => setMerk(e.target.value)}
              placeholder="cth. Merdeka"
            />
          </Field>
          <Field>
            <Label htmlFor="kategori">Kategori</Label>
            <Select
              id="kategori"
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
            >
              <option value="">— pilih —</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.nama}>
                  {c.nama}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              className="num"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="scan / ketik"
            />
          </Field>
          <Field>
            <Label htmlFor="deskripsi">Deskripsi (opsional)</Label>
            <Input
              id="deskripsi"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="catatan singkat"
            />
          </Field>
        </div>
      </CardSection>

      {/* GAYA HARGA */}
      <CardSection title="Gaya Harga Barang">
        <div className="flex flex-wrap gap-3">
          <GayaChip active={gaya === "pasti"} onClick={() => setGaya("pasti")}>
            Harga Pasti (beli 1, jual 1)
          </GayaChip>
          <GayaChip active={gaya === "bulk"} onClick={() => setGaya("bulk")}>
            Bulk + Konversi Satuan
          </GayaChip>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {gaya === "bulk"
            ? "Bulk: barang dibeli dalam satuan besar (mis. 1 truk semen) lalu dijual per satuan dasar (zak)."
            : "Harga pasti: beli & jual per 1 satuan. Tanpa konversi (mis. kuas, cat kaleng)."}
        </p>
      </CardSection>

      {/* SATUAN & STOK */}
      <CardSection title="Satuan Dasar & Stok">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <Label htmlFor="satuan">Satuan Dasar</Label>
            <Select
              id="satuan"
              value={satuanDasar}
              onChange={(e) => setSatuanDasar(e.target.value)}
            >
              {satuanList?.map((u) => (
                <option key={u.id} value={u.nama}>
                  {u.nama}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="stok">Stok Saat Ini</Label>
            <NumberInput id="stok" value={stok} onChange={setStok} suffix={satuanDasar} />
          </Field>
          <Field>
            <Label htmlFor="stokmin">Stok Minimum</Label>
            <NumberInput
              id="stokmin"
              value={stokMin}
              onChange={setStokMin}
              suffix={satuanDasar}
            />
          </Field>
        </div>
      </CardSection>

      {/* HARGA & MARGIN */}
      <CardSection title={`Harga & Margin (per ${satuanDasar})`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="beli">Harga Beli (Modal)</Label>
            <MoneyInput
              id="beli"
              value={harga.hargaBeli}
              onChange={(v) => patchHarga({ hargaBeli: v })}
            />
          </Field>
          <Field>
            <Label>Atur keuntungan dengan</Label>
            <div className="inline-flex overflow-hidden rounded border border-line-strong">
              <BasisBtn
                active={harga.basis === "margin"}
                onClick={() => patchHarga({ basis: "margin" })}
              >
                Margin %
              </BasisBtn>
              <BasisBtn
                active={harga.basis === "harga_jual"}
                onClick={() => patchHarga({ basis: "harga_jual" })}
              >
                Harga Jual
              </BasisBtn>
            </div>
            <span className="text-xs text-ink-soft">
              Saat harga beli berubah,{" "}
              <b>{harga.basis === "margin" ? "Margin %" : "Harga Jual"}</b> dipertahankan.
            </span>
          </Field>
          <Field>
            <Label htmlFor="margin">Margin %</Label>
            <NumberInput
              id="margin"
              value={harga.marginPersen}
              onChange={(v) => patchHarga({ marginPersen: v })}
              suffix="%"
              step={0.1}
            />
          </Field>
          <Field>
            <Label htmlFor="jual">Harga Jual Eceran</Label>
            <MoneyInput
              id="jual"
              value={harga.hargaJual}
              onChange={(v) => patchHarga({ hargaJual: v })}
            />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between rounded border border-line bg-bg px-4 py-3">
          <span className="text-sm text-ink-soft">Laba per {satuanDasar}</span>
          <span className={cn("num text-base font-bold", laba >= 0 ? "text-good" : "text-danger")}>
            {formatRupiah(laba)}
          </span>
        </div>
      </CardSection>

      {/* KONVERSI SATUAN */}
      {gaya === "bulk" && (
        <CardSection title="Konversi Satuan (barang bulk)">
          <p className="mb-3 text-xs text-ink-soft">
            <b>Konversi</b> = jumlah {satuanDasar} dalam 1 satuan ini (1 TRUK = 200 {satuanDasar}).
          </p>
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-bg text-left text-[11px] uppercase tracking-wide text-ink-soft">
                  <th className="p-2 font-semibold">Satuan</th>
                  <th className="p-2 font-semibold">Konversi</th>
                  <th className="p-2 font-semibold">Barcode</th>
                  <th className="p-2 font-semibold">Harga Beli</th>
                  <th className="p-2 font-semibold">Harga Jual</th>
                  <th className="p-2 font-semibold">Margin %</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {unitRows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="p-1.5">
                      <Select
                        value={r.satuan}
                        onChange={(e) => patchUnit(i, { satuan: e.target.value })}
                        className="min-h-[38px] py-1.5"
                      >
                        {satuanList?.map((u) => (
                          <option key={u.id} value={u.nama}>
                            {u.nama}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="p-1.5">
                      <NumberInput
                        value={r.konversi}
                        onChange={(v) => patchUnit(i, { konversi: v })}
                        suffix={satuanDasar}
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        className="num py-1.5"
                        value={r.barcode}
                        onChange={(e) => patchUnit(i, { barcode: e.target.value })}
                        placeholder="opsional"
                      />
                    </td>
                    <td className="p-1.5">
                      <MoneyInput
                        value={r.harga_beli}
                        onChange={(v) => patchUnit(i, { harga_beli: v })}
                        prefix=""
                      />
                    </td>
                    <td className="p-1.5">
                      <MoneyInput
                        value={r.harga_jual}
                        onChange={(v) => patchUnit(i, { harga_jual: v })}
                        prefix=""
                      />
                    </td>
                    <td className="p-1.5">
                      <NumberInput
                        value={r.margin_persen}
                        onChange={(v) => patchUnit(i, { margin_persen: v })}
                        suffix="%"
                        step={0.1}
                      />
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        onClick={() => setUnitRows((rows) => rows.filter((_, idx) => idx !== i))}
                        className="text-danger hover:opacity-70"
                        aria-label="Hapus baris"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {unitRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-ink-soft">
                      Belum ada satuan konversi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUnitRows((r) => [...r, emptyUnit()])}
            >
              <Plus size={16} /> Tambah Satuan
            </Button>
            <Button variant="secondary" size="sm" onClick={hitungPokokDasar}>
              <Calculator size={16} /> Hitung Harga Pokok Dasar
            </Button>
          </div>
        </CardSection>
      )}

      {/* FAVORIT */}
      <CardSection title="Lainnya">
        <button
          onClick={() => setFavorit((f) => (f ? 0 : 1))}
          className="flex items-center gap-3 text-left"
        >
          <Star
            size={24}
            className={favorit ? "fill-yellow-400 text-yellow-400" : "text-line-strong"}
          />
          <span>
            Tampilkan sebagai <b>Favorit</b> di halaman kasir (semua kasir)
          </span>
        </button>
      </CardSection>

      {/* AKSI */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4">
        {err && <span className="text-sm text-danger">{err}</span>}
        <div className="ml-auto flex gap-3">
          <Button variant="secondary" onClick={onDone} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan Barang"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GayaChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-semibold transition-colors touch-target",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line-strong text-ink-soft hover:bg-bg",
      )}
    >
      {children}
    </button>
  );
}

function BasisBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-semibold touch-target",
        active ? "bg-accent text-white" : "bg-surface text-ink-soft hover:bg-bg",
      )}
    >
      {children}
    </button>
  );
}

export type { BasisHarga };
