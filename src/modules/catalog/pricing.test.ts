import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  GroupPriceResolver,
  RetailPriceResolver,
  computeUnitPrice,
  type PricingRepository,
  type TierPriceRecord,
} from "./pricing";

const d = (v: string | number) => new Decimal(v);
const tier = (minQuantity: number, price: string): TierPriceRecord => ({
  minQuantity,
  price: d(price),
});

const base = {
  listPrice: d("100"),
  groupPrice: null,
  groupDiscountPercent: null,
  tiers: [] as TierPriceRecord[],
  quantity: 1,
};

describe("computeUnitPrice", () => {
  it("hiçbir kural yoksa liste fiyatıdır", () => {
    expect(computeUnitPrice(base).toFixed(2)).toBe("100.00");
  });

  it("grup iskontosunu liste fiyatına uygular", () => {
    expect(
      computeUnitPrice({ ...base, groupDiscountPercent: d(20) }).toFixed(2),
    ).toBe("80.00");
  });

  it("varyanta özel grup fiyatı iskontodan önceliklidir", () => {
    expect(
      computeUnitPrice({
        ...base,
        groupPrice: d("70"),
        groupDiscountPercent: d(20),
      }).toFixed(2),
    ).toBe("70.00");
  });

  it("adet kademesi daha düşükse onu uygular", () => {
    const tiers = [tier(10, "90"), tier(50, "75")];
    expect(computeUnitPrice({ ...base, tiers, quantity: 9 }).toFixed(2)).toBe(
      "100.00",
    );
    expect(computeUnitPrice({ ...base, tiers, quantity: 10 }).toFixed(2)).toBe(
      "90.00",
    );
    expect(computeUnitPrice({ ...base, tiers, quantity: 60 }).toFixed(2)).toBe(
      "75.00",
    );
  });

  it("kademe, grup fiyatından yüksekse grup fiyatı korunur (en düşük kazanır)", () => {
    expect(
      computeUnitPrice({
        ...base,
        groupPrice: d("60"),
        tiers: [tier(10, "90")],
        quantity: 10,
      }).toFixed(2),
    ).toBe("60.00");
  });

  it("iskonto kuruşa yuvarlanır", () => {
    expect(
      computeUnitPrice({
        ...base,
        listPrice: d("99.99"),
        groupDiscountPercent: d("15"),
      }).toFixed(2),
    ).toBe("84.99");
  });
});

describe("RetailPriceResolver", () => {
  it("liste fiyatını döndürür", async () => {
    const map = await new RetailPriceResolver().resolveUnitPrices([
      { variantId: "v1", listPrice: "49.90", quantity: 3 },
    ]);
    expect(map.get("v1")?.toFixed(2)).toBe("49.90");
  });
});

describe("GroupPriceResolver", () => {
  const repo = (calls: string[]): PricingRepository => ({
    groupPrices: async (groupId) => {
      calls.push(`groupPrices:${groupId}`);
      return new Map([["v1", d("70")]]);
    },
    groupDiscountPercent: async (groupId) => {
      calls.push(`discount:${groupId}`);
      return d(10);
    },
    tierPrices: async (_ids, groupId) => {
      calls.push(`tiers:${groupId}`);
      return new Map([["v2", [tier(5, "40")]]]);
    },
  });

  it("grup fiyatı, iskonto ve kademeyi varyant bazında birleştirir", async () => {
    const calls: string[] = [];
    const prices = await new GroupPriceResolver(repo(calls)).resolveUnitPrices(
      [
        { variantId: "v1", listPrice: "100", quantity: 1 },
        { variantId: "v2", listPrice: "50", quantity: 5 },
        { variantId: "v3", listPrice: "200", quantity: 1 },
      ],
      { customerGroupId: "g1" },
    );

    expect(prices.get("v1")?.toFixed(2)).toBe("70.00"); // grup fiyatı
    expect(prices.get("v2")?.toFixed(2)).toBe("40.00"); // iskonto 45 → kademe 40
    expect(prices.get("v3")?.toFixed(2)).toBe("180.00"); // yalnızca iskonto
  });

  it("grup yoksa grup sorgularını yapmaz, yalnızca genel kademeyi uygular", async () => {
    const calls: string[] = [];
    const prices = await new GroupPriceResolver(repo(calls)).resolveUnitPrices(
      [{ variantId: "v2", listPrice: "50", quantity: 5 }],
      { customerGroupId: null },
    );

    expect(prices.get("v2")?.toFixed(2)).toBe("40.00");
    expect(calls).toEqual(["tiers:null"]);
  });

  it("boş istekte sorgu yapmaz", async () => {
    const calls: string[] = [];
    await new GroupPriceResolver(repo(calls)).resolveUnitPrices([], {
      customerGroupId: "g1",
    });
    expect(calls).toEqual([]);
  });
});
