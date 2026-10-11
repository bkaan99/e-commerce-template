import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaProductAdminRepository } from "./product-admin.repository";
import { productInputSchema, type ProductInput } from "./product.schema";

describe("PrismaProductAdminRepository", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let repo: PrismaProductAdminRepository;
  let categoryId: string;

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    repo = new PrismaProductAdminRepository(() => db);
    const category = await db.category.create({
      data: { name: "Admin Test", slug: `admin-test-${tag}` },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  let counter = 0;
  /** SKU'lar global benzersiz olduğundan her ürün için ayrı önek üretilir. */
  const nextPrefix = () => `A-${tag}-${++counter}`;

  const build = (
    overrides: Record<string, unknown> = {},
    prefix = nextPrefix(),
  ): ProductInput =>
    productInputSchema.parse({
      name: `Admin Ürünü ${tag}`,
      status: "ACTIVE",
      categoryId,
      taxRate: 20,
      options: [
        { name: "Renk", values: ["Siyah", "Beyaz"] },
        { name: "Beden", values: ["S", "M"] },
      ],
      variants: [
        {
          sku: `${prefix}-SS`,
          price: "100",
          stockQuantity: 5,
          optionValues: { Renk: "Siyah", Beden: "S" },
        },
        {
          sku: `${prefix}-BM`,
          price: "110",
          stockQuantity: 3,
          optionValues: { Renk: "Beyaz", Beden: "M" },
        },
      ],
      images: [
        {
          url: "/img/siyah.jpg",
          forOption: { option: "Renk", value: "Siyah" },
        },
        { url: "/img/genel.jpg" },
      ],
      ...overrides,
    });

  it("seçenekler, varyantlar ve görselleriyle ürün oluşturur", async () => {
    const id = await repo.create(build(), `admin-urunu-${tag}`);
    const product = await repo.findForEdit(id);

    expect(product?.options).toEqual([
      { name: "Renk", values: ["Siyah", "Beyaz"] },
      { name: "Beden", values: ["S", "M"] },
    ]);
    expect(product?.variants).toHaveLength(2);
    expect(product?.variants[0]!.optionValues).toEqual({
      Renk: "Siyah",
      Beden: "S",
    });
    expect(product?.images[0]!.forOption).toEqual({
      option: "Renk",
      value: "Siyah",
    });
  });

  it("güncellemede mevcut varyantı korur, yenisini ekler, listede olmayanı pasifleştirir", async () => {
    const prefix = nextPrefix();
    const id = await repo.create(build({}, prefix), `admin-guncelle-${tag}`);
    const created = await repo.findForEdit(id);
    const first = created!.variants[0]!;

    const updated = build(
      {
        options: [
          { name: "Renk", values: ["Siyah", "Beyaz", "Kırmızı"] },
          { name: "Beden", values: ["S", "M"] },
        ],
        variants: [
          {
            id: first.id,
            sku: first.sku,
            price: "150",
            stockQuantity: 9,
            optionValues: first.optionValues,
          },
          {
            sku: `${prefix}-KS`,
            price: "120",
            stockQuantity: 2,
            optionValues: { Renk: "Kırmızı", Beden: "S" },
          },
        ],
        images: [],
      },
      prefix,
    );
    await repo.update(id, updated, `admin-guncelle-${tag}`);

    const product = await repo.findForEdit(id);
    const bySku = new Map(product!.variants.map((v) => [v.sku, v]));

    expect(bySku.get(first.sku)).toMatchObject({
      price: "150.00",
      stockQuantity: 9,
      isActive: true,
    });
    expect(bySku.get(`${prefix}-KS`)).toMatchObject({
      stockQuantity: 2,
      isActive: true,
    });
    // Listeden çıkarılan varyant silinmez, pasifleşir.
    expect(bySku.get(`${prefix}-BM`)).toMatchObject({ isActive: false });
    expect(product!.options[0]!.values).toContain("Kırmızı");
    expect(product!.images).toHaveLength(0);
  });

  it("slug çakışmasını ve hariç tutulan kimliği doğru bildirir", async () => {
    const id = await repo.create(build(), `slug-test-${tag}`);
    expect(await repo.slugTaken(`slug-test-${tag}`)).toBe(true);
    expect(await repo.slugTaken(`slug-test-${tag}`, id)).toBe(false);
  });

  it("liste aramasıyla SKU üzerinden ürün bulur", async () => {
    const prefix = nextPrefix();
    await repo.create(build({}, prefix), `liste-${tag}`);
    const result = await repo.list({
      search: `${prefix}-SS`,
      page: 1,
      pageSize: 10,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0]!.variantCount).toBe(2);
  });
});
