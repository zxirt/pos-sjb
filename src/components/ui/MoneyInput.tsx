import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { formatNumber, parseRupiah } from "@/lib/money";

interface MoneyInputProps {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
  id?: string;
  placeholder?: string;
}

/** Input uang: tampil dengan pemisah ribuan, simpan sebagai integer. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, prefix = "Rp", suffix, className, id, placeholder }, ref) => (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded border border-line-strong bg-surface",
        "focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft",
        className,
      )}
    >
      {prefix && (
        <span className="flex items-center border-r border-line bg-bg px-3 text-sm text-ink-soft">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        inputMode="numeric"
        className="num w-full bg-transparent px-3 py-[11px] text-right text-[15px] outline-none touch-target"
        value={value ? formatNumber(value) : ""}
        placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(parseRupiah(e.target.value))}
      />
      {suffix && (
        <span className="flex items-center border-l border-line bg-bg px-3 text-sm text-ink-soft">
          {suffix}
        </span>
      )}
    </div>
  ),
);
MoneyInput.displayName = "MoneyInput";

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  className?: string;
  id?: string;
  step?: number;
}

/** Input angka biasa (qty, konversi, margin) dengan tampilan kanan. */
export function NumberInput({ value, onChange, suffix, className, id, step }: NumberInputProps) {
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded border border-line-strong bg-surface",
        "focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft",
        className,
      )}
    >
      <input
        id={id}
        type="number"
        step={step}
        className="num w-full bg-transparent px-3 py-[11px] text-right text-[15px] outline-none touch-target"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {suffix && (
        <span className="flex items-center border-l border-line bg-bg px-3 text-sm text-ink-soft">
          {suffix}
        </span>
      )}
    </div>
  );
}
