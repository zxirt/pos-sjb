import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, CalendarClock, HandCoins, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatRupiah } from "@/lib/money";
import { formatTanggal } from "@/lib/format";
import { cn } from "@/lib/cn";
import { statusBadge, lateBadge } from "./StatusBadge";
import { terlambat } from "./payments";
import {
  listReceivables,
  totalSisaPiutang,
  bayarPiutang,
  bayarPiutangBatch,
  piutangBelumLunasCustomer,
  riwayatPembayaranPiutang,
  editPembayaranPiutang,
  hapusPembayaranPiutang,
  type ReceivableView,
} from "./receivables";
import {
  listPayables,
  totalSisaHutang,
  bayarHutang,
  bayarHutangBatch,
  hutangBelumLunasSupplier,
  deletePayable,
  riwayatPembayaranHutang,
  editPembayaranHutang,
  hapusPembayaranHutang,
  type PayableView,
} from "./payables";
import { searchCustomers } from "@/features/customers/customers";
import { searchSuppliers } from "@/features/suppliers/suppliers";
import { PayBillModal } from "./PayBillModal";
import { PayableForm } from "./PayableForm";
import { SettlementModal, type TagihanItem, type PihakOpsi } from "./SettlementModal";
import type { Payment, Payable } from "@/db/types";

type Tab = "piutang" | "hutang";

/**
 * Halaman Hutang & Piutang (Fase 4). Dua tab: Piutang (dari customer) & Hutang
 * (ke supplier). Tiap baris menampilkan sisa, status, jatuh tempo, dan tombol
 * bayar (cicilan/pelunasan). Hutang bisa ditambah manual.
 */
export function DebtsPage() {
  const [tab, setTab] = useState<Tab>("piutang");
  const [belumLunas, setBelumLunas] = useState(true);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Hutang &amp; Piutang</h1>

      <div className="mb-4 flex gap-2">
        <TabButton active={tab === "piutang"} onClick={() => setTab("piutang")}>
          Piutang
        </TabButton>
        <TabButton active={tab === "hutang"} onClick={() => setTab("hutang")}>
          Hutang
        </TabButton>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={belumLunas}
          onChange={(e) => setBelumLunas(e.target.checked)}
          className="h-4 w-4"
        />
        Sembunyikan yang sudah lunas
      </label>

      {tab === "piutang" ? (
        <PiutangTab belumLunas={belumLunas} />
      ) : (
        <HutangTab belumLunas={belumLunas} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-accent text-white" : "bg-surface text-ink-soft hover:bg-bg",
      )}
    >
      {children}
    </button>
  );
}

// ── Tab Piutang ────────────────────────────────────────────────────────────

function PiutangTab({ belumLunas }: { belumLunas: boolean }) {
  const rows = useLiveQuery(() => listReceivables(belumLunas), [belumLunas]);
  // Selalu muat semua piutang utk lookup baris aktif (agar tetap terlihat saat
  // jadi lunas walau filter "sembunyikan lunas" aktif).
  const semua = useLiveQuery(() => listReceivables(false), []);
  const total = useLiveQuery(() => totalSisaPiutang(), []);
  const customers = useLiveQuery(() => searchCustomers(""), []);
  const [bayarId, setBayarId] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<Payment[]>([]);
  const [lunasOpen, setLunasOpen] = useState(false);
  const now = new Date();

  const bayar = bayarId ? semua?.find((r) => r.id === bayarId) : undefined;
  const opsiPihak: PihakOpsi[] = (customers ?? []).map((c) => ({ id: c.id, nama: c.nama }));

  async function muatRiwayat(id: string) {
    setRiwayat(await riwayatPembayaranPiutang(id));
  }
  async function buka(r: ReceivableView) {
    await muatRiwayat(r.id);
    setBayarId(r.id);
  }
  async function pay(jumlah: number, tanggal: string) {
    if (!bayarId) return;
    await bayarPiutang(bayarId, jumlah, "tunai", tanggal);
    await muatRiwayat(bayarId);
  }

  return (
    <>
      <Ringkasan label="Total piutang berjalan" value={total ?? 0} />
      <div className="mb-3">
        <Button onClick={() => setLunasOpen(true)}>
          <Wallet size={18} /> Pelunasan per Customer
        </Button>
      </div>
      <Card className="divide-y divide-line">
        {rows?.map((r) => (
          <BillRow
            key={r.id}
            nama={r.customerNama}
            noNota={r.noNota}
            catatan={r.catatan}
            jumlah={r.jumlah}
            sisa={r.sisa}
            status={r.status}
            jatuhTempo={r.jatuh_tempo}
            late={terlambat(r.jatuh_tempo, r.status, now)}
            onBayar={() => buka(r)}
          />
        ))}
        {rows?.length === 0 && (
          <div className="p-8 text-center text-ink-soft">Tidak ada piutang.</div>
        )}
      </Card>

      {bayar && (
        <PayBillModal
          open={!!bayar}
          title="Bayar Piutang"
          judulPihak="Customer"
          namaPihak={bayar.customerNama}
          jumlah={bayar.jumlah}
          sisa={bayar.sisa}
          riwayat={riwayat}
          onClose={() => setBayarId(null)}
          onPay={pay}
          onEditPayment={async (pid, j, tgl) => {
            await editPembayaranPiutang(pid, j, tgl);
            await muatRiwayat(bayar.id);
          }}
          onDeletePayment={async (pid) => {
            await hapusPembayaranPiutang(pid);
            await muatRiwayat(bayar.id);
          }}
        />
      )}

      <SettlementModal
        open={lunasOpen}
        title="Pelunasan Piutang per Customer"
        labelPihak="Customer"
        opsiPihak={opsiPihak}
        bolehUmum
        loadTagihan={async (cid) =>
          (await piutangBelumLunasCustomer(cid)).map(
            (r): TagihanItem => ({
              id: r.id,
              noNota: r.noNota,
              tanggal: r.created_at,
              jumlah: r.jumlah,
              sisa: r.sisa,
            }),
          )
        }
        onClose={() => setLunasOpen(false)}
        onBayar={(alokasi, tgl) => bayarPiutangBatch(alokasi, "tunai", tgl)}
      />
    </>
  );
}

// ── Tab Hutang ───────────────────────────────────────────────────────────

function HutangTab({ belumLunas }: { belumLunas: boolean }) {
  const rows = useLiveQuery(() => listPayables(belumLunas), [belumLunas]);
  const semua = useLiveQuery(() => listPayables(false), []);
  const total = useLiveQuery(() => totalSisaHutang(), []);
  const suppliers = useLiveQuery(() => searchSuppliers(""), []);
  const [bayarId, setBayarId] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<Payment[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [lunasOpen, setLunasOpen] = useState(false);
  const [edit, setEdit] = useState<Payable | undefined>();
  const now = new Date();

  const bayar = bayarId ? semua?.find((p) => p.id === bayarId) : undefined;
  const opsiPihak: PihakOpsi[] = (suppliers ?? []).map((s) => ({ id: s.id, nama: s.nama }));

  async function muatRiwayat(id: string) {
    setRiwayat(await riwayatPembayaranHutang(id));
  }
  async function buka(p: PayableView) {
    await muatRiwayat(p.id);
    setBayarId(p.id);
  }
  async function pay(jumlah: number, tanggal: string) {
    if (!bayarId) return;
    await bayarHutang(bayarId, jumlah, "tunai", tanggal);
    await muatRiwayat(bayarId);
  }
  async function hapus(p: PayableView) {
    if (confirm(`Hapus hutang ke "${p.supplierNama}"?`)) await deletePayable(p.id);
  }

  return (
    <>
      <Ringkasan label="Total hutang berjalan" value={total ?? 0} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Button onClick={() => setLunasOpen(true)}>
          <Wallet size={18} /> Pelunasan per Supplier
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEdit(undefined);
            setManualOpen(true);
          }}
        >
          <Plus size={18} /> Catat Hutang Manual
        </Button>
      </div>

      <Card className="divide-y divide-line">
        {rows?.map((p) => (
          <BillRow
            key={p.id}
            nama={p.supplierNama}
            noNota={p.noNota}
            catatan={p.catatan}
            jumlah={p.jumlah}
            sisa={p.sisa}
            status={p.status}
            jatuhTempo={p.jatuh_tempo}
            late={terlambat(p.jatuh_tempo, p.status, now)}
            onBayar={() => buka(p)}
            // Hanya hutang manual yang boleh diedit nominalnya; hutang dari
            // pembelian barang tidak (nilainya berasal dari barang).
            onEdit={
              p.purchase_id
                ? undefined
                : () => {
                    setEdit(p);
                    setManualOpen(true);
                  }
            }
            onDelete={() => hapus(p)}
          />
        ))}
        {rows?.length === 0 && (
          <div className="p-8 text-center text-ink-soft">Tidak ada hutang.</div>
        )}
      </Card>

      {bayar && (
        <PayBillModal
          open={!!bayar}
          title="Bayar Hutang"
          judulPihak="Supplier"
          namaPihak={bayar.supplierNama}
          jumlah={bayar.jumlah}
          sisa={bayar.sisa}
          riwayat={riwayat}
          onClose={() => setBayarId(null)}
          onPay={pay}
          onEditPayment={async (pid, j, tgl) => {
            await editPembayaranHutang(pid, j, tgl);
            await muatRiwayat(bayar.id);
          }}
          onDeletePayment={async (pid) => {
            await hapusPembayaranHutang(pid);
            await muatRiwayat(bayar.id);
          }}
        />
      )}

      <PayableForm open={manualOpen} payable={edit} onClose={() => setManualOpen(false)} />

      <SettlementModal
        open={lunasOpen}
        title="Pelunasan Hutang per Supplier"
        labelPihak="Supplier"
        opsiPihak={opsiPihak}
        loadTagihan={async (sid) =>
          sid === null
            ? []
            : (await hutangBelumLunasSupplier(sid)).map(
                (p): TagihanItem => ({
                  id: p.id,
                  noNota: p.noNota || "(hutang manual)",
                  tanggal: p.created_at,
                  jumlah: p.jumlah,
                  sisa: p.sisa,
                }),
              )
        }
        onClose={() => setLunasOpen(false)}
        onBayar={(alokasi, tgl) => bayarHutangBatch(alokasi, "tunai", tgl)}
      />
    </>
  );
}

// ── Komponen bersama ───────────────────────────────────────────────────────

function Ringkasan({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 rounded-xl bg-bg p-4", className)}>
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="num text-2xl font-bold">{formatRupiah(value)}</div>
    </div>
  );
}

function BillRow({
  nama,
  noNota,
  catatan,
  jumlah,
  sisa,
  status,
  jatuhTempo,
  late,
  onBayar,
  onEdit,
  onDelete,
}: {
  nama: string;
  noNota?: string;
  catatan?: string;
  jumlah: number;
  sisa: number;
  status: import("@/db/types").StatusTransaksi;
  jatuhTempo: string | null;
  late: boolean;
  onBayar: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{nama}</span>
          {statusBadge(status)}
          {late && lateBadge()}
        </div>
        {noNota && <div className="num mt-0.5 text-xs text-ink-soft">{noNota}</div>}
        {catatan && <div className="mt-0.5 text-sm text-ink-soft">{catatan}</div>}
        <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-soft">
          <span className="num">
            Total {formatRupiah(jumlah)}
          </span>
          {status !== "lunas" && (
            <span className="num font-medium text-warn">Sisa {formatRupiah(sisa)}</span>
          )}
          {jatuhTempo && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={13} /> {formatTanggal(jatuhTempo)}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {status !== "lunas" && (
          <Button size="sm" onClick={onBayar}>
            <HandCoins size={15} /> Bayar
          </Button>
        )}
        {(onEdit || onDelete) && (
          <div className="flex gap-1">
            {onEdit && (
              <button onClick={onEdit} className="text-xs text-ink-soft hover:text-accent">
                Edit
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="text-xs text-ink-soft hover:text-danger">
                Hapus
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
