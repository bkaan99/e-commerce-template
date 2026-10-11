import { describe, expect, it } from "vitest";
import { generateCombinations, productInputSchema } from "./product.schema";

const base = {
  name: "Tişört",
  status: "ACTIVE",
  categoryId: "cat1",
  taxRate: 20,
  options: [
    { name: "Renk", values: ["Siyah", "Beyaz"] },
    { name: "Beden", values: ["S", "M"] },
  ],
  variants: [
    {
      sku: "T-S-S",
      price: "299,90",
      stockQuantity: 5,
      optionValues: { Renk: "Siyah", Beden: "S" },
    },
    {
      sku: "T-B-M",
      price: "299.90",
      stockQuantity: "3",
      optionValues: { Renk: "Beyaz", Beden: "M" },
    },
  ],
};

describe("productInputSchema", () => {
  it("geçerli ürünü kabul eder ve tutarı normalleştirir", () => {
    const result = productInputSchema.parse(base);
    expect(result.variants[0]!.price).toBe("299.90");
    expect(result.variants[1]!.stockQuantity).toBe(3);
    expect(result.trackInventory).toBe(true);
    expect(result.brandId).toBeNull();
  });

  it("tekrar eden SKU'yu reddeder", () => {
    const result = productInputSchema.safeParse({
      ...base,
      variants: [base.variants[0], { ...base.variants[1], sku: "t-s-s" }],
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.message === "SKU tekrar ediyor"),
    ).toBe(true);
  });

  it("aynı seçenek kombinasyonunu iki varyantta reddeder", () => {
    const result = productInputSchema.safeParse({
      ...base,
      variants: [base.variants[0], { ...base.variants[0], sku: "BASKA" }],
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.message.includes("kombinasyonu")),
    ).toBe(true);
  });

  it("seçeneği eksik veya geçersiz varyantı reddeder", () => {
    const result = productInputSchema.safeParse({
      ...base,
      variants: [
        { ...base.variants[0], optionValues: { Renk: "Kırmızı", Beden: "S" } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("negatif stoğu ve geçersiz fiyatı reddeder", () => {
    expect(
      productInputSchema.safeParse({
        ...base,
        variants: [{ ...base.variants[0], stockQuantity: -1 }],
      }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({
        ...base,
        variants: [{ ...base.variants[0], price: "abc" }],
      }).success,
    ).toBe(false);
  });

  it("seçeneksiz tek varyantlı ürünü kabul eder", () => {
    const result = productInputSchema.safeParse({
      ...base,
      options: [],
      variants: [
        { sku: "TEK", price: "10", stockQuantity: 1, optionValues: {} },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("göreli veya http(s) olmayan görsel adresini reddeder", () => {
    expect(
      productInputSchema.safeParse({
        ...base,
        images: [{ url: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({
        ...base,
        images: [{ url: "/uploads/a.jpg" }, { url: "https://cdn.test/a.jpg" }],
      }).success,
    ).toBe(true);
  });
});

describe("generateCombinations", () => {
  it("kartezyen çarpımı üretir", () => {
    const combos = generateCombinations([
      { name: "Renk", values: ["Siyah", "Beyaz"] },
      { name: "Beden", values: ["S", "M", "L"] },
    ]);
    expect(combos).toHaveLength(6);
    expect(combos[0]).toEqual({ Renk: "Siyah", Beden: "S" });
  });

  it("seçenek yoksa tek boş kombinasyon döner", () => {
    expect(generateCombinations([])).toEqual([{}]);
  });
});
