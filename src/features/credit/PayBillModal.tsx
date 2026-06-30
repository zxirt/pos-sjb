import { useState, useEffect } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatRupiah } from "@/lib/money";
import { formatTanggalJam, todayInput, dateInputToIso } from "@/lib/format";
import type { Payment } from "@/db/types";

/**
 * Modal pembayaran (cicilan/pelunasan) untuk piutang ATAU hutang. Menampilkan
 * sisa, input nominal (default = pelunasan penuh), tombol cepat, dan riwayat
 * pembayaran. Caller menyediakan riwayat + handler bayar.
 */
export function PayBillModal({
  open,
  title,
  judulPihak,
  namaPihak,
  jumlah,
  sisa,
  riwayat,
  onClose,
  onPay,
  onEditPayment,
  onDeletePayment,
}: {
  open: boolean;
  title: string;
  judulPihak: string; // "Customer" / "Supplier"
  namaPihak: string;
  jumlah: number;
  sisa: number;
  riwayat: Payment[];
  onClose: () => void;
  onPay: (jumlah: number, tanggal: string) => void;
  onEditPayment?: (paymentId: string, jumlah: number, tanggal: string) => void;
  onDeletePayment?: (paymentId: string) => void;
}) {
  const [bayar, setBayar] = useState(0);
  const [tanggal, setTanggal] = useState(todayInput());
  const [editId, setEditId] = useState<string | null>(null);
  const [editNominal, setEditNominal] = useState(0);
  const [editTanggal, setEditTanggal] = useState("");

  useEffect(() => {
    if (open) {
      setBayar(sisa);
      setTanggal(todayInput());
      setEditId(null);
    }
  }, [open, sisa]);

  const valid = bayar > 0 && bayar <= sisa;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="space-y-1 text-sm">
          <Baris label={judulPihak} value={namaPihak} />
          <Baris label="Total tagihan" value={formatRupiah(jumlah)} />
        </div>

        <div className="rounded-xl bg-warn/10 p-4 text-center">
          <div className="text-sm font-medium text-warn">Sisa</div>
          <div className="num text-3xl font-bold text-warn">{formatRupiah(sisa)}</div>
        </div>

        <Field>
          <Label htmlFor="bayar">Jumlah Bayar</Label>
          <MoneyInput id="bayar" value={bayar} onChange={setBayar} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setBayar(sisa)}>
            Lunasi
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setBayar(Math.round(sisa / 2))}>
            Separuh
          </Button>
        </div>
        <Field>
          <Label htmlFor="tglbayar">Tanggal Pembayaran</Label>
          <Input
            id="tglbayar"
            type="date"
            value={tanggal}
            max={todayInput()}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </Field>

        {riwayat.length > 0 && (
          <div className="border-t border-line pt-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
              Riwayat Pelunasan
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {riwayat.map((p) => {
                const sedangEdit = editId === p.id;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-2">
                    {sedangEdit ? (
                      <>
                        <Input
                          type="date"
                          value={editTanggal}
                          max={todayInput()}
                          onChange={(e) => setEditTanggal(e.target.value)}
                          className="h-9 w-36 py-0 text-sm"
                        />
                        <MoneyInput
                          value={editNominal}
                          onChange={setEditNominal}
                          className="w-28"
                        />
                        <button
                          onClick={() => {
                            onEditPayment?.(
                              p.id,
                              editNominal,
                              dateInputToIso(editTanggal) ?? p.tanggal,
                            );
                            setEditId(null);
                          }}
                          aria-label="Simpan"
                          className="rounded p-1 text-accent hover:bg-bg"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          aria-label="Batal"
                          className="rounded p-1 text-ink-soft hover:bg-bg"
                        >
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-ink-soft">
                          {formatTanggalJam(p.tanggal)}
                        </span>
                        <span className="num font-medium">{formatRupiah(p.jumlah)}</span>
                        {onEditPayment && (
                          <button
                            onClick={() => {
                              setEditId(p.id);
                              setEditNominal(p.jumlah);
                              setEditTanggal(todayInput(new Date(p.tanggal)));
                            }}
                            aria-label="Edit pembayaran"
                            className="rounded p-1 text-ink-soft hover:text-accent"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {onDeletePayment && (
                          <button
                            onClick={() => {
                              if (confirm("Hapus pembayaran ini?")) onDeletePayment(p.id);
                            }}
                            aria-label="Hapus pembayaran"
                            className="rounded p-1 text-ink-soft hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          <Button
            disabled={!valid}
            onClick={() => onPay(bayar, dateInputToIso(tanggal) ?? new Date().toISOString())}
          >
            Catat Pembayaran
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
      <span className="font-medium">{value}</span>
    </div>
  );
}
