import type { Transaction, TransactionItem, Settings } from "@/db/types";

/**
 * Data nota (struk) — snapshot lengkap sebuah transaksi untuk dicetak.
 *
 * Ini adalah SUMBER KEBENARAN bentuk nota. Fase 3 mencetaknya apa adanya;
 * Fase 7 akan menata ulang tampilan (template token `struk_template`, thermal,
 * logo) tetapi tetap memakai data yang sama dari sini.
 */
export interface ReceiptData {
  trx: Transaction;
  items: TransactionItem[];
  /** Snapshot pengaturan toko saat transaksi (header/footer/ukuran printer). */
  toko: ReceiptToko;
}

export interface ReceiptToko {
  nama: string;
  alamat: string;
  kontak: string;
  footer: string;
  tampilAlamat: boolean;
  ukuranPrinter: "58mm" | "80mm";
}

/** Ambil info toko untuk nota dari Settings. */
export function tokoFromSettings(s: Settings): ReceiptToko {
  return {
    nama: s.nama_toko || "TOKO",
    alamat: s.alamat_toko,
    kontak: s.kontak_toko,
    footer: s.struk_footer || "Terima kasih",
    tampilAlamat: s.struk_tampil_alamat === 1,
    ukuranPrinter: s.ukuran_printer,
  };
}
