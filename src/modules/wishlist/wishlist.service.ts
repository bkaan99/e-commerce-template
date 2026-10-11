import { NotFoundError } from "@/shared/errors";
import type { WishlistRepository } from "./wishlist.repository";

const MAX_MERGE_SIZE = 200;

export class WishlistService {
  constructor(private readonly repository: WishlistRepository) {}

  list(userId: string): Promise<string[]> {
    return this.repository.listProductIds(userId);
  }

  async add(userId: string, productId: string): Promise<void> {
    const active = await this.repository.filterActiveProductIds([productId]);
    if (active.length === 0) throw new NotFoundError("Ürün");
    await this.repository.add(userId, productId);
  }

  remove(userId: string, productId: string): Promise<void> {
    return this.repository.remove(userId, productId);
  }

  /** Misafir favorilerini üye hesabına aktarır; geçersiz kimlikleri atlar. */
  async mergeGuestItems(
    userId: string,
    productIds: string[],
  ): Promise<string[]> {
    const unique = [...new Set(productIds)].slice(0, MAX_MERGE_SIZE);
    const valid = await this.repository.filterActiveProductIds(unique);

    for (const productId of valid) {
      await this.repository.add(userId, productId);
    }

    return this.repository.listProductIds(userId);
  }
}
