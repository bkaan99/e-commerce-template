import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@/shared/events/event-bus";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaProductAdminRepository } from "../catalog/product-admin.repository";
import { ProductAdminService } from "../catalog/product-admin.service";
import { PrismaBulkUpdateRepository } from "./bulk-update.repository";
import { BulkUpdateService } from "./bulk-update.service";
import { PrismaImportRepository } from "./import.repository";
import { ProductImportService } from "./product-import.service";

describe("ürün içe aktarma ve toplu güncelleme (veritabanı)", () => {
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const categorySlug = `import-${tag.toLowerCase()}`;
  const actor = { userId: null as unknown as string, ip: null };
  let db: PrismaClient;
  let importer: ProductImportService;
  let bulk: BulkUpdateService;
  const audit = { log: async () => {}, purgeOlderThan: async () => 0 };

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    await db.category.create({
      data: { name: `Import ${tag}`, slug: categorySlug },
    });
    const events = new InMemoryEventBus();
    importer = new ProductImportService(
      new ProductAdminService(
        new PrismaProductAdminRepository(() => db),
        events,
        audit,
      ),
      new PrismaImportRepository(() => db),
    );
    bulk = new BulkUpdateService(
      new PrismaBulkUpdateRepository(() => db),
      events,
      audit,
    );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const csv = [
    "urun_adi;kategori;durum;sku;fiyat;stok;secenek1;deger1",
    `Import Ürünü ${tag};${categorySlug};aktif;IMP-${tag}-S;100,50;4;Beden;S`,
    `Import Ürünü ${tag};${categorySlug};;IMP-${tag}-M;100,50;0;Beden;M`,
  ].join("\n");

  it("ürünü varyantlarıyla oluşturur; ikinci kez içe aktarmayı reddeder", async () => {
    const first = await importer.run(csv, { dryRun: false }, actor);
    expect(first).toMatchObject({ created: 1, issues: [] });

    const product = await db.product.findFirst({
      where: { name: `Import Ürünü ${tag}` },
      include: { variants: true, options: { include: { values: true } } },
    });
    expect(product?.status).toBe("ACTIVE");
    expect(product?.variants).toHaveLength(2);
    expect(product?.options[0]?.values).toHaveLength(2);

    const second = await importer.run(csv, { dryRun: false }, actor);
    expect(second.created).toBe(0);
    expect(second.issues).toHaveLength(1);
  });

  it("SKU ile fiyat ve stok günceller", async () => {
    const report = await bulk.run(
      `sku;fiyat;stok\nimp-${tag}-s;120;9\nIMP-${tag}-M;;3`,
      { dryRun: false },
      actor,
    );
    expect(report).toMatchObject({ updated: 2, issues: [] });

    const variants = await db.productVariant.findMany({
      where: { sku: { startsWith: `IMP-${tag}` } },
      orderBy: { sku: "asc" },
    });
    expect(variants.map((v) => [v.price.toFixed(2), v.stockQuantity])).toEqual([
      ["100.50", 3],
      ["120.00", 9],
    ]);
  });
});
