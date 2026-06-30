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
} from "./cart";
import { checkoutTunai, cekStok, bolehLanjut, type CheckoutResult } from "./checkout";
import { ProductPicker } from "./ProductPicker";
import { CartPanel } from "./CartPanel";
import { UnitPickerModal } from "./UnitPickerModal";
import { PriceEditModal } from "./PriceEditModal";
import { DiscountModal } from "./DiscountModal";
import { PaymentModal } from "./PaymentModal";
import { ManualItemModal } from "./ManualItemModal";

/**
 * Halaman Jual Tunai (Fase 3). Layout 2 kolom: katalog (kiri) + keranjang (kanan).
 * State keranjang dipegang di sini; logika hitung di cart.ts (murni), simpan di
 * checkout.ts. Mengikuti aturan offline-first: semua tulis ke Dexie.
 */
export function SalesPage() {
  const { user } = useAuth();
  const settings = useLiveQuery(() => readSettings(), []);
  const isOwner = user?.role === "pemilik";

  useEffect(() => {
    void seedSettingsIfEmpty();
  }, []);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [biaya, setBiaya] = useState<BiayaTambahan[]>([]);

  // Modal state.
  const [unitPick, setUnitPick] = useState<{ item: Item; units: ItemUnit[] } | null>(null);
  const [editHarga, setEditHarga] = useState<CartLine | null>(null);
  const [editDiskon, setEditDiskon] = useState<CartLine | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [stokWarn, setStokWarn] = useState<string>("");

  const totals = cartTotals(lines, biaya);

  // ── Tambah item ke keranjang ──────────────────────────────────────────

  async function pickItem(item: Item) {
    const units = await db.item_units
      .where("item_id")
      .equals(item.id)
      .filter((u) => u.deleted === 0)
      .toArray();
    if (units.length === 0) {
      setLines((ls) => addLine(ls, lineFromItem(item)));
    } else {
      // Punya satuan konversi → minta pilih satuan.
      setUnitPick({ item, units });
    }
  }

  function pickUnit(unit: ItemUnit | null) {
    if (!unitPick) return;
    const line = unit
      ? lineFromItemUnit(unitPick.item, unit)
      : lineFromItem(unitPick.item);
    setLines((ls) => addLine(ls, line));
    setUnitPick(null);
  }

  /** Dari scan barcode: bila unit cocok, langsung pakai satuan itu. */
  function pickBarcode(item: Item, unit: ItemUnit | null) {
    const line = unit ? lineFromItemUnit(item, unit) : lineFromItem(item);
    setLines((ls) => addLine(ls, line));
  }

  function addManual(nama: string, harga: number) {
    setLines((ls) => addLine(ls, lineManual(nama, harga)));
  }

  // ── Biaya tambahan ──────────────────────────────────────────────────────

  function addBiaya(b: BiayaTambahan) {
    setBiaya((bs) => [...bs, b]);
  }
  function updateBiaya(index: number, b: BiayaTambahan) {
    setBiaya((bs) => bs.map((x, i) => (i === index ? b : x)));
  }
  function removeBiaya(index: number) {
    setBiaya((bs) => bs.filter((_, i) => i !== index));
  }

  // ── Pembayaran ────────────────────────────────────────────────────────

  async function bukaPembayaran() {
    setStokWarn("");
    const mode = settings?.stok_mode ?? "longgar";
    const kurang = await cekStok(lines);
    if (!bolehLanjut(mode, kurang)) {
      // strict + ada stok kurang → blokir.
      setStokWarn(
        "Stok tidak cukup: " +
          kurang
            .map((k) => `${k.nama} (ada ${k.tersedia} ${k.satuan})`)
            .join(", ") +
          ". Aktifkan mode longgar di Pengaturan untuk tetap menjual.",
      );
      return;
    }
    if (kurang.length > 0) {
      // longgar → izinkan, beri peringatan saja.
      setStokWarn(
        "Peringatan: stok minus untuk " +
          kurang.map((k) => k.nama).join(", ") +
          ".",
      );
    }
    setResult(null);
    setPayOpen(true);
  }

  async function konfirmasiBayar(
    dibayar: number,
    customer: Customer | null,
    catatan: string,
  ) {
    if (!user || !settings) return;
    const res = await checkoutTunai({
      lines,
      biaya,
      dibayar,
      customerId: customer?.id ?? null,
      catatan,
      kasirId: user.id,
      settings,
    });
    setResult(res);
  }

  function transaksiBaru() {
    setLines([]);
    setBiaya([]);
    setResult(null);
    setPayOpen(false);
    setStokWarn("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold">Jual Tunai</h1>

      {stokWarn && (
        <div className="mb-3 rounded bg-warn/10 px-4 py-2 text-sm text-warn">{stokWarn}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Katalog */}
        <Card className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col p-3">
          <ProductPicker
            onPickItem={pickItem}
            onPickBarcode={pickBarcode}
            onAddManual={() => setManualOpen(true)}
          />
        </Card>

        {/* Keranjang */}
        <Card className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden">
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

      {/* Modals */}
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
        onAdd={addManual}
      />

      <PaymentModal
        open={payOpen}
        total={totals.total}
        onClose={() => setPayOpen(false)}
        onConfirm={konfirmasiBayar}
        result={result}
        onNewTransaction={transaksiBaru}
      />
    </div>
  );
}
