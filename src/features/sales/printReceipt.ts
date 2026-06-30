import { formatNumber } from "@/lib/money";
import { formatTanggalJam } from "@/lib/format";
import type { ReceiptData } from "./receipt";

/**
 * Cetak nota via iframe tersembunyi + window.print(). Tanpa dependency
 * (jspdf/template editable ditunda ke Fase 7). Pengguna bisa pilih printer
 * mana pun atau "Simpan sebagai PDF" dari dialog cetak browser.
 *
 * Lebar kertas mengikuti ukuran printer di Settings (58mm / 80mm) lewat @page.
 */

const ESC = (s: string) =>
  s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );

const rp = (n: number) => `Rp ${formatNumber(n)}`;

/** Bangun HTML nota lengkap (dokumen mandiri untuk iframe cetak). */
export function receiptHtml(data: ReceiptData): string {
  const { trx, items, toko } = data;
  const lebar = toko.ukuranPrinter === "80mm" ? "80mm" : "58mm";

  const barisItem = items
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

  const barisBiaya = (trx.biaya ?? [])
    .map(
      (b) => `
        <div class="row">
          <div class="qty">${ESC(b.label)}</div>
          <div class="amt">${rp(b.nominal)}</div>
        </div>`,
    )
    .join("");

  const alamat =
    toko.tampilAlamat && toko.alamat
      ? `<div class="ctr sub">${ESC(toko.alamat)}</div>`
      : "";
  const kontak = toko.kontak ? `<div class="ctr sub">${ESC(toko.kontak)}</div>` : "";

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
  <div class="ctr bold big">${ESC(toko.nama)}</div>
  ${alamat}
  ${kontak}
  <div class="sep"></div>
  <div class="row sub">
    <div>${formatTanggalJam(trx.tanggal)}</div>
    <div>${trx.tipe === "tunai" ? "TUNAI" : "PIUTANG"}</div>
  </div>
  <div class="sub">No: ${ESC(trx.no_nota || trx.id.slice(0, 8).toUpperCase())}</div>
  <div class="sep"></div>
  ${barisItem || '<div class="sub ctr">(tanpa barang)</div>'}
  ${barisBiaya ? `<div class="sep"></div>${barisBiaya}` : ""}
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
    trx.total > trx.dibayar
      ? `<div class="row bold"><div>SISA PIUTANG</div><div>${rp(
          trx.total - trx.dibayar,
        )}</div></div>`
      : `<div class="row"><div>Kembali</div><div>${rp(trx.kembalian)}</div></div>`
  }
  ${trx.catatan ? `<div class="sep"></div><div class="sub">Catatan: ${ESC(trx.catatan)}</div>` : ""}
  <div class="sep"></div>
  <div class="ctr sub">${ESC(toko.footer)}</div>
</body></html>`;
}

/**
 * Cetak nota: suntik HTML ke iframe tersembunyi, panggil print, lalu bersihkan.
 * Mengembalikan Promise yang selesai setelah dialog cetak dibuka.
 */
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
      // Beri jeda agar dialog cetak sempat membaca dokumen sebelum dihapus.
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
    // Tunggu render lalu cetak.
    setTimeout(() => {
      win.focus();
      win.print();
      // Fallback bila onafterprint tak terpicu (sebagian browser).
      setTimeout(cleanup, 500);
    }, 150);
  });
}
