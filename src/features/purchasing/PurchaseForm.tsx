import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, Search } from "lucide-react";
import { db } from "@/db/db";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input, Select } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatRupiah } from "@/lib/money";
import { todayInput } from "@/lib/format";
import { searchSuppliers } from "@/features/suppliers/suppliers";
import { searchItems } from "@/features/items/items";
import { newId } from "@/lib/uuid";
import { checkoutPurchase, editPurchase, type PurchaseLineInput } from "./purchases";
import { getPurchaseDetail } from "@/features/history/history";
import type { Item, ItemUnit } from "@/db/types";

/** Opsi satuan untuk satu baris pembelian (dasar + konversi). */
interface SatuanOpsi {
  satuan: string;
  konversi: number;
  harga_beli: number; // harga beli acuan untuk satuan ini
}

interface DraftLine extends PurchaseLineInput {
  key: string;
  opsiSatuan: SatuanOpsi[]; // satuan dasar + tiap konversi
}

/**
 * Form PEMBELIAN barang dari supplier (= sumber hutang). Pilih supplier, tanggal,
 * tambah barang (pilih SATUAN beli + qty + harga beli), tentukan uang dibayar —
 * sisanya jadi hutang. Menambah stok via ledger 'restock' (qty × konversi).
 */
export function PurchaseForm({
  open,
  onClose,
  purchaseId,
}: {
  open: boolean;
  onClose: () => void;
  purchaseId?: string | null;
}) {
  const suppliers = useLiveQuery(() => searchSuppliers(""), []);
  const [supplierId, setSupplierId] = useState("");
  const [tanggal, setTanggal] = useState(todayInput());
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [dibayar, setDibayar] = useState(0);
  const [jatuhTempo, setJatuhTempo] = useState("");
  const [catatan, setCatatan] = useState("");
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Mode edit: muat ulang isi pembelian tersimpan.
  useEffect(() => {
    if (!open || !purchaseId) return;
    let aktif = true;
    (async () => {
      const { purchase, items } = await getPurchaseDetail(purchaseId);
      if (!aktif || !purchase) return;
      setSupplierId(purchase.supplier_id);
      setTanggal(todayInput(new Date(purchase.tanggal)));
      setDibayar(purchase.dibayar);
      setCatatan(purchase.catatan ?? "");
      const draft: DraftLine[] = [];
      for (const it of items) {
        const units = await db.item_units
          .where("item_id")
          .equals(it.item_id)
          .filter((u) => u.deleted === 0)
          .toArray();
        const item = await db.items.get(it.item_id);
        const opsiSatuan: SatuanOpsi[] = [
          {
            satuan: item?.satuan_dasar ?? it.satuan,
            konversi: 1,
            harga_beli: item?.harga_beli ?? it.harga_beli,
          },
          ...units.map((u: ItemUnit) => ({
            satuan: u.satuan,
            konversi: u.konversi,
            harga_beli: u.harga_beli,
          })),
        ];
        draft.push({
          key: newId(),
          item_id: it.item_id,
          nama: it.nama,
          satuan: it.satuan,
          konversi: it.konversi,
          qty: it.qty,
          harga_beli: it.harga_beli,
          opsiSatuan,
        });
      }
      if (aktif) setLines(draft);
    })();
    return () => {
      aktif = false;
    };
  }, [open, purchaseId]);

  const total = lines.reduce((s, l) => s + Math.max(0, l.harga_beli) * l.qty, 0);
  const sisa = Math.max(0, total - dibayar);

  async function addItem(item: Item) {
    const units = await db.item_units
      .where("item_id")
      .equals(item.id)
      .filter((u) => u.deleted === 0)
      .toArray();
    const opsiSatuan: SatuanOpsi[] = [
      { satuan: item.satuan_dasar, konversi: 1, harga_beli: item.harga_beli },
      ...units.map((u: ItemUnit) => ({
        satuan: u.satuan,
        konversi: u.konversi,
        harga_beli: u.harga_beli,
      })),
    ];
    setLines((ls) => [
      ...ls,
      {
        key: newId(),
        item_id: item.id,
        nama: item.nama,
        satuan: item.satuan_dasar,
        konversi: 1,
        qty: 1,
        harga_beli: item.harga_beli,
        opsiSatuan,
      },
    ]);
    setPicking(false);
  }

  function patch(key: string, p: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }

  /** Ganti satuan baris → ikut perbarui konversi & harga beli acuan. */
  function pilihSatuan(key: string, satuan: string) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const o = l.opsiSatuan.find((x) => x.satuan === satuan);
        if (!o) return l;
        return { ...l, satuan: o.satuan, konversi: o.konversi, harga_beli: o.harga_beli };
      }),
    );
  }

  function remove(key: string) {
    setLines((ls) => ls.filter((l) => l.key !== key));
  }

  function reset() {
    setSupplierId("");
    setTanggal(todayInput());
    setLines([]);
    setDibayar(0);
    setJatuhTempo("");
    setCatatan("");
    setErr(null);
  }

  async function save() {
    setErr(null);
    if (!supplierId) return setErr("Pilih supplier.");
    if (lines.length === 0) return setErr("Tambahkan minimal satu barang.");
    const payload = {
      supplierId,
      tanggal: tanggal ? new Date(tanggal + "T00:00:00").toISOString() : null,
      lines: lines.map((l) => ({
        item_id: l.item_id,
        nama: l.nama,
        satuan: l.satuan,
        konversi: l.konversi,
        qty: l.qty,
        harga_beli: l.harga_beli,
      })),
      dibayar,
      jatuhTempo: jatuhTempo ? new Date(jatuhTempo + "T00:00:00").toISOString() : null,
      catatan,
    };
    try {
      if (purchaseId) await editPurchase({ ...payload, purchaseId });
      else await checkoutPurchase(payload);
      reset();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan pembelian.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={purchaseId ? "Edit Pembelian" : "Pembelian Barang"}
      size="lg"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="bsupplier">Supplier</Label>
            <Select
              id="bsupplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">— Pilih supplier —</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="btanggal">Tanggal Pembelian</Label>
            <Input
              id="btanggal"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </Field>
        </div>

        {/* Daftar barang */}
        <div className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold">Barang</span>
            <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
              <Plus size={15} /> Tambah barang
            </Button>
          </div>
          {lines.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-ink-soft">
              Belum ada barang.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.key} className="grid grid-cols-[1fr_auto] items-center gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.nama}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex items-center gap-1">
                        <span className="text-xs text-ink-soft">Qty</span>
                        <input
                          type="number"
                          min={0}
                          value={l.qty}
                          onChange={(e) => patch(l.key, { qty: parseFloat(e.target.value) || 0 })}
                          className="num h-9 w-16 rounded border border-line-strong text-center outline-none focus:border-accent"
                        />
                      </label>
                      {l.opsiSatuan.length > 1 ? (
                        <Select
                          value={l.satuan}
                          onChange={(e) => pilihSatuan(l.key, e.target.value)}
                          className="h-9 w-auto py-0 text-xs"
                          aria-label="Satuan"
                        >
                          {l.opsiSatuan.map((o) => (
                            <option key={o.satuan} value={o.satuan}>
                              {o.satuan}
                              {o.konversi !== 1 ? ` (×${o.konversi})` : ""}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="rounded bg-bg px-1.5 py-0.5 text-xs">{l.satuan}</span>
                      )}
                      <label className="flex items-center gap-1">
                        <span className="text-xs text-ink-soft">Harga beli</span>
                        <MoneyInput
                          value={l.harga_beli}
                          onChange={(v) => patch(l.key, { harga_beli: v })}
                          className="w-32"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num font-bold">
                      {formatRupiah(l.harga_beli * l.qty)}
                    </span>
                    <button
                      onClick={() => remove(l.key)}
                      aria-label="Hapus"
                      className="rounded p-1 text-ink-soft hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="bdibayar">Dibayar Sekarang (opsional)</Label>
            <MoneyInput id="bdibayar" value={dibayar} onChange={setDibayar} />
            <div className="mt-1 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDibayar(0)}>
                Hutang Penuh
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDibayar(total)}>
                Lunas
              </Button>
            </div>
          </Field>
          <Field>
            <Label htmlFor="bjt">Jatuh Tempo (opsional)</Label>
            <Input
              id="bjt"
              type="date"
              value={jatuhTempo}
              onChange={(e) => setJatuhTempo(e.target.value)}
            />
          </Field>
        </div>

        <Field>
          <Label htmlFor="bcatatan">Catatan (opsional)</Label>
          <Input
            id="bcatatan"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. PO #123"
          />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-bg p-3">
          <div>
            <div className="text-sm text-ink-soft">Total</div>
            <div className="num text-xl font-bold">{formatRupiah(total)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-ink-soft">Jadi Hutang</div>
            <div className="num text-xl font-bold text-warn">{formatRupiah(sisa)}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {err && <span className="mr-auto self-center text-sm text-danger">{err}</span>}
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Batal
          </Button>
          <Button onClick={save}>Simpan Pembelian</Button>
        </div>
      </div>

      <ItemPickerModal open={picking} onClose={() => setPicking(false)} onPick={addItem} />
    </Modal>
  );
}

/** Modal pencarian item ber-master untuk ditambahkan ke pembelian. */
function ItemPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: Item) => void;
}) {
  const [q, setQ] = useState("");
  const items = useLiveQuery(() => searchItems(q), [q]);

  return (
    <Modal open={open} onClose={onClose} title="Pilih Barang" size="sm">
      <div className="flex flex-col gap-3 p-5">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
            size={18}
          />
          <Input
            autoFocus
            className="pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama / merk / barcode…"
          />
        </div>
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded border border-line">
          {items?.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => onPick(it)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-bg"
              >
                <span className="min-w-0 truncate font-medium">{it.nama}</span>
                <span className="num shrink-0 text-sm text-ink-soft">
                  {formatRupiah(it.harga_beli)}
                </span>
              </button>
            </li>
          ))}
          {items?.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-ink-soft">
              Tak ada barang. Tambahkan dulu di menu Produk.
            </li>
          )}
        </ul>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
}
