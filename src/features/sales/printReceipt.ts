import { formatNumber } from "@/lib/money";
import { formatTanggalJam } from "@/lib/format";
import type { ReceiptData, ReceiptToko } from "./receipt";

const ESC = (s: string) =>
  s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );

const rp = (n: number) => `Rp ${formatNumber(n)}`;

function itemRows(items: ReceiptData["items"], _trx: ReceiptData["trx"]) {
  return items
    .map((it) => {
      const diskon =
        it.diskon_persen > 0
          ? `<div class="sub">disk ${it.diskon_persen}%</div>`
          : it.diskon_nominal > 0
            ? `<div class="sub">disk ${rp(it.diskon_nominal)}</div>`
            : "";
      return `
        <div class="row item">
          <div class="nama">${ESC(it.nama)}</div>
        </div>
        <div class="row">
          <div class="qty">${formatNumber(it.qty)} ${ESC(it.satuan)} × ${rp(it.harga)}</div>
          <div class="amt">${rp(it.subtotal)}</div>
        </div>
        ${diskon}`;
    })
    .join("");
}

function biayaRows(biaya: ReceiptData["trx"]["biaya"]) {
  return (biaya ?? [])
    .map(
      (b) => `
        <div class="row">
          <div class="qty">${ESC(b.label)}</div>
          <div class="amt">${rp(b.nominal)}</div>
        </div>`,
    )
    .join("");
}

function headerHtml(toko: ReceiptToko) {
  const alamat = toko.tampilAlamat && toko.alamat
    ? `<div class="ctr sub">${ESC(toko.alamat)}</div>`
    : "";
  const kontak = toko.kontak ? `<div class="ctr sub">${ESC(toko.kontak)}</div>` : "";
  return `
    <div class="ctr bold big">${ESC(toko.nama)}</div>
    ${alamat}
    ${kontak}`;
}

function footerHtml(toko: ReceiptToko) {
  return `<div class="ctr sub">${ESC(toko.footer)}</div>`;
}

/**
 * Render token template sederhana.
 * Token: {nama_toko}, {alamat}, {kontak}, {no_nota}, {tanggal}, {tipe},
 * {items}, {biaya}, {subtotal}, {total}, {bayar}, {kembali}, {sisa}, {footer}, {catatan}
 */
function renderTemplate(
  template: string,
  data: ReceiptData,
  renderedItems: string,
  renderedBiaya: string,
): string {
  const { trx, toko } = data;
  const sisa = trx.total - trx.dibayar;
  return template
    .replace(/\{nama_toko\}/g, ESC(toko.nama))
    .replace(/\{alamat\}/g, ESC(toko.alamat || ""))
    .replace(/\{kontak\}/g, ESC(toko.kontak || ""))
    .replace(/\{no_nota\}/g, ESC(trx.no_nota || trx.id.slice(0, 8).toUpperCase()))
    .replace(/\{tanggal\}/g, formatTanggalJam(trx.tanggal))
    .replace(/\{tipe\}/g, trx.tipe === "tunai" ? "TUNAI" : "PIUTANG")
    .replace(/\{items\}/g, renderedItems)
    .replace(/\{biaya\}/g, renderedBiaya)
    .replace(/\{subtotal\}/g, rp(trx.subtotal))
    .replace(/\{total\}/g, rp(trx.total))
    .replace(/\{bayar\}/g, rp(trx.dibayar))
    .replace(/\{kembali\}/g, rp(trx.kembalian))
    .replace(/\{sisa\}/g, sisa > 0 ? rp(sisa) : "")
    .replace(/\{footer\}/g, ESC(toko.footer || "Terima kasih"))
    .replace(/\{catatan\}/g, ESC(trx.catatan || ""));
}

export function receiptHtml(data: ReceiptData): string {
  const { trx, items, toko } = data;
  const lebar = toko.ukuranPrinter === "80mm" ? "80mm" : "58mm";

  const renderedItems = itemRows(items, trx);
  const renderedBiaya = biayaRows(trx.biaya);
  const sisa = trx.total - trx.dibayar;

  const bodyContent = toko.strukTemplate
    ? renderTemplate(toko.strukTemplate, data, renderedItems, renderedBiaya)
    : defaultBody(data, renderedItems, renderedBiaya, sisa);

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Nota ${ESC(trx.id.slice(0, 8))}</title>
<style>
  @page { size: ${lebar} auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: ${lebar}; margin: 0; padding: 4mm 3mm;
    font-family: "Courier New", monospace; font-size: 11px; color: #000;
    line-height: 1.35;
  }
  .ctr { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 14px; }
  .sub { font-size: 10px; color: #222; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .row .amt { white-space: nowrap; }
  .item .nama { font-weight: 600; }
  .tot { font-size: 13px; font-weight: 700; }
</style></head><body>
  ${bodyContent}
</body></html>`;
}

function defaultBody(
  data: ReceiptData,
  renderedItems: string,
  renderedBiaya: string,
  sisa: number,
): string {
  const { trx, toko } = data;
  return `
    ${headerHtml(toko)}
    <div class="sep"></div>
    <div class="row sub">
      <div>${formatTanggalJam(trx.tanggal)}</div>
      <div>${trx.tipe === "tunai" ? "TUNAI" : "PIUTANG"}</div>
    </div>
    <div class="sub">No: ${ESC(trx.no_nota || trx.id.slice(0, 8).toUpperCase())}</div>
    <div class="sep"></div>
    ${renderedItems || '<div class="sub ctr">(tanpa barang)</div>'}
    ${renderedBiaya ? `<div class="sep"></div>${renderedBiaya}` : ""}
    <div class="sep"></div>
    <div class="row"><div>Subtotal</div><div>${rp(trx.subtotal)}</div></div>
    ${
      (trx.biaya ?? []).length
        ? `<div class="row"><div>Biaya</div><div>${rp(
            trx.biaya.reduce((s, b) => s + b.nominal, 0),
          )}</div></div>`
        : ""
    }
    <div class="row tot"><div>TOTAL</div><div>${rp(trx.total)}</div></div>
    <div class="row"><div>Bayar</div><div>${rp(trx.dibayar)}</div></div>
    ${
      sisa > 0
        ? `<div class="row bold"><div>SISA PIUTANG</div><div>${rp(sisa)}</div></div>`
        : `<div class="row"><div>Kembali</div><div>${rp(trx.kembalian)}</div></div>`
    }
    ${trx.catatan ? `<div class="sep"></div><div class="sub">Catatan: ${ESC(trx.catatan)}</div>` : ""}
    <div class="sep"></div>
    ${footerHtml(toko)}`;
}

export function printReceipt(data: ReceiptData): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 1000);
      resolve();
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      resolve();
      return;
    }
    doc.open();
    doc.write(receiptHtml(data));
    doc.close();

    const win = iframe.contentWindow!;
    win.onafterprint = cleanup;
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(cleanup, 500);
    }, 150);
  });
}

export function receiptWhatsAppUrl(data: ReceiptData): string {
  const { trx, toko } = data;
  const sisa = trx.total - trx.dibayar;
  const lines = [
    `*${toko.nama}*`,
    toko.alamat || "",
    `No: ${trx.no_nota || ""}`,
    `${formatTanggalJam(trx.tanggal)}`,
    "----------------",
  ];
  for (const item of data.items) {
    const diskon = item.diskon_persen
      ? ` (disk ${item.diskon_persen}%)`
      : item.diskon_nominal
        ? ` (disk ${rp(item.diskon_nominal)})`
        : "";
    lines.push(`${item.nama}`);
    lines.push(`  ${formatNumber(item.qty)} ${item.satuan} × ${rp(item.harga)}${diskon} = ${rp(item.subtotal)}`);
  }
  lines.push("----------------");
  lines.push(`Total: ${rp(trx.total)}`);
  lines.push(`Bayar: ${rp(trx.dibayar)}`);
  if (sisa > 0) lines.push(`Sisa: ${rp(sisa)}`);
  else lines.push(`Kembali: ${rp(trx.kembalian)}`);
  if (trx.catatan) lines.push(`Catatan: ${trx.catatan}`);
  lines.push(`_${toko.footer || "Terima kasih"}_`);

  return `https://wa.me/?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
}
