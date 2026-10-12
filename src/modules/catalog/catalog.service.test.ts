import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type {
  CatalogRepository,
  ListingRow,
  ProductCardRecord,
  VariantRecord,
} from "./catalog.repository";
import { CatalogService, filterByPrice, sortListing } from "./catalog.service";
import type { CategoryNode, ProductListQuery } from "./catalog.types";
import type { PriceResolver } from "./pricing";

const row = (
  id: string,
  price: string,
  day: number,
  name = id,
): ListingRow => ({
  id,
  name,
  createdAt: new Date(2026, 0, day),
  minPrice: new Decimal(price),
});

const variant = (price: string, stock = 5): VariantRecord => ({
  id: `v-${price}`,
  sku: `SKU-${price}`,
  price: new Decimal(price),
  compareAtPrice: null,
  currency: "TRY",
  stockQuantity: stock,
  reservedQuantity: 0,
  optionValueIds: [],
});

function card(id: string, variants: VariantRecord[]): ProductCardRecord {
  return {
    id,
    slug: id,
    name: id,
    brandName: null,
    trackInventory: true,
    imageUrl: null,
    imageAlt: null,
    variants,
  };
}

const category = (id: string, parentId: string | null): CategoryNode => ({
  id,
  parentId,
  name: id,
  slug: id,
  description: null,
  imageUrl: null,
  seoTitle: null,
  seoDescription: null,
  sortOrder: 0,
});

class FakeRepository implements CatalogRepository {
  lastFilter: unknown;
  constructor(
    private readonly rows: ListingRow[],
    private readonly cards: ProductCardRecord[] = [],
    private readonly categories: CategoryNode[] = [],
  ) {}
  async listCategories() {
    return this.categories;
  }
  async searchListing(filter: unknown) {
    this.lastFilter = filter;
    return this.rows;
  }
  async findCards(ids: string[]) {
    return this.cards.filter((c) => ids.includes(c.id));
  }
  async countAttributeFacets() {
    return [
      {
        attributeSlug: "renk",
        attributeName: "Renk",
        attributePosition: 1,
        valueSlug: "mavi",
        value: "Mavi",
        valuePosition: 0,
        count: 2,
      },
    ];
  }
  async countBrands() {
    return [];
  }
  async findDetailBySlug() {
    return null;
  }
  async findManualRelatedIds() {
    return ["m1"];
  }
  async findSimilarIds() {
    return ["s1", "m1", "s2"];
  }
  async findRedirect() {
    return null;
  }
  async findFeaturedIds() {
    return ["f1"];
  }
  async listActiveProductSlugs() {
    return [];
  }
}

const baseQuery: ProductListQuery = {
  brandSlugs: [],
  attributeFilters: {},
  sort: "newest",
  page: 1,
  pageSize: 2,
};

describe("filterByPrice / sortListing", () => {
  const rows = [row("a", "100", 1), row("b", "300", 3), row("c", "200", 2)];

  it("fiyat aralığını sınırlar dahil uygular", () => {
    expect(filterByPrice(rows, 100, 200).map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterByPrice(rows, 250).map((r) => r.id)).toEqual(["b"]);
  });

  it("fiyata göre sıralar", () => {
    expect(sortListing(rows, "price-asc").map((r) => r.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(sortListing(rows, "price-desc").map((r) => r.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("en yeni ürünü başa alır", () => {
    expect(sortListing(rows, "newest").map((r) => r.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("isme göre Türkçe sıralar", () => {
    const names = [
      row("1", "1", 1, "Çanta"),
      row("2", "1", 1, "Ayakkabı"),
      row("3", "1", 1, "Zeytin"),
    ];
    expect(sortListing(names, "name").map((r) => r.name)).toEqual([
      "Ayakkabı",
      "Çanta",
      "Zeytin",
    ]);
  });
});

describe("CatalogService.list", () => {
  it("sayfalar ve toplam sayfa sayısını hesaplar", async () => {
    const repo = new FakeRepository(
      [row("a", "10", 1), row("b", "20", 2), row("c", "30", 3)],
      [
        card("a", [variant("10")]),
        card("b", [variant("20")]),
        card("c", [variant("30")]),
      ],
    );
    const service = new CatalogService(repo);

    const result = await service.list({
      ...baseQuery,
      sort: "price-asc",
      page: 2,
    });

    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
    expect(result.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("sayfa numarasını son sayfaya sıkıştırır", async () => {
    const repo = new FakeRepository(
      [row("a", "10", 1)],
      [card("a", [variant("10")])],
    );
    const result = await new CatalogService(repo).list({
      ...baseQuery,
      page: 99,
    });
    expect(result.page).toBe(1);
  });

  it("kategori ve alt kategorilerini filtreye ekler", async () => {
    const repo = new FakeRepository(
      [],
      [],
      [
        category("giyim", null),
        category("erkek", "giyim"),
        category("ev", null),
      ],
    );
    await new CatalogService(repo).list({
      ...baseQuery,
      categorySlug: "giyim",
    });

    const filter = repo.lastFilter as { categoryIds: string[] };
    expect(filter.categoryIds.sort()).toEqual(["erkek", "giyim"]);
  });

  it("bilinmeyen kategoride NotFoundError fırlatır", async () => {
    const service = new CatalogService(new FakeRepository([]));
    await expect(
      service.list({ ...baseQuery, categorySlug: "yok" }),
    ).rejects.toThrow("Kategori bulunamadı");
  });

  it("kartta en düşük fiyatı ve fiyat aralığını gösterir", async () => {
    const repo = new FakeRepository(
      [row("a", "10", 1)],
      [card("a", [variant("10"), variant("40")])],
    );
    const { items } = await new CatalogService(repo).list(baseQuery);

    expect(items[0]).toMatchObject({ price: "10.00", hasPriceRange: true });
  });

  it("hiçbir varyantta stok yoksa tükendi işaretler", async () => {
    const repo = new FakeRepository(
      [row("a", "10", 1)],
      [card("a", [variant("10", 0)])],
    );
    const { items } = await new CatalogService(repo).list(baseQuery);
    expect(items[0]!.inStock).toBe(false);
  });

  it("niteliklerden facet üretir", async () => {
    const repo = new FakeRepository([], []);
    const result = await new CatalogService(repo).list(baseQuery);

    expect(result.attributeFacets).toEqual([
      {
        slug: "renk",
        name: "Renk",
        values: [{ value: "Mavi", slug: "mavi", count: 2 }],
      },
    ]);
  });

  it("fiyatı PriceResolver üzerinden çözer", async () => {
    const doubling: PriceResolver = {
      resolveUnitPrices: async (requests) =>
        new Map(
          requests.map((r) => [
            r.variantId,
            new Decimal(String(r.listPrice)).times(2),
          ]),
        ),
    };
    const repo = new FakeRepository(
      [row("a", "10", 1)],
      [card("a", [variant("10")])],
    );
    const { items } = await new CatalogService(repo, doubling).list(baseQuery);
    expect(items[0]!.price).toBe("20.00");
  });
});

describe("CatalogService.getRelatedProducts", () => {
  it("elle seçilenleri öne alır, tekrarsız tamamlar", async () => {
    const repo = new FakeRepository(
      [],
      ["m1", "s1", "s2"].map((id) => card(id, [variant("10")])),
    );
    const related = await new CatalogService(repo).getRelatedProducts(
      "p",
      "c",
      3,
    );
    expect(related.map((r) => r.id)).toEqual(["m1", "s1", "s2"]);
  });
});
