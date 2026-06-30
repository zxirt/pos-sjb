/**
 * UUID dibuat di klien agar insert offline tidak pernah bentrok antar perangkat.
 * crypto.randomUUID tersedia di semua browser modern + konteks aman (https/localhost).
 */
export function newId(): string {
  return crypto.randomUUID();
}
