import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createItem } from "./items";
import { formatRupiah } from "@/lib/money";

const FIELD_LABEL: Record<string, string> = {
  nama: "Nama Barang",
  merk: "Merk",
  kategori: "Kategori",
  barcode: "Barcode",
  satuan_dasar: "Satuan Dasar",
  stok: "Stok Awal",
  stok_min: "Stok Minimum",
  harga_beli: "Harga Beli",
  harga_jual: "Harga Jual",
};

const REQUIRED_FIELDS = ["nama", "satuan_dasar"];

interface RowData {
  row: number;
  parsed: Record<string, string | number>;
  errors: string[];
}

const COL_MAP: Record<string, string> = {
  nama: "nama",
  "nama barang": "nama",
  merk: "merk",
  merek: "merk",
  kategori: "kategori",
  kategory: "kategori",
  barcode: "barcode",
  deskripsi: "deskripsi",
  satuan: "satuan_dasar",
  "satuan dasar": "satuan_dasar",
  stok: "stok",
  "stok awal": "stok",
  "stok minimum": "stok_min",
  "harga beli": "harga_beli",
  "harga jual": "harga_jual",
};

function autoMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    map[i] = COL_MAP[h] ?? "";
  }
  return map;
}

function parseNumber(v: unknown): number {
  if (typeof v === "number") return Math.round(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

function parseRows(sheet: XLSX.WorkSheet, mapping: Record<number, string>): RowData[] {
  const rows: RowData[] = [];
  const raw: Record<string, string | number>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const parsed: Record<string, string | number> = {};
    const errors: string[] = [];
    for (const key of Object.keys(FIELD_LABEL)) {
      const colIdx = Object.entries(mapping).find(([, v]) => v === key)?.[0];
      if (colIdx !== undefined) {
        const rawVal = (r as any)[Object.keys(r)[Number(colIdx)]];
        if (key === "stok" || key === "stok_min" || key === "harga_beli" || key === "harga_jual") {
          parsed[key] = parseNumber(rawVal);
        } else {
          parsed[key] = String(rawVal ?? "").trim();
        }
      } else {
        if (key === "stok") parsed[key] = 0;
        else if (key === "stok_min") parsed[key] = 0;
        else if (key === "harga_beli") parsed[key] = 0;
        else if (key === "harga_jual") parsed[key] = 0;
        else if (key === "barcode") parsed[key] = "";
        else if (key === "merk") parsed[key] = "";
        else if (key === "kategori") parsed[key] = "";
        else parsed[key] = "";
      }
    }
    for (const f of REQUIRED_FIELDS) {
      if (!parsed[f]) errors.push(`${FIELD_LABEL[f]} harus diisi`);
    }
    if (errors.length > 0) parsed._hasError = 1;
    rows.push({ row: i + 2, parsed, errors });
  }
  return rows;
}

export function ImportPage() {
  const [rows, setRows] = useState<RowData[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);
  const [fail, setFail] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadFile(file: File) {
    setRows(null);
    setDone(0);
    setFail(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const h: string[] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];
      setHeaders(h);
      const m = autoMap(h);
      setMapping(m);
      setRows(parseRows(sheet, m));
    };
    reader.readAsArrayBuffer(file);
  }

  function updateMapping(colIdx: number, field: string) {
    const m = { ...mapping, [colIdx]: field };
    setMapping(m);
    if (rows) {
      const wb = XLSX.read(fileRef.current?.files?.[0], { type: "array" });
      setRows(parseRows(wb.Sheets[wb.SheetNames[0]], m));
    }
  }

  const validRows = rows?.filter((r) => r.errors.length === 0) ?? [];
  const hasErrors = rows?.some((r) => r.errors.length > 0) ?? false;

  async function doImport() {
    setImporting(true);
    setDone(0);
    setFail(0);
    let ok = 0;
    let nok = 0;
    for (const r of validRows) {
      try {
        await createItem({
          nama: r.parsed.nama as string,
          merk: String(r.parsed.merk ?? ""),
          kategori: String(r.parsed.kategori ?? ""),
          barcode: String(r.parsed.barcode ?? ""),
          deskripsi: "",
          satuan_dasar: r.parsed.satuan_dasar as string,
          stok: (r.parsed.stok as number) ?? 0,
          stok_min: (r.parsed.stok_min as number) ?? 0,
          harga_beli: (r.parsed.harga_beli as number) ?? 0,
          harga_jual: (r.parsed.harga_jual as number) ?? 0,
          margin_persen: 0,
          basis_harga: "margin",
          harga_grosir: [],
          favorit: 0,
          units: [],
        });
        ok++;
      } catch {
        nok++;
      }
      setDone(ok);
      setFail(nok);
    }
    setImporting(false);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">Import Produk dari Excel</h1>

      <Card className="mb-6 p-5">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line-strong p-8 text-center hover:bg-accent-soft/30">
          <FileSpreadsheet size={40} className="text-accent" />
          <div>
            <p className="font-semibold">Klik untuk pilih file Excel</p>
            <p className="mt-1 text-sm text-ink-soft">.xlsx, .xls, atau .csv</p>
          </div>
          <Button variant="primary" size="sm" type="button">
            <Upload size={16} /> Pilih File
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          />
        </label>
      </Card>

      {headers.length > 0 && (
        <Card className="mb-6 overflow-x-auto p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-soft">
            Mapping Kolom
          </h2>
          <div className="flex flex-wrap gap-3">
            {headers.map((h, i) => (
              <div key={i} className="min-w-[160px]">
                <label className="mb-1 block text-xs text-ink-soft">{h}</label>
                <select
                  value={mapping[i] ?? ""}
                  onChange={(e) => updateMapping(i, e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="">— Abaikan —</option>
                  {Object.entries(FIELD_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows && (
        <Card className="mb-6 overflow-x-auto">
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-soft">
                Pratinjau ({rows.length} baris, {validRows.length} valid
                {hasErrors && `, ${rows.length - validRows.length} error`})
              </h2>
              <Button
                variant="primary"
                size="sm"
                disabled={importing || validRows.length === 0}
                onClick={() => void doImport()}
              >
                {importing ? (
                  <><Loader2 size={16} className="animate-spin" /> Mengimpor…</>
                ) : (
                  <><Upload size={16} /> Import {validRows.length} Produk</>
                )}
              </Button>
            </div>
            {(done > 0 || fail > 0) && (
              <div className="mb-3 flex gap-4 text-sm">
                <span className="text-good"><Check size={14} className="inline" /> {done} sukses</span>
                {fail > 0 && <span className="text-danger"><AlertCircle size={14} className="inline" /> {fail} gagal</span>}
              </div>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-bg text-left text-xs font-semibold uppercase text-ink-soft">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">Merk</th>
                <th className="px-4 py-2">Kategori</th>
                <th className="px-4 py-2">Barcode</th>
                <th className="px-4 py-2">Satuan</th>
                <th className="px-4 py-2 text-right">Stok</th>
                <th className="px-4 py-2 text-right">Harga Beli</th>
                <th className="px-4 py-2 text-right">Harga Jual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.row}
                  className={`border-b border-line ${r.errors.length > 0 ? "bg-danger/5" : ""}`}
                >
                  <td className="px-4 py-2 text-ink-soft">{r.row}</td>
                  <td className="px-4 py-2 font-medium">
                    {r.parsed.nama || <span className="text-ink-soft">—</span>}
                    {r.errors.length > 0 && (
                      <span className="ml-2 text-xs text-danger" title={r.errors.join("; ")}>
                        <AlertCircle size={12} className="inline" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{String(r.parsed.merk || "") || "—"}</td>
                  <td className="px-4 py-2">{String(r.parsed.kategori || "") || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{String(r.parsed.barcode || "") || "—"}</td>
                  <td className="px-4 py-2">{String(r.parsed.satuan_dasar || "") || "—"}</td>
                  <td className="px-4 py-2 text-right">{r.parsed.stok ?? 0}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah((r.parsed.harga_beli as number) ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah((r.parsed.harga_jual as number) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
