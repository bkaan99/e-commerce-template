import { describe, expect, it } from "vitest";
import {
  formatTierText,
  groupInputSchema,
  groupPriceSchema,
  parseTierText,
  tierListSchema,
} from "./price-list.schema";

describe("tier metni", () => {
  it("adet:fiyat çiftlerini ayrıştırır", () => {
    expect(parseTierText("10:90, 50:75.5\n100:60")).toEqual([
      { minQuantity: 10, price: "90" },
      { minQuantity: 50, price: "75.5" },
      { minQuantity: 100, price: "60" },
    ]);
  });

  it("boş metinde boş liste döner", () => {
    expect(parseTierText("  ")).toEqual([]);
  });

  it("kademeleri artan sırayla biçimlendirir", () => {
    expect(
      formatTierText([
        { minQuantity: 50, price: "75.00" },
        { minQuantity: 10, price: "90.00" },
      ]),
    ).toBe("10:90, 50:75");
  });
});

describe("tierListSchema", () => {
  it("geçerli kademeleri kabul eder", () => {
    const result = tierListSchema.parse([
      { minQuantity: "10", price: "90,50" },
      { minQuantity: 50, price: 75 },
    ]);
    expect(result).toEqual([
      { minQuantity: 10, price: 90.5 },
      { minQuantity: 50, price: 75 },
    ]);
  });

  it("aynı adedi, 2'den küçük adedi ve sıfır fiyatı reddeder", () => {
    expect(
      tierListSchema.safeParse([
        { minQuantity: 10, price: 5 },
        { minQuantity: 10, price: 4 },
      ]).success,
    ).toBe(false);
    expect(
      tierListSchema.safeParse([{ minQuantity: 1, price: 5 }]).success,
    ).toBe(false);
    expect(
      tierListSchema.safeParse([{ minQuantity: 5, price: 0 }]).success,
    ).toBe(false);
  });
});

describe("groupInputSchema / groupPriceSchema", () => {
  it("iskonto aralığını denetler", () => {
    expect(
      groupInputSchema.parse({ name: "Bayi", discountPercent: "12,5" })
        .discountPercent,
    ).toBe(12.5);
    expect(
      groupInputSchema.parse({ name: "Bayi", discountPercent: "" })
        .discountPercent,
    ).toBeNull();
    expect(
      groupInputSchema.safeParse({ name: "Bayi", discountPercent: 120 })
        .success,
    ).toBe(false);
  });

  it("grup fiyatı boşsa (null) kaldırmayı ifade eder", () => {
    expect(groupPriceSchema.parse(null)).toBeNull();
    expect(groupPriceSchema.parse("49,90")).toBe(49.9);
    expect(groupPriceSchema.safeParse(-1).success).toBe(false);
  });
});
