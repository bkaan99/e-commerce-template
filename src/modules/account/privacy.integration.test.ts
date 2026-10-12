import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaAddressRepository } from "./address.repository";
import { PrismaPrivacyRepository } from "./privacy.repository";

describe("KVKK: veri dışa aktarma ve anonimleştirme (veritabanı)", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let privacy: PrismaPrivacyRepository;
  let userId: string;
  let email: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    privacy = new PrismaPrivacyRepository(() => db);

    const category = await db.category.create({
      data: { name: "KVKK", slug: `kvkk-${tag}` },
    });
    const product = await db.product.create({
      data: {
        name: `KVKK Ürünü ${tag}`,
        slug: `kvkk-urunu-${tag}`,
        status: "ACTIVE",
        categoryId: category.id,
        variants: {
          create: { sku: `KVKK-${tag}`, price: "10.00", stockQuantity: 5 },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0]!.id;

    email = `kvkk-${tag}@example.com`;
    const user = await db.user.create({
      data: {
        email,
        passwordHash: "hash",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        phone: "05550000000",
        customer: {
          create: {
            b2bStatus: "APPROVED",
            companyName: "Gizli Ltd.",
            taxNumber: "1234567890",
            taxOffice: "Kadıköy",
            creditLimit: "1000.00",
          },
        },
      },
    });
    userId = user.id;

    await db.address.create({
      data: {
        userId,
        title: "Ev",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        phone: "05550000000",
        city: "İstanbul",
        district: "Kadıköy",
        addressLine: "Gizli Sokak No: 1",
      },
    });
    await db.wishlistItem.create({ data: { userId, productId } });
    await db.cart.create({ data: { userId } });
    await db.backInStockSubscription.create({ data: { variantId, email } });
    await db.order.create({
      data: {
        orderNumber: `K${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
        lookupToken: randomUUID(),
        userId,
        guestEmail: email,
        status: "DELIVERED",
        paymentStatus: "PAID",
        subtotal: "10.00",
        grandTotal: "10.00",
        shippingAddress: { firstName: "Ayşe" },
        billingAddress: { firstName: "Ayşe" },
        items: {
          create: {
            variantId,
            productName: "KVKK Ürünü",
            sku: `KVKK-${tag}`,
            unitPrice: "10.00",
            taxRate: "20.00",
            quantity: 1,
            lineTotal: "10.00",
          },
        },
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("tüm kişisel veriyi dışa aktarır", async () => {
    const data = await privacy.collectExport(userId);

    expect(data?.account).toMatchObject({
      email,
      firstName: "Ayşe",
      phone: "05550000000",
    });
    expect(data?.addresses).toHaveLength(1);
    expect(data?.orders).toHaveLength(1);
    expect(data?.wishlist[0]?.slug).toBe(`kvkk-urunu-${tag}`);
    expect(data?.dealer).toMatchObject({ companyName: "Gizli Ltd." });
    expect(data?.stockAlerts).toHaveLength(1);
  });

  it("teslim edilmiş ödenmiş siparişi açık sipariş saymaz", async () => {
    expect(await privacy.openOrderCount(userId)).toBe(0);
  });

  it("hesabı anonimleştirir: kişisel veriler silinir, sipariş kaydı korunur", async () => {
    await privacy.anonymize(userId);

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { customer: true },
    });
    expect(user.email).toBe(`silinmis-${userId}@anonim.invalid`);
    expect(user).toMatchObject({
      firstName: "Silinmiş",
      phone: null,
      passwordHash: null,
      isActive: false,
    });
    expect(user.anonymizedAt).not.toBeNull();
    expect(user.customer).toMatchObject({
      companyName: null,
      taxNumber: null,
      b2bStatus: "NONE",
    });

    expect(await db.address.count({ where: { userId } })).toBe(0);
    expect(await db.wishlistItem.count({ where: { userId } })).toBe(0);
    expect(await db.cart.count({ where: { userId } })).toBe(0);
    expect(await db.backInStockSubscription.count({ where: { email } })).toBe(
      0,
    );

    // Yasal saklama: sipariş kayıtları durur.
    expect(await db.order.count({ where: { userId } })).toBe(1);
  });

  it("açık siparişi olan kullanıcıyı tespit eder", async () => {
    const other = await db.user.create({
      data: { email: `acik-${tag}@example.com`, firstName: "A", lastName: "B" },
    });
    await db.order.create({
      data: {
        orderNumber: `O${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
        lookupToken: randomUUID(),
        userId: other.id,
        guestEmail: other.email,
        status: "SHIPPED",
        paymentStatus: "PAID",
        subtotal: "10.00",
        grandTotal: "10.00",
        shippingAddress: {},
        billingAddress: {},
      },
    });

    expect(await privacy.openOrderCount(other.id)).toBe(1);
  });

  it("adres defterinde varsayılan bayrağı tek adreste tutar", async () => {
    const user = await db.user.create({
      data: {
        email: `adres-${tag}@example.com`,
        firstName: "A",
        lastName: "B",
      },
    });
    const addresses = new PrismaAddressRepository(() => db);
    const base = {
      title: "Ev",
      firstName: "A",
      lastName: "B",
      phone: "05550000000",
      city: "İstanbul",
      district: "Kadıköy",
      neighborhood: null,
      addressLine: "Örnek Sokak No: 1",
      postalCode: null,
      invoiceType: "INDIVIDUAL" as const,
      nationalId: null,
      companyName: null,
      taxNumber: null,
      taxOffice: null,
      isDefaultBilling: false,
    };

    await addresses.create(user.id, { ...base, isDefaultShipping: true });
    const second = await addresses.create(user.id, {
      ...base,
      title: "İş",
      isDefaultShipping: true,
    });

    const list = await addresses.list(user.id);
    expect(list.filter((a) => a.isDefaultShipping)).toHaveLength(1);
    expect(list.find((a) => a.isDefaultShipping)?.id).toBe(second);
  });
});
