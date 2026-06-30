import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Input";
import { MoneyInput, NumberInput } from "@/components/ui/MoneyInput";
import { cn } from "@/lib/cn";
import type { CartLine } from "./cart";

/** Diskon per-baris: nominal ATAU persen (saling eksklusif). */
export function DiscountModal({
  open,
  line,
  onClose,
  onSaveNominal,
  onSavePersen,
}: {
  open: boolean;
  line: CartLine | null;
  onClose: () => void;
  onSaveNominal: (key: string, nominal: number) => void;
  onSavePersen: (key: string, persen: number) => void;
}) {
  const [mode, setMode] = useState<"nominal" | "persen">("nominal");
  const [nominal, setNominal] = useState(0);
  const [persen, setPersen] = useState(0);

  useEffect(() => {
    if (open && line) {
      if (line.diskon_persen > 0) {
        setMode("persen");
        setPersen(line.diskon_persen);
        setNominal(0);
      } else {
        setMode("nominal");
        setNominal(line.diskon_nominal);
        setPersen(0);
      }
    }
  }, [open, line]);

  if (!line) return null;

  function simpan() {
    if (mode === "persen") onSavePersen(line!.key, persen);
    else onSaveNominal(line!.key, nominal);
    onClose();
  }

  function hapus() {
    onSaveNominal(line!.key, 0);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Diskon — ${line.nama}`} size="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex gap-2">
          <ModeBtn aktif={mode === "nominal"} onClick={() => setMode("nominal")}>
            Nominal (Rp)
          </ModeBtn>
          <ModeBtn aktif={mode === "persen"} onClick={() => setMode("persen")}>
            Persen (%)
          </ModeBtn>
        </div>

        {mode === "nominal" ? (
          <Field>
            <Label htmlFor="diskon-nominal">Potongan (Rp)</Label>
            <MoneyInput id="diskon-nominal" value={nominal} onChange={setNominal} />
          </Field>
        ) : (
          <Field>
            <Label htmlFor="diskon-persen">Potongan (%)</Label>
            <NumberInput id="diskon-persen" value={persen} onChange={setPersen} suffix="%" />
          </Field>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="secondary" onClick={hapus}>
            Hapus Diskon
          </Button>
          <Button onClick={simpan}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}

function ModeBtn({
  aktif,
  onClick,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded border px-3 py-2 text-sm font-medium",
        aktif
          ? "border-accent bg-accent-soft text-accent"
          : "border-line-strong text-ink-soft hover:bg-bg",
      )}
    >
      {children}
    </button>
  );
}
