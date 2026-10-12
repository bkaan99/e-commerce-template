import type Decimal from "decimal.js";
import type { PrismaClient } from "@/shared/prisma-client";
import type { PricingRepository, TierPriceRecord } from "./pricing";

export class PrismaPricingRepository implements PricingRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async groupPrices(
    groupId: string,
    variantIds: string[],
  ): Promise<Map<string, Decimal>> {
    const rows = await this.db().variantGroupPrice.findMany({
      where: { groupId, variantId: { in: variantIds } },
    });
    return new Map(rows.map((row) => [row.variantId, row.price]));
  }

  async groupDiscountPercent(groupId: string): Promise<Decimal | null> {
    const group = await this.db().customerGroup.findUnique({
      where: { id: groupId },
      select: { discountPercent: true },
    });
    return group?.discountPercent ?? null;
  }

  async tierPrices(
    variantIds: string[],
    groupId: string | null,
  ): Promise<Map<string, TierPriceRecord[]>> {
    const rows = await this.db().tierPrice.findMany({
      where: {
        variantId: { in: variantIds },
        OR: [{ groupId: null }, ...(groupId ? [{ groupId }] : [])],
      },
    });

    const result = new Map<string, TierPriceRecord[]>();
    for (const row of rows) {
      const list = result.get(row.variantId) ?? [];
      list.push({ minQuantity: row.minQuantity, price: row.price });
      result.set(row.variantId, list);
    }
    return result;
  }
}
