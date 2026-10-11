import type Decimal from "decimal.js";
import { z } from "zod";
import { roundMoney, toDecimal } from "@/shared/money";

export interface DiscountLineInput {
  variantId: string;
  categoryId: string;
  quantity: number;
  /** KDV dahil birim fiyat */
  unitPrice: Decimal;
}

export interface DiscountContext {
  lines: DiscountLineInput[];
  /** İndirim öncesi ara toplam */
  subtotal: Decimal;
}

export interface AppliedDiscount {
  /** Gösterilecek ad (kupon kodu veya kampanya adı) */
  label: string;
  amount: Decimal;
}

/** İndirim kuralı sözleşmesi: yeni kural tipi mevcut kodu değiştirmeden eklenir. */
export interface DiscountRule {
  apply(context: DiscountContext): AppliedDiscount | null;
}

export type DiscountKind = "PERCENT" | "FIXED";

export function discountAmount(
  kind: DiscountKind,
  value: Decimal.Value,
  base: Decimal,
): Decimal {
  const amount =
    kind === "PERCENT"
      ? base.times(toDecimal(value)).dividedBy(100)
      : toDecimal(value);

  return roundMoney(amount.greaterThan(base) ? base : amount);
}

/** Sepet tutarına uygulanan kupon kodu kuralı. */
export class CouponRule implements DiscountRule {
  constructor(
    private readonly coupon: {
      code: string;
      type: DiscountKind;
      value: Decimal.Value;
      minSubtotal: Decimal.Value | null;
    },
  ) {}

  apply(context: DiscountContext): AppliedDiscount | null {
    if (
      this.coupon.minSubtotal !== null &&
      context.subtotal.lt(this.coupon.minSubtotal)
    ) {
      return null;
    }

    const amount = discountAmount(
      this.coupon.type,
      this.coupon.value,
      context.subtotal,
    );
    return amount.gt(0) ? { label: this.coupon.code, amount } : null;
  }
}

/** Belirli bir kategorideki ürünlere uygulanan kampanya. */
export class CategoryDiscountRule implements DiscountRule {
  constructor(
    private readonly name: string,
    private readonly config: {
      categoryIds: string[];
      type: DiscountKind;
      value: number;
    },
  ) {}

  apply(context: DiscountContext): AppliedDiscount | null {
    const base = context.lines
      .filter((line) => this.config.categoryIds.includes(line.categoryId))
      .reduce(
        (sum, line) => sum.plus(line.unitPrice.times(line.quantity)),
        toDecimal(0),
      );

    const amount = discountAmount(this.config.type, this.config.value, base);
    return amount.gt(0) ? { label: this.name, amount } : null;
  }
}

/** Sepet belirli tutarı geçince uygulanan kampanya. */
export class CartThresholdDiscountRule implements DiscountRule {
  constructor(
    private readonly name: string,
    private readonly config: {
      minSubtotal: number;
      type: DiscountKind;
      value: number;
    },
  ) {}

  apply(context: DiscountContext): AppliedDiscount | null {
    if (context.subtotal.lt(this.config.minSubtotal)) return null;

    const amount = discountAmount(
      this.config.type,
      this.config.value,
      context.subtotal,
    );
    return amount.gt(0) ? { label: this.name, amount } : null;
  }
}

const kindSchema = z.enum(["PERCENT", "FIXED"]);

const categoryConfigSchema = z.object({
  categoryIds: z.array(z.string()).min(1),
  type: kindSchema,
  value: z.number().positive(),
});

const thresholdConfigSchema = z.object({
  minSubtotal: z.number().nonnegative(),
  type: kindSchema,
  value: z.number().positive(),
});

export const CAMPAIGN_RULE_TYPES = ["category", "cart-threshold"] as const;

/**
 * Veritabanındaki kampanya kaydını kurala çevirir. Bilinmeyen tip veya bozuk
 * yapılandırma kampanyayı sessizce atlar; ödeme akışını bozmaz.
 */
export function createCampaignRule(campaign: {
  name: string;
  ruleType: string;
  config: unknown;
}): DiscountRule | null {
  switch (campaign.ruleType) {
    case "category": {
      const parsed = categoryConfigSchema.safeParse(campaign.config);
      return parsed.success
        ? new CategoryDiscountRule(campaign.name, parsed.data)
        : null;
    }
    case "cart-threshold": {
      const parsed = thresholdConfigSchema.safeParse(campaign.config);
      return parsed.success
        ? new CartThresholdDiscountRule(campaign.name, parsed.data)
        : null;
    }
    default:
      return null;
  }
}

/**
 * Kuralları sırayla uygular; toplam indirim ara toplamı aşamaz.
 * Her kural indirim öncesi sepete bakar (kümülatif yığılma sınırı dışında).
 */
export function applyDiscountRules(
  rules: readonly DiscountRule[],
  context: DiscountContext,
): { applied: AppliedDiscount[]; total: Decimal } {
  const applied: AppliedDiscount[] = [];
  let total = toDecimal(0);

  for (const rule of rules) {
    const result = rule.apply(context);
    if (!result) continue;

    const remaining = context.subtotal.minus(total);
    const amount = result.amount.gt(remaining) ? remaining : result.amount;
    if (amount.lte(0)) continue;

    applied.push({ label: result.label, amount });
    total = total.plus(amount);
  }

  return { applied, total };
}
