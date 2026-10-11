import { describe, expect, it } from "vitest";
import { createCampaignRule } from "../../checkout/discounts";
import {
  campaignConfig,
  campaignInputSchema,
  couponInputSchema,
} from "./promotion.schema";

describe("couponInputSchema", () => {
  it("kodu büyük harfe çevirir ve alanları normalleştirir", () => {
    const coupon = couponInputSchema.parse({
      code: " yaz10 ",
      type: "PERCENT",
      value: "10",
      minSubtotal: "250,50",
      maxUses: "100",
    });
    expect(coupon).toMatchObject({
      code: "YAZ10",
      value: 10,
      minSubtotal: 250.5,
      maxUses: 100,
      perCustomerLimit: null,
      startsAt: null,
    });
  });

  it("yüzde 100'ü aşan indirimi reddeder", () => {
    expect(
      couponInputSchema.safeParse({ code: "ABC", type: "PERCENT", value: 120 })
        .success,
    ).toBe(false);
  });

  it("geçersiz kodu ve bitiş < başlangıç tarihini reddeder", () => {
    expect(
      couponInputSchema.safeParse({ code: "a b", type: "FIXED", value: 10 })
        .success,
    ).toBe(false);
    expect(
      couponInputSchema.safeParse({
        code: "ABC",
        type: "FIXED",
        value: 10,
        startsAt: "2026-06-10",
        endsAt: "2026-06-01",
      }).success,
    ).toBe(false);
  });
});

describe("campaignInputSchema", () => {
  it("kategori kampanyasında kategori zorunludur", () => {
    expect(
      campaignInputSchema.safeParse({
        name: "Giyim",
        ruleType: "category",
        type: "PERCENT",
        value: 10,
      }).success,
    ).toBe(false);
  });

  it("sepet eşiği kampanyasında minimum tutar zorunludur", () => {
    expect(
      campaignInputSchema.safeParse({
        name: "Eşik",
        ruleType: "cart-threshold",
        type: "FIXED",
        value: 50,
      }).success,
    ).toBe(false);
  });

  it("üretilen yapılandırma checkout kural fabrikasıyla uyumludur", () => {
    const category = campaignInputSchema.parse({
      name: "Giyim %10",
      ruleType: "category",
      type: "PERCENT",
      value: 10,
      categoryIds: ["c1"],
    });
    const threshold = campaignInputSchema.parse({
      name: "500 üstü",
      ruleType: "cart-threshold",
      type: "FIXED",
      value: 50,
      minSubtotal: "500",
    });

    expect(
      createCampaignRule({
        name: category.name,
        ruleType: category.ruleType,
        config: campaignConfig(category),
      }),
    ).not.toBeNull();
    expect(
      createCampaignRule({
        name: threshold.name,
        ruleType: threshold.ruleType,
        config: campaignConfig(threshold),
      }),
    ).not.toBeNull();
  });
});
