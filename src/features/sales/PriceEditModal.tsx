import { useState, useEffect } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatRupiah } from "@/lib/money";
import type { CartLine } from "./cart";

/**
 * Edit harga jual sebuah baris keranjang.
 *
 * Otorisasi (keputusan produk):
 * - PEMILIK: bebas ubah. Bila harga < modal → peringatan merah (tetap boleh).
 * - KASIR + harga_mode 'strict': butuh PIN pemilik (cocokkan owner_pin).
 * - KASIR + harga_mode 'longgar': bebas ubah (tetap kena peringatan < modal).
 *
 * Catatan: bila owner_pin kosong, gerbang PIN tak bisa dipenuhi → kasir strict
 * tidak dapat mengubah harga (pemilik harus set PIN di Pengaturan, Fase 8).
 */
export function PriceEditModal({
  open,
  line,
  isOwner,
  hargaMode,
  ownerPin,
  onClose,
  onSave,
}: {
  open: boolean;
  line: CartLine | null;
  isOwner: boolean;
  hargaMode: "strict" | "longgar";
  ownerPin: string;
  onClose: () => void;
  onSave: (key: string, harga: number) => void;
}) {
  const [harga, setHarga] = useState(0);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    if (open && line) {
      setHarga(line.harga);
      setPin("");
      setPinError("");
    }
  }, [open, line]);

  if (!line) return null;

  // Kasir pada mode strict harus melewati gerbang PIN.
  const butuhPin = !isOwner && hargaMode === "strict";
  const diBawahModal = line.harga_beli > 0 && harga < line.harga_beli;
  const rugi = line.harga_beli - harga;

  function simpan() {
    if (butuhPin) {
      if (!ownerPin) {
        setPinError("PIN pemilik belum diatur. Hubungi pemilik (Pengaturan).");
        return;
      }
      if (pin !== ownerPin) {
        setPinError("PIN salah.");
        return;
      }
    }
    onSave(line!.key, harga);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Ubah harga — ${line.nama}`} size="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="text-sm text-ink-soft">
          Harga acuan: <b className="text-ink">{formatRupiah(line.harga_default)}</b>
          {line.harga_beli > 0 && (
            <>
              {" · "}Modal: <b className="text-ink">{formatRupiah(line.harga_beli)}</b>
            </>
          )}
        </div>

        <Field>
          <Label htmlFor="harga-baru">Harga jual / {line.satuan}</Label>
          <MoneyInput id="harga-baru" value={harga} onChange={setHarga} />
        </Field>

        {diBawahModal && (
          <div className="flex items-start gap-2 rounded bg-danger/10 p-3 text-sm text-danger">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              Di bawah modal! Rugi <b>{formatRupiah(rugi)}</b> per {line.satuan}.
            </span>
          </div>
        )}

        {butuhPin && (
          <Field>
            <Label htmlFor="owner-pin" className="flex items-center gap-1.5">
              <Lock size={14} /> Butuh izin pemilik (PIN)
            </Label>
            <Input
              id="owner-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN pemilik"
              autoFocus
            />
            {pinError && <span className="text-sm text-danger">{pinError}</span>}
          </Field>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant={diBawahModal ? "danger" : "primary"} onClick={simpan}>
            {diBawahModal ? "Tetap Simpan" : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
