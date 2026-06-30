import { useState, useEffect } from "react";
import { CheckCircle2, Printer, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatRupiah } from "@/lib/money";
import { printReceipt } from "@/features/sales/printReceipt";
import type { CheckoutPiutangResult } from "@/features/sales/checkout";
import { statusBadge } from "./StatusBadge";

/**
 * Modal checkout PIUTANG: tampilkan customer terpilih, total, input uang muka
 * (DP, boleh 0 = belum bayar), dan jatuh tempo opsional. Setelah simpan,
 * ringkasan sukses dengan sisa piutang + opsi cetak nota.
 */
export function CreditPaymentModal({
  open,
  total,
  customerNama,
  onClose,
  onConfirm,
  result,
  onNewTransaction,
}: {
  open: boolean;
  total: number;
  customerNama: string;
  onClose: () => void;
  onConfirm: (dp: number, jatuhTempo: string | null, catatan: string) => void;
  result: CheckoutPiutangResult | null;
  onNewTransaction: () => void;
}) {
  const [dp, setDp] = useState(0);
  const [jatuhTempo, setJatuhTempo] = useState("");
  const [catatan, setCatatan] = useState("");
  const [mencetak, setMencetak] = useState(false);

  useEffect(() => {
    if (open && !result) {
      setDp(0);
      setJatuhTempo("");
      setCatatan("");
      setMencetak(false);
    }
  }, [open, result]);

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
    return (
      <Modal open={open} onClose={onNewTransaction} title="Piutang Tercatat" size="sm">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <CheckCircle2 size={56} className="text-accent" />
          <div className="num text-xs text-ink-soft">{result.noNota}</div>
          <div className="w-full space-y-1 text-sm">
            <Baris label="Customer" value={customerNama} />
            <Baris label="Total" value={formatRupiah(result.total)} />
            <Baris label="Dibayar (DP)" value={formatRupiah(result.dibayar)} />
          </div>
          <div className="w-full rounded-xl bg-warn/10 p-4">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-warn">
              Sisa Piutang {statusBadge(result.status)}
            </div>
            <div className="num text-4xl font-bold text-warn">
              {formatRupiah(result.sisa)}
            </div>
          </div>
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

  // ── Input ──
  const dpValid = dp >= 0 && dp <= total;
  const sisa = Math.max(0, total - dp);

  return (
    <Modal open={open} onClose={onClose} title="Jual Piutang" size="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-accent">
          <CreditCard size={18} />
          <span className="font-semibold">{customerNama}</span>
        </div>

        <div className="rounded-xl bg-bg p-4 text-center">
          <div className="text-sm text-ink-soft">Total Tagihan</div>
          <div className="num text-3xl font-bold">{formatRupiah(total)}</div>
        </div>

        <Field>
          <Label htmlFor="dp">Uang Muka / DP (opsional)</Label>
          <MoneyInput id="dp" value={dp} onChange={setDp} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDp(0)}>
            Tanpa DP
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDp(total)}>
            Lunaskan
          </Button>
        </div>

        <Field>
          <Label htmlFor="jt">Jatuh Tempo (opsional)</Label>
          <Input
            id="jt"
            type="date"
            value={jatuhTempo}
            onChange={(e) => setJatuhTempo(e.target.value)}
          />
        </Field>

        <Field>
          <Label htmlFor="cat">Catatan (opsional)</Label>
          <Input
            id="cat"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. proyek rumah Pak Budi"
          />
        </Field>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-ink-soft">Sisa Piutang</span>
          <span className="num text-2xl font-bold text-warn">{formatRupiah(sisa)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!dpValid}
            onClick={() => onConfirm(dp, jatuhTempo ? toIso(jatuhTempo) : null, catatan)}
          >
            Simpan Piutang
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Tanggal <input type=date> ("2026-06-28") → ISO awal hari. */
function toIso(d: string): string {
  return new Date(d + "T00:00:00").toISOString();
}

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}
