import { useState, useEffect } from "react";
import { CheckCircle2, Printer, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatRupiah } from "@/lib/money";
import type { Customer } from "@/db/types";
import type { CheckoutResult } from "./checkout";
import { printReceipt } from "./printReceipt";
import { CustomerSelect } from "@/features/credit/CustomerSelect";
import { statusBadge } from "@/features/credit/StatusBadge";

/** Nominal cepat (uang yang umum diserahkan). */
const PRESET = [50000, 100000, 150000, 200000];

/**
 * Modal pembayaran tunai. Uang dibayar boleh KURANG dari total → sisanya
 * tercatat sebagai piutang (customer opsional + catatan). Setelah simpan,
 * ringkasan sukses (kembalian besar, atau sisa piutang bila kurang bayar) +
 * opsi cetak nota.
 */
export function PaymentModal({
  open,
  total,
  onClose,
  onConfirm,
  result,
  onNewTransaction,
}: {
  open: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (dibayar: number, customer: Customer | null, catatan: string) => void;
  result: CheckoutResult | null;
  onNewTransaction: () => void;
}) {
  const [dibayar, setDibayar] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [catatan, setCatatan] = useState("");
  const [mencetak, setMencetak] = useState(false);

  useEffect(() => {
    if (open && !result) {
      setDibayar(total);
      setCustomer(null);
      setCatatan("");
      setMencetak(false);
    }
  }, [open, result, total]);

  const kembalian = Math.max(0, dibayar - total);
  const kurang = dibayar < total;
  const sisaPiutang = Math.max(0, total - dibayar);

  async function cetak() {
    if (!result) return;
    setMencetak(true);
    try {
      await printReceipt(result.receipt);
    } finally {
      setMencetak(false);
    }
  }

  // ── Ringkasan sukses ──
  if (result) {
    const adaPiutang = result.sisa > 0;
    return (
      <Modal open={open} onClose={onNewTransaction} title="Transaksi Tersimpan" size="sm">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <CheckCircle2 size={56} className="text-accent" />
          <div className="num text-xs text-ink-soft">{result.noNota}</div>
          <div className="w-full space-y-1 text-sm">
            <Baris label="Total" value={formatRupiah(result.total)} />
            <Baris label="Dibayar" value={formatRupiah(result.dibayar)} />
          </div>
          {adaPiutang ? (
            <div className="w-full rounded-xl bg-warn/10 p-4">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-warn">
                Sisa Piutang {statusBadge(result.status)}
              </div>
              <div className="num text-4xl font-bold text-warn">
                {formatRupiah(result.sisa)}
              </div>
            </div>
          ) : (
            <div className="w-full rounded-xl bg-accent-soft p-4">
              <div className="text-sm font-medium text-accent">Kembalian</div>
              <div className="num text-4xl font-bold text-accent">
                {formatRupiah(result.kembalian)}
              </div>
            </div>
          )}
          <div className="flex w-full flex-col gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={mencetak}
              onClick={cetak}
            >
              <Printer size={18} /> {mencetak ? "Menyiapkan…" : "Cetak Nota"}
            </Button>
            <Button size="lg" className="w-full" onClick={onNewTransaction}>
              Transaksi Baru
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Input pembayaran ──
  return (
    <Modal open={open} onClose={onClose} title="Pembayaran Tunai" size="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="rounded-xl bg-bg p-4 text-center">
          <div className="text-sm text-ink-soft">Total Belanja</div>
          <div className="num text-3xl font-bold">{formatRupiah(total)}</div>
        </div>

        <Field>
          <Label htmlFor="dibayar">Uang Dibayar</Label>
          <MoneyInput id="dibayar" value={dibayar} onChange={setDibayar} />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDibayar(total)}>
            Uang Pas
          </Button>
          {PRESET.filter((p) => p >= total).map((p) => (
            <Button key={p} variant="secondary" size="sm" onClick={() => setDibayar(p)}>
              {formatRupiah(p)}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-ink-soft">{kurang ? "Sisa piutang" : "Kembalian"}</span>
          <span
            className={`num text-2xl font-bold ${kurang ? "text-warn" : "text-accent"}`}
          >
            {kurang ? formatRupiah(sisaPiutang) : formatRupiah(kembalian)}
          </span>
        </div>

        {/* Kurang bayar → jadi piutang: pilih customer (opsional) + jatuh tempo dilewati */}
        {kurang && (
          <div className="space-y-3 rounded-xl bg-warn/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-warn">
              <AlertTriangle size={15} /> Kurang bayar — sisa dicatat sebagai piutang
            </div>
            <CustomerSelect selected={customer} onSelect={setCustomer} />
            {!customer && (
              <p className="text-xs text-ink-soft">
                Tanpa customer, piutang tercatat sebagai "Umum".
              </p>
            )}
          </div>
        )}

        <Field>
          <Label htmlFor="catatan">Catatan (opsional)</Label>
          <Input
            id="catatan"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. titip dulu, ambil besok"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => onConfirm(dibayar, customer, catatan)}>
            {kurang ? "Simpan (Piutang)" : "Simpan Transaksi"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}
