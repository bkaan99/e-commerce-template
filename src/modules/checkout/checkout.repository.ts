import type Decimal from "decimal.js";
import type { PrismaClient } from "@/shared/prisma-client";

export interface CheckoutLineRecord {
  variantId: string;
  quantity: number;
  sku: string;
  price: Decimal;
  currency: string;
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  desi: number;
  product: {
    name: string;
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    trackInventory: boolean;
    taxRate: Decimal;
    categoryId: string;
    desi: number;
  };
  optionLabels: string[];
}

export interface CouponRecord {
  code: string;
  type: "PERCENT" | "FIXED";
  value: Decimal;
  minSubtotal: Decimal | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface CampaignRecord {
  name: string;
  ruleType: string;
  config: unknown;
  priority: number;
}

export interface CheckoutRepository {
  loadCartLines(cartId: string): Promise<CheckoutLineRecord[]>;
  findCoupon(code: string): Promise<CouponRecord | null>;
  listActiveCampaigns(now: Date): Promise<CampaignRecord[]>;
}

export class PrismaCheckoutRepository implements CheckoutRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async loadCartLines(cartId: string): Promise<CheckoutLineRecord[]> {
    const items = await this.db().cartItem.findMany({
      where: { cartId },
      orderBy: { createdAt: "asc" },
      include: {
        variant: {
          include: {
            product: true,
            optionValues: {
              include: { optionValue: { include: { option: true } } },
            },
          },
        },
      },
    });

    return items.map((item) => {
      const variant = item.variant;
      const desi = variant.desi ?? variant.product.desi;

      return {
        variantId: variant.id,
        quantity: item.quantity,
        sku: variant.sku,
        price: variant.price,
        currency: variant.currency,
        isActive: variant.isActive,
        stockQuantity: variant.stockQuantity,
        reservedQuantity: variant.reservedQuantity,
        desi: desi ? Number(desi) : 0,
        product: {
          name: variant.product.name,
          status: variant.product.status,
          trackInventory: variant.product.trackInventory,
          taxRate: variant.product.taxRate,
          categoryId: variant.product.categoryId,
          desi: variant.product.desi ? Number(variant.product.desi) : 0,
        },
        optionLabels: variant.optionValues
          .sort(
            (a, b) =>
              a.optionValue.option.position - b.optionValue.option.position,
          )
          .map((value) => value.optionValue.value),
      };
    });
  }

  async findCoupon(code: string): Promise<CouponRecord | null> {
    const coupon = await this.db().coupon.findUnique({ where: { code } });
    return coupon;
  }

  async listActiveCampaigns(now: Date): Promise<CampaignRecord[]> {
    const rows = await this.db().campaign.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { priority: "desc" },
    });

    return rows.map((row) => ({
      name: row.name,
      ruleType: row.ruleType,
      config: row.config,
      priority: row.priority,
    }));
  }
}
