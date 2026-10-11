import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  CartThresholdDiscountRule,
  CategoryDiscountRule,
  CouponRule,
  applyDiscountRules,
  createCampaignRule,
  discountAmount,
  type DiscountContext,
} from "./discounts";
import { ConfiguredShippingRateCalculator } from "./shipping";
import { calculateOrderTotals, extractTax } from "./totals";

const d = (value: string | number) => new Decimal(value);

describe("ConfiguredShippingRateCalculator", () => {
  const base = {
    freeShippingThreshold: 500,
    flatRate: 49.9,
    desiTariff: [] as { maxDesi: number; price: number }[],
    extraDesiPrice: 5,
    taxRate: 20,
  };

  it("limitin üzerinde ücretsizdir", () => {
    const calc = new ConfiguredShippingRateCalculator(base);
    expect(calc.calculate({ subtotal: d(500), totalDesi: 3 }).toFixed(2)).toBe(
      "0.00",
    );
  });

  it("tarife yoksa sabit ücreti uygular", () => {
    const calc = new ConfiguredShippingRateCalculator(base);
    expect(calc.calculate({ subtotal: d(100), totalDesi: 3 }).toFixed(2)).toBe(
      "49.90",
    );
  });

  it("desi tarifesinde uygun kademeyi seçer", () => {
    const calc = new ConfiguredShippingRateCalculator({
      ...base,
      desiTariff: [
        { maxDesi: 5, price: 40 },
        { maxDesi: 10, price: 60 },
      ],
    });
    expect(calc.calculate({ subtotal: d(100), totalDesi: 4 }).toFixed(2)).toBe(
      "40.00",
    );
    expect(calc.calculate({ subtotal: d(100), totalDesi: 7 }).toFixed(2)).toBe(
      "60.00",
    );
  });

  it("son kademeyi aşan desi için ek ücret ekler", () => {
    const calc = new ConfiguredShippingRateCalculator({
      ...base,
      desiTariff: [{ maxDesi: 10, price: 60 }],
    });
    // 12.4 desi -> 3 ek desi (yukarı yuvarlanır) * 5 = 15
    expect(
      calc.calculate({ subtotal: d(100), totalDesi: 12.4 }).toFixed(2),
    ).toBe("75.00");
  });

  it("desi bilinmiyorsa sabit ücrete düşer", () => {
    const calc = new ConfiguredShippingRateCalculator({
      ...base,
      desiTariff: [{ maxDesi: 5, price: 40 }],
    });
    expect(calc.calculate({ subtotal: d(100), totalDesi: 0 }).toFixed(2)).toBe(
      "49.90",
    );
  });
});

describe("discountAmount", () => {
  it("yüzde indirimi hesaplar ve yuvarlar", () => {
    expect(discountAmount("PERCENT", 15, d("99.99")).toFixed(2)).toBe("15.00");
  });

  it("sabit indirimi tabanı aşmayacak şekilde sınırlar", () => {
    expect(discountAmount("FIXED", 500, d(120)).toFixed(2)).toBe("120.00");
  });
});

describe("indirim kuralları", () => {
  const context: DiscountContext = {
    subtotal: d(1000),
    lines: [
      { variantId: "a", categoryId: "giyim", quantity: 2, unitPrice: d(200) },
      {
        variantId: "b",
        categoryId: "ayakkabi",
        quantity: 1,
        unitPrice: d(600),
      },
    ],
  };

  it("kupon, minimum sepet tutarının altında uygulanmaz", () => {
    const rule = new CouponRule({
      code: "INDIRIM",
      type: "PERCENT",
      value: 10,
      minSubtotal: 1500,
    });
    expect(rule.apply(context)).toBeNull();
  });

  it("kupon sepete yüzde indirim uygular", () => {
    const rule = new CouponRule({
      code: "INDIRIM",
      type: "PERCENT",
      value: 10,
      minSubtotal: null,
    });
    expect(rule.apply(context)?.amount.toFixed(2)).toBe("100.00");
  });

  it("kategori kampanyası yalnızca ilgili satırlara uygulanır", () => {
    const rule = new CategoryDiscountRule("Giyim %10", {
      categoryIds: ["giyim"],
      type: "PERCENT",
      value: 10,
    });
    expect(rule.apply(context)?.amount.toFixed(2)).toBe("40.00");
  });

  it("sepet eşiği kampanyası eşik altında uygulanmaz", () => {
    const rule = new CartThresholdDiscountRule("1500 üstü", {
      minSubtotal: 1500,
      type: "FIXED",
      value: 100,
    });
    expect(rule.apply(context)).toBeNull();
  });

  it("birden fazla kuralı toplar ama ara toplamı aşmaz", () => {
    const rules = [
      new CouponRule({
        code: "A",
        type: "FIXED",
        value: 700,
        minSubtotal: null,
      }),
      new CouponRule({
        code: "B",
        type: "FIXED",
        value: 700,
        minSubtotal: null,
      }),
    ];
    const { applied, total } = applyDiscountRules(rules, context);

    expect(total.toFixed(2)).toBe("1000.00");
    expect(applied.map((a) => a.amount.toFixed(2))).toEqual([
      "700.00",
      "300.00",
    ]);
  });

  it("kampanya kaydını tipine göre kurala çevirir", () => {
    expect(
      createCampaignRule({
        name: "K",
        ruleType: "category",
        config: { categoryIds: ["x"], type: "PERCENT", value: 5 },
      }),
    ).toBeInstanceOf(CategoryDiscountRule);
    expect(
      createCampaignRule({
        name: "E",
        ruleType: "cart-threshold",
        config: { minSubtotal: 100, type: "FIXED", value: 10 },
      }),
    ).toBeInstanceOf(CartThresholdDiscountRule);
  });

  it("bilinmeyen tip ve bozuk yapılandırmayı atlar", () => {
    expect(
      createCampaignRule({ name: "?", ruleType: "bilinmiyor", config: {} }),
    ).toBeNull();
    expect(
      createCampaignRule({ name: "?", ruleType: "category", config: { x: 1 } }),
    ).toBeNull();
  });
});

describe("calculateOrderTotals", () => {
  it("KDV dahil fiyattan KDV payını çıkarır", () => {
    expect(extractTax(d(120), 20).toFixed(2)).toBe("20.00");
    expect(extractTax(d(110), 10).toFixed(2)).toBe("10.00");
  });

  it("toplamları ve kargoyu hesaplar", () => {
    const totals = calculateOrderTotals({
      lines: [
        { variantId: "a", quantity: 2, unitPrice: d(60), taxRate: 20 },
        { variantId: "b", quantity: 1, unitPrice: d(110), taxRate: 10 },
      ],
      discountTotal: d(0),
      shippingTotal: d(30),
      shippingTaxRate: 20,
    });

    expect(totals.subtotal.toFixed(2)).toBe("230.00");
    expect(totals.grandTotal.toFixed(2)).toBe("260.00");
    // 120 içinde 20 + 110 içinde 10 + kargo 30 içinde 5
    expect(totals.taxTotal.toFixed(2)).toBe("35.00");
  });

  it("indirimi satırlara orantılı dağıtır, farkı son satıra yazar", () => {
    const totals = calculateOrderTotals({
      lines: [
        { variantId: "a", quantity: 1, unitPrice: d(100), taxRate: 20 },
        { variantId: "b", quantity: 1, unitPrice: d(100), taxRate: 20 },
        { variantId: "c", quantity: 1, unitPrice: d(100), taxRate: 20 },
      ],
      discountTotal: d(10),
      shippingTotal: d(0),
      shippingTaxRate: 20,
    });

    const shares = totals.lines.map((line) => line.discount.toFixed(2));
    expect(shares).toEqual(["3.33", "3.33", "3.34"]);
    expect(
      totals.lines.reduce((sum, l) => sum.plus(l.discount), d(0)).toFixed(2),
    ).toBe("10.00");
    expect(totals.grandTotal.toFixed(2)).toBe("290.00");
  });

  it("indirim ara toplamı aşsa bile toplam negatif olmaz", () => {
    const totals = calculateOrderTotals({
      lines: [{ variantId: "a", quantity: 1, unitPrice: d(50), taxRate: 20 }],
      discountTotal: d(500),
      shippingTotal: d(0),
      shippingTaxRate: 20,
    });
    expect(totals.grandTotal.toFixed(2)).toBe("0.00");
  });
});
