import { describe, it, expect } from "vitest";
import {
  totalDibayar,
  hitungSisa,
  hitungStatus,
  terlambat,
} from "./payments";

describe("totalDibayar", () => {
  it("menjumlahkan pembayaran & mengabaikan nilai negatif", () => {
    expect(totalDibayar([])).toBe(0);
    expect(totalDibayar([30000, 20000])).toBe(50000);
    expect(totalDibayar([30000, -5000])).toBe(30000);
  });
});

describe("hitungSisa", () => {
  it("sisa = jumlah − total dibayar", () => {
    expect(hitungSisa(100000, [])).toBe(100000);
    expect(hitungSisa(100000, [40000])).toBe(60000);
  });
  it("tak pernah negatif walau kelebihan bayar", () => {
    expect(hitungSisa(100000, [120000])).toBe(0);
  });
});

describe("hitungStatus", () => {
  it("belum bila tak ada pembayaran", () => {
    expect(hitungStatus(100000, [])).toBe("belum");
  });
  it("sebagian bila sudah bayar tapi belum lunas", () => {
    expect(hitungStatus(100000, [40000])).toBe("sebagian");
  });
  it("lunas bila dibayar memenuhi/melebihi jumlah", () => {
    expect(hitungStatus(100000, [100000])).toBe("lunas");
    expect(hitungStatus(100000, [60000, 50000])).toBe("lunas");
  });
});

describe("terlambat", () => {
  const now = new Date("2026-06-28T00:00:00.000Z");
  it("false bila tak ada jatuh tempo", () => {
    expect(terlambat(null, "belum", now)).toBe(false);
  });
  it("false bila sudah lunas", () => {
    expect(terlambat("2026-01-01", "lunas", now)).toBe(false);
  });
  it("true bila jatuh tempo lewat & belum lunas", () => {
    expect(terlambat("2026-06-01", "sebagian", now)).toBe(true);
  });
  it("false bila jatuh tempo masih di depan", () => {
    expect(terlambat("2026-07-01", "belum", now)).toBe(false);
  });
});
