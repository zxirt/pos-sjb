import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createItem, type ItemUnitFormData } from "./items";
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
  deskripsi: "Supplier / Catatan",
  satuan_2: "Satuan 2",
  konversi_2: "Konversi 2",
  barcode_2: "Barcode 2",
  harga_beli_2: "Harga Beli 2",
  harga_jual_2: "Harga Jual 2",
  satuan_3: "Satuan 3",
  konversi_3: "Konversi 3",
  barcode_3: "Barcode 3",
  harga_beli_3: "Harga Beli 3",
  harga_jual_3: "Harga Jual 3",
};

const REQUIRED_FIELDS = ["nama", "satuan_dasar"];

interface RowData {
  row: number;
  parsed: Record<string, string | number>;
  errors: string[];
  unit2: ItemUnitFormData | null;
  unit3: ItemUnitFormData | null;
}

const COL_MAP: Record<string, string> = {
  nama: "nama", "nama barang": "nama",
  merk: "merk", merek: "merk",
  kategori: "kategori", kategory: "kategori",
  barcode: "barcode",
  deskripsi: "deskripsi", catatan: "deskripsi", supplier: "deskripsi",
  satuan: "satuan_dasar", "satuan dasar": "satuan_dasar",
  stok: "stok", "stok awal": "stok",
  "stok minimum": "stok_min",
  "harga beli": "harga_beli", "harga jual": "harga_jual",
  "satuan 2": "satuan_2", satuan2: "satuan_2",
  "konversi 2": "konversi_2", konversi2: "konversi_2",
  "barcode 2": "barcode_2", barcode2: "barcode_2",
  "harga beli 2": "harga_beli_2", "harga jual 2": "harga_jual_2",
  "satuan 3": "satuan_3", satuan3: "satuan_3",
  "konversi 3": "konversi_3", konversi3: "konversi_3",
  "barcode 3": "barcode_3", barcode3: "barcode_3",
  "harga beli 3": "harga_beli_3", "harga jual 3": "harga_jual_3",
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

function parseConv(v: unknown): number {
  if (typeof v === "number") return Math.abs(v) || 1;
  if (typeof v === "string") {
    const n = parseNumber(v);
    return Math.max(1, n);
  }
  return 1;
}

function getColVal(raw: Record<string, string | number>, keys: string[], colIdx: string | undefined): string | number {
  if (colIdx !== undefined) return (raw as any)[keys[Number(colIdx)]] ?? "";
  return "";
}

function parseRows(sheet: XLSX.WorkSheet, mapping: Record<number, string>): RowData[] {
  const rows: RowData[] = [];
  const raw: Record<string, string | number>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const keys = Object.keys(r);
    const parsed: Record<string, string | number> = {};
    const errors: string[] = [];
    const numKeys = new Set(["stok", "stok_min", "harga_beli", "harga_jual", "konversi_2", "harga_beli_2", "harga_jual_2", "konversi_3", "harga_beli_3", "harga_jual_3"]);
    for (const key of Object.keys(FIELD_LABEL)) {
      const entry = Object.entries(mapping).find(([, v]) => v === key);
      if (entry) {
        const rawVal = getColVal(r, keys, entry[0]);
        parsed[key] = numKeys.has(key) ? parseNumber(rawVal) : String(rawVal ?? "").trim();
      } else {
        if (numKeys.has(key)) parsed[key] = 0;
        else if (key === "satuan_2" || key === "satuan_3") parsed[key] = "";
        else if (key === "barcode_2" || key === "barcode_3") parsed[key] = "";
        else if (key === "deskripsi") parsed[key] = "";
        else if (key === "barcode") parsed[key] = "";
        else if (key === "merk") parsed[key] = "";
        else if (key === "kategori") parsed[key] = "";
        else parsed[key] = "";
      }
    }
    for (const f of REQUIRED_FIELDS) {
      if (!parsed[f]) errors.push(`${FIELD_LABEL[f]} harus diisi`);
    }
    const unit2: ItemUnitFormData | null = parsed.satuan_2 ? {
      satuan: parsed.satuan_2 as string,
      konversi: parseConv(parsed.konversi_2 ?? 1),
      barcode: String(parsed.barcode_2 ?? ""),
      harga_beli: (parsed.harga_beli_2 as number) ?? 0,
      harga_jual: (parsed.harga_jual_2 as number) ?? 0,
      margin_persen: 0,
    } : null;
    const unit3: ItemUnitFormData | null = parsed.satuan_3 ? {
      satuan: parsed.satuan_3 as string,
      konversi: parseConv(parsed.konversi_3 ?? 1),
      barcode: String(parsed.barcode_3 ?? ""),
      harga_beli: (parsed.harga_beli_3 as number) ?? 0,
      harga_jual: (parsed.harga_jual_3 as number) ?? 0,
      margin_persen: 0,
    } : null;
    if (errors.length > 0) parsed._hasError = 1;
    rows.push({ row: i + 2, parsed, errors, unit2, unit3 });
  }
  return rows;
}

function downloadTemplate() {
  const headers = [
    "Nama Barang", "Merk", "Kategori", "Barcode",
    "Satuan Dasar", "Stok Awal", "Stok Minimum", "Harga Beli", "Harga Jual",
    "Supplier / Catatan",
    "Satuan 2", "Konversi 2", "Barcode 2", "Harga Beli 2", "Harga Jual 2",
    "Satuan 3", "Konversi 3", "Barcode 3", "Harga Beli 3", "Harga Jual 3",
  ];
  const example = [
    "Semen Padang 50kg", "Padang", "Bahan Bangunan", "8991234567890",
    "ZAK", 50, 10, 52000, 58000,
    "PT Semen Padang",
    "Karung", 40, "", 51000, 57000,
    "", "", "", "", "",
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const colW = headers.map((h) => ({ wch: Math.max(h.length * 2, 14) }));
  ws["!cols"] = colW;
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "template-import-produk.xlsx");
}

function fmt(v: unknown): string {
  if (typeof v === "number") return formatRupiah(v);
  return String(v || "") || "—";
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
      const f = fileRef.current?.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        setRows(parseRows(wb.Sheets[wb.SheetNames[0]], m));
      };
      reader.readAsArrayBuffer(f);
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
        const units: ItemUnitFormData[] = [];
        if (r.unit2) units.push(r.unit2);
        if (r.unit3) units.push(r.unit3);
        await createItem({
          nama: r.parsed.nama as string,
          merk: String(r.parsed.merk ?? ""),
          kategori: String(r.parsed.kategori ?? ""),
          barcode: String(r.parsed.barcode ?? ""),
          deskripsi: String(r.parsed.deskripsi ?? ""),
          satuan_dasar: r.parsed.satuan_dasar as string,
          stok: (r.parsed.stok as number) ?? 0,
          stok_min: (r.parsed.stok_min as number) ?? 0,
          harga_beli: (r.parsed.harga_beli as number) ?? 0,
          harga_jual: (r.parsed.harga_jual as number) ?? 0,
          margin_persen: 0,
          basis_harga: "margin",
          harga_grosir: [],
          favorit: 0,
          units,
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
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold">Import Produk dari Excel</h1>

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line-strong p-8 text-center hover:bg-accent-soft/30 flex-1">
            <FileSpreadsheet size={40} className="text-accent" />
            <div>
              <p className="font-semibold">Klik untuk pilih file Excel</p>
              <p className="mt-1 text-sm text-ink-soft">.xlsx, .xls, atau .csv</p>
            </div>
            <Button variant="primary" size="sm" type="button" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Pilih File
            </Button>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          />
          <div className="flex flex-col items-center justify-center gap-2 pt-4">
            <FileSpreadsheet size={32} className="text-ink-soft" />
            <p className="text-center text-sm text-ink-soft">Unduh template<br />untuk diisi</p>
            <Button variant="ghost" size="sm" type="button" onClick={downloadTemplate}>
              <Download size={16} /> Template
            </Button>
          </div>
        </div>
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
                    <option key={k} value={k}>{v}</option>
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
                <th className="px-4 py-2">Satuan 2</th>
                <th className="px-4 py-2 text-right">Harga Jual 2</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row} className={`border-b border-line ${r.errors.length > 0 ? "bg-danger/5" : ""}`}>
                  <td className="px-4 py-2 text-ink-soft">{r.row}</td>
                  <td className="px-4 py-2 font-medium">
                    {r.parsed.nama || <span className="text-ink-soft">—</span>}
                    {r.errors.length > 0 && (
                      <span className="ml-2 text-xs text-danger" title={r.errors.join("; ")}>
                        <AlertCircle size={12} className="inline" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{fmt(r.parsed.merk)}</td>
                  <td className="px-4 py-2">{fmt(r.parsed.kategori)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{fmt(r.parsed.barcode)}</td>
                  <td className="px-4 py-2">{String(r.parsed.satuan_dasar || "") || "—"}</td>
                  <td className="px-4 py-2 text-right">{r.parsed.stok ?? 0}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah((r.parsed.harga_beli as number) ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah((r.parsed.harga_jual as number) ?? 0)}</td>
                  <td className="px-4 py-2">{r.unit2?.satuan ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{r.unit2 ? formatRupiah(r.unit2.harga_jual) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
