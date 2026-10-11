import { z } from "zod";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir tarih girin" });
      return z.NEVER;
    }
    return date;
  });

const optionalPositiveInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === "") return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      ctx.addIssue({
        code: "custom",
        message: "1 veya daha büyük bir tam sayı girin",
      });
      return z.NEVER;
    }
    return parsed;
  });

const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir tutar girin" });
      return z.NEVER;
    }
    return parsed;
  });

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z0-9_-]{3,40}$/,
        "Kod 3-40 karakter; harf, rakam, - ve _ içerebilir",
      ),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().positive("İndirim değeri 0'dan büyük olmalı"),
    minSubtotal: optionalMoney,
    maxUses: optionalPositiveInt,
    perCustomerLimit: optionalPositiveInt,
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().default(true),
  })
  .superRefine((coupon, ctx) => {
    if (coupon.type === "PERCENT" && coupon.value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Yüzde 100'ü aşamaz",
      });
    }
    if (coupon.startsAt && coupon.endsAt && coupon.endsAt <= coupon.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Bitiş tarihi başlangıçtan sonra olmalı",
      });
    }
  });

export type CouponInput = z.infer<typeof couponInputSchema>;

export const campaignInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Kampanya adı en az 2 karakter olmalı")
      .max(80),
    ruleType: z.enum(["category", "cart-threshold"]),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().positive("İndirim değeri 0'dan büyük olmalı"),
    categoryIds: z.array(z.string()).default([]),
    minSubtotal: optionalMoney,
    priority: z.coerce.number().int().min(0).max(999).default(0),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().default(true),
  })
  .superRefine((campaign, ctx) => {
    if (campaign.type === "PERCENT" && campaign.value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Yüzde 100'ü aşamaz",
      });
    }
    if (campaign.ruleType === "category" && campaign.categoryIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryIds"],
        message: "En az bir kategori seçin",
      });
    }
    if (
      campaign.ruleType === "cart-threshold" &&
      campaign.minSubtotal === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minSubtotal"],
        message: "Minimum sepet tutarı girin",
      });
    }
    if (
      campaign.startsAt &&
      campaign.endsAt &&
      campaign.endsAt <= campaign.startsAt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Bitiş tarihi başlangıçtan sonra olmalı",
      });
    }
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Kampanya girdisini `Campaign.config` JSON'una çevirir (DiscountRule şemasıyla uyumlu). */
export function campaignConfig(input: CampaignInput): Record<string, unknown> {
  if (input.ruleType === "category") {
    return {
      categoryIds: input.categoryIds,
      type: input.type,
      value: input.value,
    };
  }
  return {
    minSubtotal: input.minSubtotal,
    type: input.type,
    value: input.value,
  };
}
