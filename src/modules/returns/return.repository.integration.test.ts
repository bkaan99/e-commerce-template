import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaReturnRepository } from "./return.repository";

describe("PrismaReturnRepository", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let repo: PrismaReturnRepository;
  let variantId: string;

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    repo = new PrismaReturnRepository(() => db);

    const category = await db.category.create({
      data: { name: "İade", slug: `return-${tag}` },
    });
    const product = await db.product.create({
      data: {
        name: `İade Ürünü ${tag}`,
        slug: `iade-urunu-${tag}`,
        status: "ACTIVE",
        categoryId: category.id,
        variants: {
          create: { sku: `RET-${tag}`, price: "100.00", stockQuantity: 5 },
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0]!.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function createDeliveredOrder() {
    const orderNumber = `R${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const order = await db.order.create({
      data: {
        orderNumber,
        lookupToken: randomUUID(),
        guestEmail: `iade-${tag}@example.com`,
        status: "DELIVERED",
        paymentStatus: "PAID",
        subtotal: "300.00",
        grandTotal: "300.00",
        shippingAddress: {},
        billingAddress: {},
        items: {
          create: {
            variantId,
            productName: "İade Ürünü",
            sku: `RET-${tag}`,
            unitPrice: "100.00",
            taxRate: "20.00",
            quantity: 3,
            lineTotal: "300.00",
          },
        },
        payments: {
          create: {
            provider: "dev",
            amount: "300.00",
            merchantOid: orderNumber,
            status: "PAID",
          },
        },
      },
      include: { items: true },
    });
    return order;
  }

  it("talep oluşturur ve istenen adetleri toplar (reddedilenler hariç)", async () => {
    const order = await createDeliveredOrder();
    const itemId = order.items[0]!.id;

    const first = await repo.createRequest(order.id, {
      reason: "Beden",
      note: null,
      items: [{ orderItemId: itemId, quantity: 1 }],
    });
    await repo.createRequest(order.id, {
      reason: "Hasarlı",
      note: null,
      items: [{ orderItemId: itemId, quantity: 1 }],
    });

    expect((await repo.requestedQuantities(order.id)).get(itemId)).toBe(2);

    await repo.reject(first, "Kullanılmış");
    expect((await repo.requestedQuantities(order.id)).get(itemId)).toBe(1);
  });

  it("kısmi iadeyi tamamlar: ödeme PARTIALLY_REFUNDED olur, stok geri yüklenir", async () => {
    const order = await createDeliveredOrder();
    const itemId = order.items[0]!.id;
    const before = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    const requestId = await repo.createRequest(order.id, {
      reason: "Beden",
      note: null,
      items: [{ orderItemId: itemId, quantity: 1 }],
    });

    await repo.complete(requestId, {
      amount: "100.00",
      providerRef: "ref",
      restock: true,
    });

    const after = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(after.stockQuantity).toBe(before.stockQuantity + 1);

    const updated = await db.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updated.paymentStatus).toBe("PARTIALLY_REFUNDED");
    expect(updated.status).toBe("DELIVERED");

    const request = await db.returnRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(request.status).toBe("COMPLETED");
  });

  it("tam tutar iade edilince sipariş REFUNDED olur; ikinci tamamlama etkisizdir", async () => {
    const order = await createDeliveredOrder();
    const itemId = order.items[0]!.id;

    const requestId = await repo.createRequest(order.id, {
      reason: "Hepsi",
      note: null,
      items: [{ orderItemId: itemId, quantity: 3 }],
    });

    await repo.complete(requestId, {
      amount: "300.00",
      providerRef: null,
      restock: false,
    });
    await repo.complete(requestId, {
      amount: "300.00",
      providerRef: null,
      restock: false,
    });

    const updated = await db.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updated.status).toBe("REFUNDED");
    expect(updated.paymentStatus).toBe("REFUNDED");
    expect(
      await db.refund.count({ where: { payment: { orderId: order.id } } }),
    ).toBe(1);
  });
});
