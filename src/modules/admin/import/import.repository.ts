import type { PrismaClient } from "@/shared/prisma-client";
import type { ImportRepository } from "./product-import.service";

export class PrismaImportRepository implements ImportRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async taxonomy() {
    const [categories, brands] = await Promise.all([
      this.db().category.findMany({
        select: { id: true, name: true, slug: true },
      }),
      this.db().brand.findMany({ select: { id: true, name: true } }),
    ]);
    return { categories, brands };
  }

  async existingSkus(skus: string[]): Promise<string[]> {
    if (skus.length === 0) return [];
    const rows = await this.db().productVariant.findMany({
      where: { sku: { in: skus, mode: "insensitive" } },
      select: { sku: true },
    });
    return rows.map((row) => row.sku);
  }

  async existingSlugs(slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const rows = await this.db().product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true },
    });
    return rows.map((row) => row.slug);
  }
}
