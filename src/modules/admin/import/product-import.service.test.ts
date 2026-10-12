import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@/shared/events/event-bus";
import { ProductAdminService } from "../catalog/product-admin.service";
import type { ProductAdminRepository } from "../catalog/product-admin.repository";
import type { ProductInput } from "../catalog/product.schema";
import {
  ProductImportService,
  type ImportRepository,
} from "./product-import.service";

const actor = { userId: "staff", ip: null };

class FakeProducts implements ProductAdminRepository {
  created: { input: ProductInput; slug: string }[] = [];
  async list() {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
  async findForEdit() {
    return null;
  }
  async references() {
    return { categories: [], brands: [], attributes: [] };
  }
  async slugTaken() {
    return false;
  }
  async create(input: ProductInput, slug: string) {
    this.created.push({ input, slug });
    return `p${this.created.length}`;
  }
  async update() {}
  async addRedirect() {}
}

class FakeImportRepo implements ImportRepository {
  skus: string[] = [];
  slugs: string[] = [];
  async taxonomy() {
    return {
      categories: [{ id: "c1", name: "Erkek", slug: "erkek-giyim" }],
      brands: [{ id: "b1", name: "Nordik" }],
    };
  }
  async existingSkus() {
    return this.skus;
  }
  async existingSlugs() {
    return this.slugs;
  }
}

const HEADER =
  "urun_adi;kategori;marka;durum;sku;fiyat;stok;secenek1;deger1;secenek2;deger2";

describe("ProductImportService", () => {
  let products: FakeProducts;
  let repo: FakeImportRepo;
  let service: ProductImportService;

  beforeEach(() => {
    products = new FakeProducts();
    repo = new FakeImportRepo();
    service = new ProductImportService(
      new ProductAdminService(products, new InMemoryEventBus(), {
        log: async () => {},
        purgeOlderThan: async () => 0,
      }),
      repo,
    );
  });

  it("aynı ürünün satırlarını varyant olarak gruplar", async () => {
    const csv = [
      HEADER,
      "Basic Tişört;erkek-giyim;Nordik;aktif;TS-S-K;99,90;10;Beden;S;Renk;Kırmızı",
      "Basic Tişört;erkek-giyim;;;TS-M-K;99,90;4;Beden;M;Renk;Kırmızı",
      "Kazak;Erkek;;;KZ-1;250;3;;;;",
    ].join("\n");

    const report = await service.run(csv, { dryRun: false }, actor);

    expect(report).toMatchObject({ products: 2, created: 2, issues: [] });
    const tshirt = products.created[0]!.input;
    expect(tshirt.status).toBe("ACTIVE");
    expect(tshirt.brandId).toBe("b1");
    expect(tshirt.options).toEqual([
      { name: "Beden", values: ["S", "M"] },
      { name: "Renk", values: ["Kırmızı"] },
    ]);
    expect(tshirt.variants.map((v) => v.sku)).toEqual(["TS-S-K", "TS-M-K"]);
    expect(products.created[1]!.input.status).toBe("DRAFT");
  });

  it("önizlemede ürün oluşturmaz ama doğrular", async () => {
    const report = await service.run(
      `${HEADER}\nA Ürün;erkek-giyim;;;A-1;10;1;;;;`,
      { dryRun: true },
      actor,
    );
    expect(report).toMatchObject({ products: 1, created: 0, issues: [] });
    expect(products.created).toHaveLength(0);
  });

  it("mevcut SKU, mevcut ürün ve bilinmeyen kategoriyi raporlar; geçerli ürünleri yine de ekler", async () => {
    repo.skus = ["VAR-1"];
    repo.slugs = ["eski-urun"];
    const csv = [
      HEADER,
      "Yeni;erkek-giyim;;;YENI-1;10;1;;;;",
      "Çakışan;erkek-giyim;;;VAR-1;10;1;;;;",
      "Eski Ürün;erkek-giyim;;;E-1;10;1;;;;",
      "Kategorisiz;yok;;;K-1;10;1;;;;",
    ].join("\n");

    const report = await service.run(csv, { dryRun: false }, actor);

    expect(report.created).toBe(1);
    expect(report.issues.map((i) => i.row)).toEqual([3, 4, 5]);
    expect(report.issues[0]!.message).toContain("SKU zaten kayıtlı");
    expect(report.issues[2]!.message).toContain("Kategori bulunamadı");
  });

  it("doğrulama hatasını ilgili dosya satırıyla bildirir", async () => {
    const csv = [
      HEADER,
      "Ürün X;erkek-giyim;;;X-1;10;1;Beden;S;;",
      "Ürün X;erkek-giyim;;;X-2;abc;1;Beden;M;;",
    ].join("\n");
    const report = await service.run(csv, { dryRun: true }, actor);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ row: 3 });
    expect(report.issues[0]!.message).toContain("variants.1.price");
  });

  it("zorunlu sütun eksikse reddeder", async () => {
    await expect(
      service.run("urun_adi;sku\nA;1", { dryRun: true }, actor),
    ).rejects.toThrow("Eksik sütun");
  });
});
