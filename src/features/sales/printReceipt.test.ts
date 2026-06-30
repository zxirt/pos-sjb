import { describe, it, expect } from "vitest";
import { receiptHtml } from "./printReceipt";
import type { ReceiptData } from "./receipt";
import type { Transaction, TransactionItem } from "@/db/types";

function buildData(): ReceiptData {
  const trx = {
    id: "abcd1234-ef56",
    tipe: "tunai",
    tanggal: "2026-06-28T10:30:00.000Z",
    subtotal: 90000,
    diskon_nominal: 0,
    diskon_persen: 0,
    biaya: [{ label: "Ongkir", nominal: 25000 }],
    total: 115000,
    dibayar: 150000,
    kembalian: 35000,
  } as unknown as Transaction;

  const items = [
    {
      nama: "Semen Merdeka",
      satuan: "ZAK",
      qty: 2,
      harga: 45000,
      diskon_nominal: 0,
      diskon_persen: 0,
      subtotal: 90000,
    },
  ] as unknown as TransactionItem[];

  return {
    trx,
    items,
    toko: {
      nama: "TOKO SJB",
      alamat: "Jl. Merdeka 1",
      kontak: "0812",
      footer: "Terima kasih",
      tampilAlamat: true,
      ukuranPrinter: "58mm",
    },
  };
}

describe("receiptHtml", () => {
  it("memuat header toko, item, biaya, dan total", () => {
    const html = receiptHtml(buildData());
    expect(html).toContain("TOKO SJB");
    expect(html).toContain("Jl. Merdeka 1");
    expect(html).toContain("Semen Merdeka");
    expect(html).toContain("Ongkir");
    expect(html).toContain("Rp 115.000"); // total
    expect(html).toContain("Rp 150.000"); // dibayar
    expect(html).toContain("Rp 35.000"); // kembalian
    expect(html).toContain("Terima kasih");
  });

  it("memakai lebar 80mm bila printer 80mm", () => {
    const d = buildData();
    d.toko.ukuranPrinter = "80mm";
    expect(receiptHtml(d)).toContain("size: 80mm auto");
  });

  it("menyembunyikan alamat bila tampilAlamat false", () => {
    const d = buildData();
    d.toko.tampilAlamat = false;
    expect(receiptHtml(d)).not.toContain("Jl. Merdeka 1");
  });

  it("escape karakter HTML pada nama (mencegah injeksi)", () => {
    const d = buildData();
    d.items[0].nama = "Besi <b>tebal</b>";
    const html = receiptHtml(d);
    expect(html).toContain("Besi &lt;b&gt;tebal&lt;/b&gt;");
    expect(html).not.toContain("Besi <b>tebal</b>");
  });
});
