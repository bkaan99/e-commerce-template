import { describe, expect, it } from "vitest";
import {
  TURKEY_DISTRICTS,
  districtsOf,
  isDistrictOf,
} from "./turkey-districts";
import { TURKEY_PROVINCES } from "./turkey-provinces";

describe("TURKEY_DISTRICTS", () => {
  it("81 ilin tamamı için ilçe içerir", () => {
    for (const province of TURKEY_PROVINCES) {
      expect(districtsOf(province).length, province).toBeGreaterThan(0);
    }
    expect(Object.keys(TURKEY_DISTRICTS)).toHaveLength(81);
  });

  it("toplam ilçe sayısı 973'tür", () => {
    const total = Object.values(TURKEY_DISTRICTS).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    expect(total).toBe(973);
  });

  it("ilçeyi ile göre ve Türkçe büyük/küçük harf duyarsız doğrular", () => {
    expect(isDistrictOf("İstanbul", "Kadıköy")).toBe(true);
    expect(isDistrictOf("İstanbul", "kadıköy")).toBe(true);
    expect(isDistrictOf("Ankara", "Kadıköy")).toBe(false);
    expect(isDistrictOf("Bilinmeyen", "Merkez")).toBe(false);
  });
});
