import type { PrismaClient } from "@/shared/prisma-client";
import type {
  BulkUpdateRepository,
  VariantSnapshot,
  VariantUpdate,
} from "./bulk-update.service";

export class PrismaBulkUpdateRepository implements BulkUpdateRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async findVariantsBySku(skus: string[]): Promise<VariantSnapshot[]> {
    if (skus.length === 0) return [];
    const rows = await this.db().productVariant.findMany({
      where: { sku: { in: skus, mode: "insensitive" } },
      select: {
        id: true,
        sku: true,
        price: true,
        compareAtPrice: true,
        stockQuantity: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      price: row.price.toFixed(2),
      compareAtPrice: row.compareAtPrice?.toFixed(2) ?? null,
      stockQuantity: row.stockQuantity,
    }));
  }

  async applyUpdates(updates: VariantUpdate[]): Promise<void> {
    await this.db().$transaction(async (tx) => {
      for (const update of updates) {
        await tx.productVariant.update({
          where: { id: update.id },
          data: {
            ...(update.price !== undefined ? { price: update.price } : {}),
            ...(update.compareAtPrice !== undefined
              ? { compareAtPrice: update.compareAtPrice }
              : {}),
            ...(update.stockQuantity !== undefined
              ? { stockQuantity: update.stockQuantity }
              : {}),
          },
        });
      }
    });
  }
}
