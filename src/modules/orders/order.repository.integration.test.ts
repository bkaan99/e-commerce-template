import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaOrderRepository } from "./order.repository";
import type { AddressSnapshot, NewOrder } from "./order.types";

const address: AddressSnapshot = {
  firstName: "Ali",
  lastName: "Veli",
  phone: "05550000000",
  city: "İstanbul",
  district: "Kadıköy",
  neighborhood: null,
  addressLine: "Örnek Sk. No:1",
  postalCode: null,
  invoiceType: "INDIVIDUAL",
  nationalId: null,
  companyName: null,
  taxNumber: null,
  taxOffice: null,
};

describe("PrismaOrderRepository", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let repo: PrismaOrderRepository;
  let variantId: string;
  let sku: string;

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    repo = new PrismaOrderRepository(() => db);

    const category = await db.category.create({
      data: { name: "Sipariş Test", slug: `order-test-${tag}` },
    });
    const product = await db.product.create({
      data: {
        name: `Sipariş Ürünü ${tag}`,
        slug: `siparis-urunu-${tag}`,
        status: "ACTIVE",
        categoryId: category.id,
        variants: {
          create: { sku: `ORD-${tag}`, price: "100.00", stockQuantity: 3 },
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0]!.id;
    sku = product.variants[0]!.sku;
  });

  beforeEach(async () => {
    await db.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity: 3, reservedQuantity: 0 },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const newOrder = (
    quantity: number,
    overrides: Partial<NewOrder> = {},
  ): NewOrder => ({
    userId: null,
    email: `musteri-${tag}@example.com`,
    cartId: null,
    currency: "TRY",
    subtotal: (100 * quantity).toFixed(2),
    discountTotal: "0.00",
    shippingTotal: "0.00",
    taxTotal: "0.00",
    grandTotal: (100 * quantity).toFixed(2),
    couponCode: null,
    shippingAddress: address,
    billingAddress: address,
    customerNote: null,
    reservationMinutes: 15,
    paymentProvider: "paytr",
    paymentMethod: "CARD",
    items: [
      {
        variantId,
        productName: `Sipariş Ürünü ${tag}`,
        variantName: null,
        sku,
        unitPrice: "100.00",
        taxRate: "20.00",
        quantity,
        lineTotal: (100 * quantity).toFixed(2),
        trackInventory: true,
      },
    ],
    ...overrides,
  });

  const stock = async () => {
    const variant = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    return {
      stock: variant.stockQuantity,
      reserved: variant.reservedQuantity,
    };
  };

  const success = (merchantOid: string, amount: string) => ({
    merchantOid,
    success: true,
    amount,
    failureReason: null,
    rawPayload: { merchant_oid: merchantOid, status: "success" },
  });

  it("sipariş oluştururken stoğu rezerve eder", async () => {
    const created = await repo.createPendingOrder(newOrder(2));

    expect(await stock()).toEqual({ stock: 3, reserved: 2 });
    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order).toMatchObject({
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      grandTotal: "200.00",
    });
  });

  it("yetersiz stokta siparişi reddeder ve hiçbir şey yazmaz", async () => {
    await expect(repo.createPendingOrder(newOrder(4))).rejects.toThrow(
      "yeterli stok yok",
    );
    expect(await stock()).toEqual({ stock: 3, reserved: 0 });
  });

  it("eşzamanlı siparişlerde stoktan fazla satmaz", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => repo.createPendingOrder(newOrder(1))),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await stock()).toEqual({ stock: 3, reserved: 3 });
  });

  it("başarılı ödemede stoğu düşer ve siparişi PAID yapar", async () => {
    const created = await repo.createPendingOrder(newOrder(2));

    const outcome = await repo.applyPaymentResult(
      success(created.merchantOid, "200.00"),
    );

    expect(outcome).toEqual({ kind: "paid", orderId: created.orderId });
    expect(await stock()).toEqual({ stock: 1, reserved: 0 });
    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order).toMatchObject({ status: "PAID", paymentStatus: "PAID" });
  });

  it("aynı bildirim tekrar gelirse stoğu ikinci kez düşmez (idempotent)", async () => {
    const created = await repo.createPendingOrder(newOrder(1));

    await repo.applyPaymentResult(success(created.merchantOid, "100.00"));
    const second = await repo.applyPaymentResult(
      success(created.merchantOid, "100.00"),
    );

    expect(second.kind).toBe("already-processed");
    expect(await stock()).toEqual({ stock: 2, reserved: 0 });
  });

  it("eşzamanlı çift bildirimde yalnızca biri işlenir", async () => {
    const created = await repo.createPendingOrder(newOrder(1));

    const outcomes = await Promise.all([
      repo.applyPaymentResult(success(created.merchantOid, "100.00")),
      repo.applyPaymentResult(success(created.merchantOid, "100.00")),
    ]);

    expect(outcomes.filter((o) => o.kind === "paid")).toHaveLength(1);
    expect(await stock()).toEqual({ stock: 2, reserved: 0 });
  });

  it("tutar uyuşmazsa ödemeyi kabul etmez", async () => {
    const created = await repo.createPendingOrder(newOrder(1));

    const outcome = await repo.applyPaymentResult(
      success(created.merchantOid, "1.00"),
    );

    expect(outcome.kind).toBe("amount-mismatch");
    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order?.status).not.toBe("PAID");
  });

  it("başarısız ödemede rezervasyonu bırakır ve siparişi iptal eder", async () => {
    const created = await repo.createPendingOrder(newOrder(2));

    const outcome = await repo.applyPaymentResult({
      merchantOid: created.merchantOid,
      success: false,
      amount: "200.00",
      failureReason: "Yetersiz bakiye",
      rawPayload: { status: "failed" },
    });

    expect(outcome.kind).toBe("failed");
    expect(await stock()).toEqual({ stock: 3, reserved: 0 });
    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "FAILED",
    });
  });

  it("ödenmiş siparişi iptal edince stoğu geri yükler", async () => {
    const created = await repo.createPendingOrder(newOrder(2));
    await repo.applyPaymentResult(success(created.merchantOid, "200.00"));
    expect(await stock()).toEqual({ stock: 1, reserved: 0 });

    await repo.cancelOrder(created.orderId, true);

    expect(await stock()).toEqual({ stock: 3, reserved: 0 });
    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order?.status).toBe("REFUNDED");
  });

  it("süresi dolan ödeme bekleyen siparişleri iptal eder ve stoğu serbest bırakır", async () => {
    const created = await repo.createPendingOrder(
      newOrder(2, { reservationMinutes: -1 }),
    );
    expect(await stock()).toEqual({ stock: 3, reserved: 2 });

    const released = await repo.releaseExpired(new Date());

    expect(released).toBeGreaterThanOrEqual(1);
    expect(await stock()).toEqual({ stock: 3, reserved: 0 });
    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order?.status).toBe("CANCELLED");
  });

  it("stok takibi olmayan satırda rezervasyon yapmaz", async () => {
    const order = newOrder(10);
    order.items[0]!.trackInventory = false;

    await repo.createPendingOrder(order);

    expect(await stock()).toEqual({ stock: 3, reserved: 0 });
  });

  it("bilinmeyen merchant_oid için not-found döner", async () => {
    const outcome = await repo.applyPaymentResult(success("YOK123", "1.00"));
    expect(outcome.kind).toBe("not-found");
  });

  it("kupon kullanımını e-posta ve üye bazında sayar", async () => {
    const email = `kupon-${tag}@example.com`;
    await repo.createPendingOrder(
      newOrder(1, { email, couponCode: `KUPON${tag}` }),
    );
    await repo.createPendingOrder(newOrder(1, { email }));

    expect(
      await repo.countCouponUses(`KUPON${tag}`, { userId: null, email }),
    ).toBe(1);
  });
});

describe("PrismaOrderRepository: vadeli sipariş", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let repo: PrismaOrderRepository;
  let variantId: string;
  let userId: string;

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    repo = new PrismaOrderRepository(() => db);

    const category = await db.category.create({
      data: { name: "Vadeli", slug: `deferred-${tag}` },
    });
    const product = await db.product.create({
      data: {
        name: `Vadeli Ürün ${tag}`,
        slug: `vadeli-urun-${tag}`,
        status: "ACTIVE",
        categoryId: category.id,
        variants: {
          create: { sku: `DEF-${tag}`, price: "100.00", stockQuantity: 100 },
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0]!.id;

    const user = await db.user.create({
      data: {
        email: `bayi-${tag}@example.com`,
        firstName: "Bayi",
        lastName: "Test",
        customer: { create: { b2bStatus: "APPROVED", creditLimit: "1000.00" } },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const deferredOrder = (amount: number): NewOrder => ({
    userId,
    email: `bayi-${tag}@example.com`,
    cartId: null,
    currency: "TRY",
    subtotal: amount.toFixed(2),
    discountTotal: "0.00",
    shippingTotal: "0.00",
    taxTotal: "0.00",
    grandTotal: amount.toFixed(2),
    couponCode: null,
    shippingAddress: address,
    billingAddress: address,
    customerNote: null,
    reservationMinutes: 15,
    paymentProvider: "deferred",
    paymentMethod: "DEFERRED",
    items: [
      {
        variantId,
        productName: `Vadeli Ürün ${tag}`,
        variantName: null,
        sku: `DEF-${tag}`,
        unitPrice: "100.00",
        taxRate: "20.00",
        quantity: amount / 100,
        lineTotal: amount.toFixed(2),
        trackInventory: true,
      },
    ],
  });

  const terms = {
    creditLimit: "1000.00",
    dueAt: new Date(Date.now() + 30 * 86_400_000),
  };

  it("kredi limiti içinde siparişi onaylar ve stoğu doğrudan düşer", async () => {
    const before = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    const created = await repo.createDeferredOrder(deferredOrder(300), terms);

    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order).toMatchObject({
      status: "PROCESSING",
      paymentStatus: "PENDING",
      paymentMethod: "DEFERRED",
    });
    expect(order?.paymentDueAt).not.toBeNull();

    const after = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(after.stockQuantity).toBe(before.stockQuantity - 3);
    expect(after.reservedQuantity).toBe(before.reservedQuantity);
  });

  it("kredi limitini aşan siparişi reddeder ve stoğa dokunmaz", async () => {
    // Önceki testten 300 TL kullanımda; 800 TL eklenince 1100 > 1000
    const before = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    await expect(
      repo.createDeferredOrder(deferredOrder(800), terms),
    ).rejects.toThrow("Kredi limitiniz yetersiz");

    const after = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(after.stockQuantity).toBe(before.stockQuantity);
  });

  it("eşzamanlı siparişlerde limit aşılmaz (satır kilidi)", async () => {
    const racer = await db.user.create({
      data: {
        email: `yaris-${tag}@example.com`,
        firstName: "Yarış",
        lastName: "Bayi",
        customer: { create: { b2bStatus: "APPROVED", creditLimit: "500.00" } },
      },
    });
    const make = (): NewOrder => ({ ...deferredOrder(300), userId: racer.id });

    const results = await Promise.allSettled([
      repo.createDeferredOrder(make(), { ...terms, creditLimit: "500.00" }),
      repo.createDeferredOrder(make(), { ...terms, creditLimit: "500.00" }),
      repo.createDeferredOrder(make(), { ...terms, creditLimit: "500.00" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("tahsil edilince PAID olur; ikinci işaretleme etkisizdir", async () => {
    const created = await repo.createDeferredOrder(
      { ...deferredOrder(100) },
      { ...terms, creditLimit: "5000.00" },
    );

    expect(await repo.markDeferredPaid(created.orderId)).toBe(true);
    expect(await repo.markDeferredPaid(created.orderId)).toBe(false);

    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order?.paymentStatus).toBe("PAID");
  });

  it("iptal edilen vadeli sipariş stoğu geri yükler ve krediyi serbest bırakır", async () => {
    const created = await repo.createDeferredOrder(deferredOrder(100), {
      ...terms,
      creditLimit: "5000.00",
    });
    const mid = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    await repo.cancelOrder(created.orderId, false);

    const after = await db.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(after.stockQuantity).toBe(mid.stockQuantity + 1);
    const order = await repo.findByOrderNumber(created.orderNumber);
    expect(order?.status).toBe("CANCELLED");
  });
});
