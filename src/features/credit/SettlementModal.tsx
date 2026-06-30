import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Label, Select, Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatRupiah } from "@/lib/money";
import { formatTanggal, todayInput, dateInputToIso } from "@/lib/format";
import { cn } from "@/lib/cn";
import { alokasiFifo, totalSisa, type HasilAlokasi } from "./allocate";

/** Satu tagihan dalam daftar pelunasan. */
export interface TagihanItem {
  id: string;
  noNota: string;
  tanggal: string; // created_at / tanggal tagihan
  jumlah: number;
  sisa: number;
}

export interface PihakOpsi {
  id: string; // "" = Umum (khusus piutang)
  nama: string;
}

/**
 * Pelunasan per pihak (customer/supplier). Pilih pihak → daftar tagihan belum
 * lunas muncul. User boleh centang sebagian tagihan (default: semua). Masukkan
 * jumlah bayar → dialokasikan FIFO (tertua dulu) ke tagihan terpilih. Tombol
 * "Lunasi semua terpilih" mengisi jumlah = total sisa terpilih.
 */
export function SettlementModal({
  open,
  title,
  labelPihak,
  opsiPihak,
  bolehUmum = false,
  loadTagihan,
  onClose,
  onBayar,
}: {
  open: boolean;
  title: string;
  labelPihak: string; // "Supplier" / "Customer"
  opsiPihak: PihakOpsi[];
  bolehUmum?: boolean; // tampilkan opsi "Umum" (piutang tanpa customer)
  loadTagihan: (pihakId: string | null) => Promise<TagihanItem[]>;
  onClose: () => void;
  onBayar: (alokasi: HasilAlokasi[], tanggal: string) => Promise<void>;
}) {
  const [pihakId, setPihakId] = useState<string>("");
  const [pilihPihak, setPilihPihak] = useState(false); // sudah memilih pihak?
  const [tagihan, setTagihan] = useState<TagihanItem[]>([]);
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [bayar, setBayar] = useState(0);
  const [tanggal, setTanggal] = useState(todayInput());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPihakId("");
      setPilihPihak(false);
      setTagihan([]);
      setTerpilih(new Set());
      setBayar(0);
      setTanggal(todayInput());
      setErr(null);
    }
  }, [open]);

  async function muat() {
    setErr(null);
    if (!pihakId && !(bolehUmum && pihakId === "__umum")) {
      if (!pihakId) return setErr(`Pilih ${labelPihak.toLowerCase()} dulu.`);
    }
    const realId = pihakId === "__umum" ? null : pihakId;
    const rows = await loadTagihan(realId);
    setTagihan(rows);
    setTerpilih(new Set(rows.map((r) => r.id))); // default: semua tercentang
    setBayar(totalSisa(rows));
    setPilihPihak(true);
  }

  function toggle(id: string) {
    setTerpilih((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const tagihanTerpilih = tagihan.filter((t) => terpilih.has(t.id));
  const sisaTerpilih = totalSisa(tagihanTerpilih);
  const alokasi = alokasiFifo(bayar, tagihanTerpilih);
  const alokasiMap = new Map(alokasi.map((a) => [a.id, a.bayar]));

  async function simpan() {
    setErr(null);
    if (alokasi.length === 0) return setErr("Tidak ada yang dibayar.");
    try {
      await onBayar(alokasi, dateInputToIso(tanggal) ?? new Date().toISOString());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan pembayaran.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-end gap-2">
          <Field>
            <Label htmlFor="spihak">{labelPihak}</Label>
            <Select
              id="spihak"
              value={pihakId}
              onChange={(e) => {
                setPihakId(e.target.value);
                setPilihPihak(false);
              }}
            >
              <option value="">— Pilih {labelPihak.toLowerCase()} —</option>
              {bolehUmum && <option value="__umum">Umum (tanpa customer)</option>}
              {opsiPihak.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={muat} disabled={!pihakId}>
            Tampilkan
          </Button>
        </div>

        {pilihPihak && (
          <>
            {tagihan.length === 0 ? (
              <div className="rounded-xl bg-bg p-6 text-center text-sm text-ink-soft">
                Tidak ada tagihan belum lunas.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-line">
                  <ul className="divide-y divide-line">
                    {tagihan.map((t) => {
                      const dipilih = terpilih.has(t.id);
                      const dialokasi = alokasiMap.get(t.id) ?? 0;
                      return (
                        <li key={t.id} className="flex items-center gap-3 p-3">
                          <input
                            type="checkbox"
                            checked={dipilih}
                            onChange={() => toggle(t.id)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="num truncate text-sm font-medium">{t.noNota}</div>
                            <div className="text-xs text-ink-soft">
                              {formatTanggal(t.tanggal)} · sisa{" "}
                              <span className="num">{formatRupiah(t.sisa)}</span>
                            </div>
                          </div>
                          {dipilih && dialokasi > 0 && (
                            <span
                              className={cn(
                                "num shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                                dialokasi >= t.sisa
                                  ? "bg-accent-soft text-accent"
                                  : "bg-warn/10 text-warn",
                              )}
                            >
                              {dialokasi >= t.sisa ? "Lunas" : `−${formatRupiah(dialokasi)}`}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <Label htmlFor="sbayar">Jumlah Bayar</Label>
                    <MoneyInput id="sbayar" value={bayar} onChange={setBayar} />
                  </Field>
                  <Field>
                    <Label htmlFor="stgl">Tanggal Pembayaran</Label>
                    <Input
                      id="stgl"
                      type="date"
                      value={tanggal}
                      max={todayInput()}
                      onChange={(e) => setTanggal(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setBayar(sisaTerpilih)}>
                    Lunasi semua terpilih ({formatRupiah(sisaTerpilih)})
                  </Button>
                </div>

                <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
                  <span className="text-ink-soft">Akan dialokasikan</span>
                  <span className="num font-bold">
                    {formatRupiah(alokasi.reduce((s, a) => s + a.bayar, 0))}
                  </span>
                </div>
              </>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          {err && <span className="mr-auto self-center text-sm text-danger">{err}</span>}
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          {pilihPihak && tagihan.length > 0 && (
            <Button onClick={simpan}>Catat Pelunasan</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
