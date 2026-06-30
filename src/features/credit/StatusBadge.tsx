import { cn } from "@/lib/cn";
import type { StatusTransaksi } from "@/db/types";

const LABEL: Record<StatusTransaksi, string> = {
  lunas: "Lunas",
  sebagian: "Sebagian",
  belum: "Belum bayar",
};

const STYLE: Record<StatusTransaksi, string> = {
  lunas: "bg-accent-soft text-accent",
  sebagian: "bg-warn/10 text-warn",
  belum: "bg-danger/10 text-danger",
};

/** Badge status pembayaran (lunas/sebagian/belum). */
export function statusBadge(status: StatusTransaksi) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
        STYLE[status],
      )}
    >
      {LABEL[status]}
    </span>
  );
}

/** Badge "Terlambat" untuk tagihan lewat jatuh tempo. */
export function lateBadge() {
  return (
    <span className="inline-block rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">
      Terlambat
    </span>
  );
}
