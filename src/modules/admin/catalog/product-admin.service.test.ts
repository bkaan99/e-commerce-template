import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/shared/audit/audit-logger";
import { InMemoryEventBus } from "@/shared/events/event-bus";
import type {
  EditableProduct,
  ProductAdminRepository,
} from "./product-admin.repository";
import {
  ProductAdminService,
  ProductValidationError,
} from "./product-admin.service";
import type { ProductInput } from "./product.schema";

const actor = { userId: "staff", ip: null };

const valid = {
  name: "Basic Tişört",
  status: "ACTIVE",
  categoryId: "cat1",
  taxRate: 20,
  options: [{ name: "Beden", values: ["S", "M"] }],
  variants: [
    {
      sku: "T-S",
      price: "100",
      stockQuantity: 0,
      optionValues: { Beden: "S" },
    },
    {
      sku: "T-M",
      price: "100",
      stockQuantity: 4,
      optionValues: { Beden: "M" },
    },
  ],
};

class FakeRepo implements ProductAdminRepository {
  taken = new Set<string>();
  created: { input: ProductInput; slug: string }[] = [];
  updated: { id: string; slug: string; input: ProductInput }[] = [];
  redirects: [string, string][] = [];
  existing: EditableProduct | null = null;

  async list() {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
  async findForEdit() {
    return this.existing;
  }
  async references() {
    return { categories: [], brands: [], attributes: [] };
  }
  async slugTaken(slug: string) {
    return this.taken.has(slug);
  }
  async create(input: ProductInput, slug: string) {
    this.created.push({ input, slug });
    return "p1";
  }
  async update(id: string, input: ProductInput, slug: string) {
    this.updated.push({ id, input, slug });
  }
  async addRedirect(from: string, to: string) {
    this.redirects.push([from, to]);
  }
}

const existingProduct = (): EditableProduct => ({
  id: "p1",
  name: "Basic Tişört",
  slug: "basic-tisort",
  description: null,
  status: "ACTIVE",
  categoryId: "cat1",
  brandId: null,
  taxRate: "20.00",
  trackInventory: true,
  isFeatured: false,
  desi: null,
  weightGram: null,
  seoTitle: null,
  seoDescription: null,
  attributeValueIds: [],
  options: [{ name: "Beden", values: ["S", "M"] }],
  variants: [
    {
      id: "v1",
      sku: "T-S",
      barcode: null,
      price: "100.00",
      compareAtPrice: null,
      stockQuantity: 0,
      reservedQuantity: 0,
      isActive: true,
      optionValues: { Beden: "S" },
    },
  ],
  images: [],
});

describe("ProductAdminService", () => {
  let repo: FakeRepo;
  let audit: AuditEntry[];
  let events: InMemoryEventBus;
  let service: ProductAdminService;

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    events = new InMemoryEventBus();
    service = new ProductAdminService(repo, events, {
      log: async (entry) => void audit.push(entry),
      purgeOlderThan: async () => 0,
    });
  });

  it("addan benzersiz slug üretir ve denetim kaydı yazar", async () => {
    repo.taken = new Set(["basic-tisort"]);

    const id = await service.create(valid, actor);

    expect(id).toBe("p1");
    expect(repo.created[0]!.slug).toBe("basic-tisort-2");
    expect(audit[0]).toMatchObject({
      action: "product.create",
      entityId: "p1",
    });
  });

  it("elle verilen slug başka üründe kullanılıyorsa reddeder", async () => {
    repo.taken = new Set(["ozel-adres"]);
    await expect(
      service.create({ ...valid, slug: "Özel Adres" }, actor),
    ).rejects.toThrow("başka bir üründe");
  });

  it("geçersiz girdide alan hatalarıyla ProductValidationError fırlatır", async () => {
    const error = await service
      .create(
        { ...valid, variants: [{ ...valid.variants[0], price: "abc" }] },
        actor,
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProductValidationError);
    expect(
      (error as ProductValidationError).fieldErrors["variants.0.price"],
    ).toBeDefined();
    expect(repo.created).toHaveLength(0);
  });

  it("slug değişince eski adresten yönlendirme kaydeder", async () => {
    repo.existing = existingProduct();

    await service.update("p1", { ...valid, slug: "yeni-adres" }, actor);

    expect(repo.updated[0]!.slug).toBe("yeni-adres");
    expect(repo.redirects).toEqual([
      ["/urun/basic-tisort", "/urun/yeni-adres"],
    ]);
  });

  it("slug boşsa mevcut adresi korur ve yönlendirme eklemez", async () => {
    repo.existing = existingProduct();

    await service.update("p1", valid, actor);

    expect(repo.updated[0]!.slug).toBe("basic-tisort");
    expect(repo.redirects).toHaveLength(0);
  });

  it("stoğu 0'dan artan varyant için stock.replenished yayınlar", async () => {
    repo.existing = existingProduct();
    const handler = vi.fn();
    events.subscribe("stock.replenished", handler);

    await service.update(
      "p1",
      {
        ...valid,
        variants: [
          {
            id: "v1",
            sku: "T-S",
            price: "100",
            stockQuantity: 7,
            optionValues: { Beden: "S" },
          },
        ],
      },
      actor,
    );

    expect(handler).toHaveBeenCalledWith({ variantId: "v1" });
  });

  it("zaten stokta olan varyant için olay yayınlamaz", async () => {
    const product = existingProduct();
    product.variants[0]!.stockQuantity = 3;
    repo.existing = product;
    const handler = vi.fn();
    events.subscribe("stock.replenished", handler);

    await service.update(
      "p1",
      {
        ...valid,
        variants: [
          {
            id: "v1",
            sku: "T-S",
            price: "100",
            stockQuantity: 9,
            optionValues: { Beden: "S" },
          },
        ],
      },
      actor,
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("bilinmeyen ürünü güncellemede NotFoundError verir", async () => {
    repo.existing = null;
    await expect(service.update("yok", valid, actor)).rejects.toThrow(
      "Ürün bulunamadı",
    );
  });
});
