import { describe, expect, it } from "vitest";
import type { WishlistRepository } from "./wishlist.repository";
import { WishlistService } from "./wishlist.service";

class FakeWishlistRepository implements WishlistRepository {
  items = new Map<string, string[]>();
  constructor(private readonly activeProducts: string[]) {}

  async listProductIds(userId: string) {
    return [...(this.items.get(userId) ?? [])].reverse();
  }
  async add(userId: string, productId: string) {
    const list = this.items.get(userId) ?? [];
    if (!list.includes(productId)) list.push(productId);
    this.items.set(userId, list);
  }
  async remove(userId: string, productId: string) {
    this.items.set(
      userId,
      (this.items.get(userId) ?? []).filter((id) => id !== productId),
    );
  }
  async filterActiveProductIds(ids: string[]) {
    return ids.filter((id) => this.activeProducts.includes(id));
  }
}

describe("WishlistService", () => {
  it("var olan ürünü ekler, aynı ürünü iki kez eklemez", async () => {
    const service = new WishlistService(new FakeWishlistRepository(["p1"]));
    await service.add("u1", "p1");
    await service.add("u1", "p1");
    expect(await service.list("u1")).toEqual(["p1"]);
  });

  it("yayında olmayan ürünü eklemeyi reddeder", async () => {
    const service = new WishlistService(new FakeWishlistRepository([]));
    await expect(service.add("u1", "yok")).rejects.toThrow("Ürün bulunamadı");
  });

  it("misafir listesini birleştirirken geçersiz ve tekrar eden kimlikleri atlar", async () => {
    const service = new WishlistService(
      new FakeWishlistRepository(["p1", "p2"]),
    );
    const result = await service.mergeGuestItems("u1", [
      "p1",
      "p1",
      "p2",
      "silinmis",
    ]);
    expect(result.sort()).toEqual(["p1", "p2"]);
  });

  it("kaldırır", async () => {
    const service = new WishlistService(new FakeWishlistRepository(["p1"]));
    await service.add("u1", "p1");
    await service.remove("u1", "p1");
    expect(await service.list("u1")).toEqual([]);
  });
});
