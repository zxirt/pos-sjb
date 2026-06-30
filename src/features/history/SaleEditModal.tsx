import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { readSettings } from "@/features/settings/settings";
import { useAuth } from "@/features/auth/AuthContext";
import type { Item, ItemUnit, BiayaTambahan, Customer } from "@/db/types";
import {
  type CartLine,
  addLine,
  removeLine,
  setQty,
  setHarga,
  setDiskonNominal,
  setDiskonPersen,
  cartTotals,
  lineFromItem,
  lineFromItemUnit,
  lineManual,
  lineFromTransactionItem,
} from "@/features/sales/cart";
import { editSale } from "@/features/sales/checkout";
import { ProductPicker } from "@/features/sales/ProductPicker";
import { CartPanel } from "@/features/sales/CartPanel";
import { UnitPickerModal } from "@/features/sales/UnitPickerModal";
import { PriceEditModal } from "@/features/sales/PriceEditModal";
import { DiscountModal } from "@/features/sales/DiscountModal";
import { ManualItemModal } from "@/features/sales/ManualItemModal";
import { CustomerSelect } from "@/features/credit/CustomerSelect";
import { getSaleDetail } from "./history";
import { dateInputToIso } from "@/lib/format";
import { formatRupiah } from "@/lib/money";

/**
 * Edit transaksi penjualan (tunai/piutang). Memuat ulang isi keranjang dari
 * transaksi tersimpan, biarkan diubah (item/qty/harga/diskon/biaya/customer/
 * catatan/dibayar), lalu simpan via editSale — stok & piutang dihitung ulang.
 */
export function SaleEditModal({
  open,
  transactionId,
  onClose,
}: {
  open: boolean;
  transactionId: string | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const settings = useLiveQuery(() => readSettings(), []);
  const isOwner = user?.role === "pemilik";

  const [lines, setLines] = useState<CartLine[]>([]);
  const [biaya, setBiaya] = useState<BiayaTambahan[]>([]);
  const [dibayar, setDibayar] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [catatan, setCatatan] = useState("");
  const [jatuhTempo, setJatuhTempo] = useState("");
  const [tipe, setTipe] = useState<"tunai" | "piutang">("tunai");
  const [noNota, setNoNota] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [unitPick, setUnitPick] = useState<{ item: Item; units: ItemUnit[] } | null>(null);
  const [editHarga, setEditHarga] = useState<CartLine | null>(null);
  const [editDiskon, setEditDiskon] = useState<CartLine | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (!open || !transactionId) return;
    let aktif = true;
    (async () => {
      const { trx, items } = await getSaleDetail(transactionId);
      if (!aktif || !trx) return;
      setLines(items.map(lineFromTransactionItem));
      setBiaya(trx.biaya ?? []);
      setDibayar(trx.dibayar);
      setCatatan(trx.catatan ?? "");
      setTipe(trx.tipe);
      setNoNota(trx.no_nota);
      setJatuhTempo("");
      setErr(null);
      const cust = trx.customer_id ? await db.customers.get(trx.customer_id) : null;
      if (aktif) setCustomer(cust ?? null);
    })();
    return () => {
      aktif = false;
    };
  }, [open, transactionId]);

  const totals = cartTotals(lines, biaya);

  async function pickItem(item: Item) {
    const units = await db.item_units
      .where("item_id")
      .equals(item.id)
      .filter((u) => u.deleted === 0)
      .toArray();
    if (units.length === 0) setLines((ls) => addLine(ls, lineFromItem(item)));
    else setUnitPick({ item, units });
  }
  function pickUnit(unit: ItemUnit | null) {
    if (!unitPick) return;
    const line = unit ? lineFromItemUnit(unitPick.item, unit) : lineFromItem(unitPick.item);
    setLines((ls) => addLine(ls, line));
    setUnitPick(null);
  }
  function pickBarcode(item: Item, unit: ItemUnit | null) {
    setLines((ls) => addLine(ls, unit ? lineFromItemUnit(item, unit) : lineFromItem(item)));
  }

  async function simpan() {
    if (!transactionId) return;
    setErr(null);
    if (tipe === "piutang" && totals.total > dibayar && !customer) {
      setErr("Penjualan piutang wajib memilih customer.");
      return;
    }
    try {
      await editSale({
        transactionId,
        lines,
        biaya,
        dibayar,
        customerId: customer?.id ?? null,
        catatan,
        jatuhTempo: dateInputToIso(jatuhTempo),
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan perubahan.");
    }
  }

  const sisa = Math.max(0, totals.total - dibayar);

  return (
    <Modal open={open} onClose={onClose} title={`Edit Transaksi — ${noNota}`} size="lg">
      <div className="flex flex-col gap-3 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <div className="flex h-[52vh] min-h-[360px] flex-col rounded-xl border border-line p-2">
            <ProductPicker
              onPickItem={pickItem}
              onPickBarcode={pickBarcode}
              onAddManual={() => setManualOpen(true)}
            />
          </div>
          <div className="flex h-[52vh] min-h-[360px] flex-col overflow-hidden rounded-xl border border-line">
            <CartPanel
              lines={lines}
              biaya={biaya}
              totals={totals}
              onSetQty={(k, q) => setLines((ls) => setQty(ls, k, q))}
              onRemove={(k) => setLines((ls) => removeLine(ls, k))}
              onEditHarga={setEditHarga}
              onEditDiskon={setEditDiskon}
              onAddBiaya={(b) => setBiaya((bs) => [...bs, b])}
              onUpdateBiaya={(i, b) => setBiaya((bs) => bs.map((x, j) => (j === i ? b : x)))}
              onRemoveBiaya={(i) => setBiaya((bs) => bs.filter((_, j) => j !== i))}
              onBayar={() => {}}
              onClear={() => setLines([])}
              hideBayar
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="edibayar">Dibayar</Label>
            <MoneyInput id="edibayar" value={dibayar} onChange={setDibayar} />
          </Field>
          <Field>
            <Label>Customer {tipe === "piutang" && sisa > 0 ? "(wajib)" : "(opsional)"}</Label>
            <CustomerSelect selected={customer} onSelect={setCustomer} />
          </Field>
        </div>

        {sisa > 0 && (
          <Field>
            <Label htmlFor="ejt">Jatuh Tempo (opsional)</Label>
            <Input
              id="ejt"
              type="date"
              value={jatuhTempo}
              onChange={(e) => setJatuhTempo(e.target.value)}
            />
          </Field>
        )}

        <Field>
          <Label htmlFor="ecatatan">Catatan</Label>
          <Input
            id="ecatatan"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
          {err && <span className="mr-auto text-sm text-danger">{err}</span>}
          <span className="mr-auto text-sm text-ink-soft">
            Sisa piutang:{" "}
            <span className="num font-semibold text-warn">{formatRupiah(sisa)}</span>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={simpan}>Simpan Perubahan</Button>
        </div>
      </div>

      <UnitPickerModal
        open={!!unitPick}
        item={unitPick?.item ?? null}
        units={unitPick?.units ?? []}
        onClose={() => setUnitPick(null)}
        onPick={pickUnit}
      />
      <PriceEditModal
        open={!!editHarga}
        line={editHarga}
        isOwner={isOwner}
        hargaMode={settings?.harga_mode ?? "longgar"}
        ownerPin={settings?.owner_pin ?? ""}
        onClose={() => setEditHarga(null)}
        onSave={(k, h) => setLines((ls) => setHarga(ls, k, h))}
      />
      <DiscountModal
        open={!!editDiskon}
        line={editDiskon}
        onClose={() => setEditDiskon(null)}
        onSaveNominal={(k, n) => setLines((ls) => setDiskonNominal(ls, k, n))}
        onSavePersen={(k, p) => setLines((ls) => setDiskonPersen(ls, k, p))}
      />
      <ManualItemModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onAdd={(nama, harga) => setLines((ls) => addLine(ls, lineManual(nama, harga)))}
      />
    </Modal>
  );
}
