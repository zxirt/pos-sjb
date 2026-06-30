import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/features/auth/AuthContext";
import { readSettings, seedSettingsIfEmpty } from "@/features/settings/settings";
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
} from "@/features/sales/cart";
import {
  checkoutPiutang,
  cekStok,
  bolehLanjut,
  type CheckoutPiutangResult,
} from "@/features/sales/checkout";
import { ProductPicker } from "@/features/sales/ProductPicker";
import { CartPanel } from "@/features/sales/CartPanel";
import { UnitPickerModal } from "@/features/sales/UnitPickerModal";
import { PriceEditModal } from "@/features/sales/PriceEditModal";
import { DiscountModal } from "@/features/sales/DiscountModal";
import { ManualItemModal } from "@/features/sales/ManualItemModal";
import { CustomerSelect } from "./CustomerSelect";
import { CreditPaymentModal } from "./CreditPaymentModal";

/**
 * Halaman Jual Piutang (Fase 4). Mesin keranjang sama dengan Jual Tunai
 * (komponen ProductPicker/CartPanel/modal di-reuse), tetapi WAJIB memilih
 * customer dan menyimpan via checkoutPiutang → membuat baris Receivable.
 */
export function CreditSalesPage() {
  const { user } = useAuth();
  const settings = useLiveQuery(() => readSettings(), []);
  const isOwner = user?.role === "pemilik";

  useEffect(() => {
    void seedSettingsIfEmpty();
  }, []);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [biaya, setBiaya] = useState<BiayaTambahan[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [unitPick, setUnitPick] = useState<{ item: Item; units: ItemUnit[] } | null>(null);
  const [editHarga, setEditHarga] = useState<CartLine | null>(null);
  const [editDiskon, setEditDiskon] = useState<CartLine | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [result, setResult] = useState<CheckoutPiutangResult | null>(null);
  const [warn, setWarn] = useState("");

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
    const line = unit ? lineFromItemUnit(item, unit) : lineFromItem(item);
    setLines((ls) => addLine(ls, line));
  }

  function addManual(nama: string, harga: number) {
    setLines((ls) => addLine(ls, lineManual(nama, harga)));
  }

  function addBiaya(b: BiayaTambahan) {
    setBiaya((bs) => [...bs, b]);
  }
  function updateBiaya(index: number, b: BiayaTambahan) {
    setBiaya((bs) => bs.map((x, i) => (i === index ? b : x)));
  }
  function removeBiaya(index: number) {
    setBiaya((bs) => bs.filter((_, i) => i !== index));
  }

  async function bukaPembayaran() {
    setWarn("");
    if (!customer) {
      setWarn("Pilih customer terlebih dahulu untuk penjualan piutang.");
      return;
    }
    const mode = settings?.stok_mode ?? "longgar";
    const kurang = await cekStok(lines);
    if (!bolehLanjut(mode, kurang)) {
      setWarn(
        "Stok tidak cukup: " +
          kurang.map((k) => `${k.nama} (ada ${k.tersedia} ${k.satuan})`).join(", ") +
          ". Aktifkan mode longgar di Pengaturan untuk tetap menjual.",
      );
      return;
    }
    if (kurang.length > 0) {
      setWarn("Peringatan: stok minus untuk " + kurang.map((k) => k.nama).join(", ") + ".");
    }
    setResult(null);
    setPayOpen(true);
  }

  async function konfirmasi(dp: number, jatuhTempo: string | null, catatan: string) {
    if (!user || !settings || !customer) return;
    const res = await checkoutPiutang({
      lines,
      biaya,
      dibayar: dp,
      customerId: customer.id,
      catatan,
      jatuhTempo,
      kasirId: user.id,
      settings,
    });
    setResult(res);
  }

  function transaksiBaru() {
    setLines([]);
    setBiaya([]);
    setCustomer(null);
    setResult(null);
    setPayOpen(false);
    setWarn("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold">Jual Piutang</h1>

      {warn && (
        <div className="mb-3 rounded bg-warn/10 px-4 py-2 text-sm text-warn">{warn}</div>
      )}

      <div className="mb-4">
        <CustomerSelect selected={customer} onSelect={setCustomer} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card className="flex h-[calc(100vh-300px)] min-h-[420px] flex-col p-3">
          <ProductPicker
            onPickItem={pickItem}
            onPickBarcode={pickBarcode}
            onAddManual={() => setManualOpen(true)}
          />
        </Card>

        <Card className="flex h-[calc(100vh-300px)] min-h-[420px] flex-col overflow-hidden">
          <CartPanel
            lines={lines}
            biaya={biaya}
            totals={totals}
            onSetQty={(k, q) => setLines((ls) => setQty(ls, k, q))}
            onRemove={(k) => setLines((ls) => removeLine(ls, k))}
            onEditHarga={setEditHarga}
            onEditDiskon={setEditDiskon}
            onAddBiaya={addBiaya}
            onUpdateBiaya={updateBiaya}
            onRemoveBiaya={removeBiaya}
            onBayar={bukaPembayaran}
            onClear={() => {
              setLines([]);
              setBiaya([]);
            }}
          />
        </Card>
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

      <ManualItemModal open={manualOpen} onClose={() => setManualOpen(false)} onAdd={addManual} />

      <CreditPaymentModal
        open={payOpen}
        total={totals.total}
        customerNama={customer?.nama ?? ""}
        onClose={() => setPayOpen(false)}
        onConfirm={konfirmasi}
        result={result}
        onNewTransaction={transaksiBaru}
      />
    </div>
  );
}
