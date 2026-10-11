import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaCartRepository } from "./cart.repository";
import { CartService } from "./cart.service";

describe("Cart (veritabanı)", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let service: CartService;
  let variantId: string;
  let otherVariantId: string;
  let userId: string;

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    service = new CartService(new PrismaCartRepository(() => db));

    const category = await db.category.create({
      data: { name: "Test", slug: `cart-test-${tag}` },
    });
    const product = await db.product.create({
      data: {
        name: `Sepet Ürünü ${tag}`,
        slug: `sepet-urunu-${tag}`,
        status: "ACTIVE",
        categoryId: category.id,
        variants: {
          create: [
            { sku: `CART-A-${tag}`, price: "100.00", stockQuantity: 5 },
            { sku: `CART-B-${tag}`, price: "40.00", stockQuantity: 10 },
          ],
        },
      },
      include: { variants: { orderBy: { sku: "asc" } } },
    });
    variantId = product.variants[0]!.id;
    otherVariantId = product.variants[1]!.id;

    const user = await db.user.create({
      data: {
        email: `cart-${tag}@example.com`,
        firstName: "Sepet",
        lastName: "Test",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("misafir sepeti oluşturur ve toplamı hesaplar", async () => {
    const result = await service.addItem(
      { userId: null, sessionToken: null },
      variantId,
      2,
    );

    expect(result.sessionToken).toBeTruthy();
    expect(result.cart).toMatchObject({ itemCount: 2, subtotal: "200.00" });
  });

  it("stoğu aşan adedi reddeder", async () => {
    await expect(
      service.addItem({ userId: null, sessionToken: null }, variantId, 6),
    ).rejects.toThrow("Stokta yalnızca 5 adet var");
  });

  it("rezervasyon stoğu satılabilirden düşer", async () => {
    await db.productVariant.update({
      where: { id: otherVariantId },
      data: { reservedQuantity: 10 },
    });

    await expect(
      service.addItem({ userId: null, sessionToken: null }, otherVariantId, 1),
    ).rejects.toThrow("stokta yok");

    await db.productVariant.update({
      where: { id: otherVariantId },
      data: { reservedQuantity: 0 },
    });
  });

  it("girişte misafir sepetini üye sepetiyle toplar ve misafir sepetini siler", async () => {
    const member = await service.addItem(
      { userId, sessionToken: null },
      variantId,
      1,
    );
    const guest = await service.addItem(
      { userId: null, sessionToken: null },
      variantId,
      2,
    );
    await service.addItem(
      { userId: null, sessionToken: guest.sessionToken! },
      otherVariantId,
      3,
    );

    const merged = await service.getCart({
      userId,
      sessionToken: guest.sessionToken!,
    });

    expect(merged.cart.id).toBe(member.cart.id);
    expect(merged.clearSessionToken).toBe(true);
    const quantities = Object.fromEntries(
      merged.cart.lines.map((line) => [line.variantId, line.quantity]),
    );
    expect(quantities).toEqual({ [variantId]: 3, [otherVariantId]: 3 });
    expect(
      await db.cart.count({ where: { sessionToken: guest.sessionToken! } }),
    ).toBe(0);
  });
});
