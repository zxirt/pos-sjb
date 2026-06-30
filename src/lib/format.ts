import { format } from "date-fns";
import { id } from "date-fns/locale";

/** Format tanggal Indonesia: "28 Jun 2026". */
export function formatTanggal(d: Date | string | number): string {
  const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  return format(date, "d MMM yyyy", { locale: id });
}

/** Format tanggal + jam: "28 Jun 2026, 14:30". */
export function formatTanggalJam(d: Date | string | number): string {
  const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  return format(date, "d MMM yyyy, HH:mm", { locale: id });
}

/** ISO timestamp untuk kolom updated_at/created_at (klien). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Nilai default untuk <input type="date"> (YYYY-MM-DD, zona waktu lokal). */
export function todayInput(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

/** Konversi nilai <input type="date"> (YYYY-MM-DD) → ISO awal hari lokal. */
export function dateInputToIso(s: string): string | null {
  if (!s) return null;
  return new Date(s + "T00:00:00").toISOString();
}
