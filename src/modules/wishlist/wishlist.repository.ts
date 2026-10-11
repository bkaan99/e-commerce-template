import type { PrismaClient } from "@/shared/prisma-client";

export interface WishlistRepository {
  listProductIds(userId: string): Promise<string[]>;
  add(userId: string, productId: string): Promise<void>;
  remove(userId: string, productId: string): Promise<void>;
  /** Yalnızca yayında olan ürünlerin kimliklerini döndürür. */
  filterActiveProductIds(productIds: string[]): Promise<string[]>;
}

export class PrismaWishlistRepository implements WishlistRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async listProductIds(userId: string): Promise<string[]> {
    const rows = await this.db().wishlistItem.findMany({
      where: { userId, product: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      select: { productId: true },
    });
    return rows.map((row) => row.productId);
  }

  async add(userId: string, productId: string): Promise<void> {
    await this.db().wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.db().wishlistItem.deleteMany({ where: { userId, productId } });
  }

  async filterActiveProductIds(productIds: string[]): Promise<string[]> {
    if (productIds.length === 0) return [];
    const rows = await this.db().product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
