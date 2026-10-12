import type Decimal from "decimal.js";
import { NotFoundError } from "@/shared/errors";
import { toDecimal } from "@/shared/money";
import { availableQuantity, isInStock } from "./availability";
import type {
  CatalogRepository,
  ListingRow,
  ProductCardRecord,
  ProductDetailRecord,
  VariantRecord,
} from "./catalog.repository";
import type {
  CategoryNode,
  Facet,
  ProductCard,
  ProductDetail,
  ProductListQuery,
  ProductListResult,
  SortOption,
  VariantView,
} from "./catalog.types";
import {
  buildBreadcrumbs,
  buildCategoryTree,
  collectDescendantIds,
  type CategoryTreeNode,
} from "./category-tree";
import { RetailPriceResolver, type PriceResolver } from "./pricing";

export const PLACEHOLDER_IMAGE = "/placeholder.svg";

export interface PricingIdentity {
  customerGroupId: string | null;
  /** false ise fiyatlar gizlenir (yalnızca-B2B modunda girişsiz ziyaretçi). */
  pricesVisible?: boolean;
}

const ANONYMOUS: PricingIdentity = { customerGroupId: null };

/** Fiyat aralığı filtresi. Sınırlar dahildir. */
export function filterByPrice<T extends { minPrice: Decimal }>(
  rows: readonly T[],
  min?: number,
  max?: number,
): T[] {
  return rows.filter(
    (row) =>
      (min === undefined || row.minPrice.gte(min)) &&
      (max === undefined || row.minPrice.lte(max)),
  );
}

export function sortListing(
  rows: readonly ListingRow[],
  sort: SortOption,
): ListingRow[] {
  const copy = [...rows];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.minPrice.comparedTo(b.minPrice));
    case "price-desc":
      return copy.sort((a, b) => b.minPrice.comparedTo(a.minPrice));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    case "newest":
    default:
      return copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly priceResolver: PriceResolver = new RetailPriceResolver(),
  ) {}

  async getCategories(): Promise<CategoryNode[]> {
    return this.repository.listCategories();
  }

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    return buildCategoryTree(await this.repository.listCategories());
  }

  async getCategoryBySlug(slug: string): Promise<{
    category: CategoryNode;
    breadcrumbs: { name: string; slug: string }[];
  }> {
    const categories = await this.repository.listCategories();
    const category = categories.find((item) => item.slug === slug);
    if (!category) throw new NotFoundError("Kategori");

    return {
      category,
      breadcrumbs: buildBreadcrumbs(categories, category.id),
    };
  }

  async list(
    query: ProductListQuery,
    identity: PricingIdentity = ANONYMOUS,
  ): Promise<ProductListResult> {
    let categoryIds: string[] | undefined;
    if (query.categorySlug) {
      const categories = await this.repository.listCategories();
      const category = categories.find((c) => c.slug === query.categorySlug);
      if (!category) throw new NotFoundError("Kategori");
      categoryIds = collectDescendantIds(categories, category.id);
    }

    const baseFilter = { categoryIds, search: query.search };

    const [rows, attributeFacetRecords, brandRecords] = await Promise.all([
      this.repository.searchListing({
        ...baseFilter,
        brandSlugs: query.brandSlugs,
        attributeFilters: query.attributeFilters,
      }),
      this.repository.countAttributeFacets({
        ...baseFilter,
        brandSlugs: query.brandSlugs,
      }),
      this.repository.countBrands(baseFilter),
    ]);

    const priced = filterByPrice(rows, query.minPrice, query.maxPrice);
    const sorted = sortListing(priced, query.sort);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.pageSize;
    const pageIds = sorted
      .slice(start, start + query.pageSize)
      .map((r) => r.id);

    const cards = await this.getCardsInOrder(pageIds, identity);

    return {
      items: cards,
      total,
      page,
      pageSize: query.pageSize,
      totalPages,
      attributeFacets: this.buildAttributeFacets(attributeFacetRecords),
      brandFacet:
        brandRecords.length > 0
          ? {
              slug: "marka",
              name: "Marka",
              values: brandRecords
                .map((b) => ({ value: b.name, slug: b.slug, count: b.count }))
                .sort((a, b) => a.value.localeCompare(b.value, "tr")),
            }
          : null,
    };
  }

  async getCardsInOrder(
    ids: string[],
    identity: PricingIdentity = ANONYMOUS,
  ): Promise<ProductCard[]> {
    const records = await this.repository.findCards(ids);
    const byId = new Map(records.map((record) => [record.id, record]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((record): record is ProductCardRecord => record !== undefined);

    const prices = await this.resolvePrices(
      ordered.flatMap((record) => record.variants),
      identity,
    );
    return ordered.map((record) => this.toCard(record, prices, identity));
  }

  async getProductBySlug(
    slug: string,
    identity: PricingIdentity = ANONYMOUS,
  ): Promise<ProductDetail> {
    const record = await this.repository.findDetailBySlug(slug);
    if (!record) throw new NotFoundError("Ürün");

    const [categories, prices] = await Promise.all([
      this.repository.listCategories(),
      this.resolvePrices(record.variants, identity),
    ]);
    return this.toDetail(record, categories, prices, identity);
  }

  /** Elle seçilen ürünler öncelikli; eksik kalanı aynı kategoriden tamamlanır. */
  async getRelatedProducts(
    productId: string,
    categoryId: string,
    limit = 4,
    identity: PricingIdentity = ANONYMOUS,
  ): Promise<ProductCard[]> {
    const manual = await this.repository.findManualRelatedIds(productId, limit);
    let ids = manual;

    if (ids.length < limit) {
      const similar = await this.repository.findSimilarIds(
        productId,
        categoryId,
        limit,
      );
      ids = [...new Set([...manual, ...similar])].slice(0, limit);
    }

    return this.getCardsInOrder(ids, identity);
  }

  async getHomepageProducts(
    limit = 8,
    identity: PricingIdentity = ANONYMOUS,
  ): Promise<ProductCard[]> {
    const ids = await this.repository.findFeaturedIds(limit);
    return this.getCardsInOrder(ids, identity);
  }

  listProductSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listActiveProductSlugs();
  }

  async findRedirect(path: string): Promise<string | null> {
    const redirect = await this.repository.findRedirect(path);
    return redirect?.toPath ?? null;
  }

  private buildAttributeFacets(
    records: Awaited<ReturnType<CatalogRepository["countAttributeFacets"]>>,
  ): Facet[] {
    const grouped = new Map<
      string,
      { name: string; position: number; values: Facet["values"] }
    >();

    for (const record of records) {
      const entry = grouped.get(record.attributeSlug) ?? {
        name: record.attributeName,
        position: record.attributePosition,
        values: [],
      };
      entry.values.push({
        value: record.value,
        slug: record.valueSlug,
        count: record.count,
      });
      grouped.set(record.attributeSlug, entry);
    }

    return [...grouped.entries()]
      .sort((a, b) => a[1].position - b[1].position)
      .map(([slug, entry]) => ({
        slug,
        name: entry.name,
        values: entry.values.sort((a, b) =>
          a.value.localeCompare(b.value, "tr"),
        ),
      }));
  }

  /** Tüm varyantların birim fiyatı (adet 1) tek çağrıyla çözülür. */
  private resolvePrices(
    variants: readonly VariantRecord[],
    identity: PricingIdentity,
  ): Promise<Map<string, Decimal>> {
    return this.priceResolver.resolveUnitPrices(
      variants.map((variant) => ({
        variantId: variant.id,
        listPrice: variant.price,
        quantity: 1,
      })),
      { customerGroupId: identity.customerGroupId },
    );
  }

  private toCard(
    record: ProductCardRecord,
    priceMap: Map<string, Decimal>,
    identity: PricingIdentity,
  ): ProductCard {
    const prices = record.variants.map(
      (v) => priceMap.get(v.id) ?? toDecimal(v.price),
    );
    const min = prices.reduce((a, b) => (b.lt(a) ? b : a));
    const max = prices.reduce((a, b) => (b.gt(a) ? b : a));
    const cheapest = record.variants[prices.findIndex((p) => p.eq(min))]!;
    const priceVisible = identity.pricesVisible !== false;

    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      brandName: record.brandName,
      imageUrl: record.imageUrl ?? PLACEHOLDER_IMAGE,
      imageAlt: record.imageAlt ?? record.name,
      priceVisible,
      price: priceVisible ? min.toFixed(2) : "0.00",
      compareAtPrice:
        priceVisible && cheapest.compareAtPrice?.gt(min)
          ? cheapest.compareAtPrice.toFixed(2)
          : null,
      hasPriceRange: priceVisible && !min.eq(max),
      currency: cheapest.currency,
      inStock: record.variants.some((variant) =>
        isInStock({
          trackInventory: record.trackInventory,
          stockQuantity: variant.stockQuantity,
          reservedQuantity: variant.reservedQuantity,
        }),
      ),
    };
  }

  private toDetail(
    record: ProductDetailRecord,
    categories: readonly CategoryNode[],
    priceMap: Map<string, Decimal>,
    identity: PricingIdentity,
  ): ProductDetail {
    const priceVisible = identity.pricesVisible !== false;
    const variants: VariantView[] = record.variants.map((variant) => {
      const stock = {
        trackInventory: record.trackInventory,
        stockQuantity: variant.stockQuantity,
        reservedQuantity: variant.reservedQuantity,
      };
      const price = priceMap.get(variant.id) ?? toDecimal(variant.price);

      return {
        id: variant.id,
        sku: variant.sku,
        price: priceVisible ? price.toFixed(2) : "0.00",
        compareAtPrice:
          priceVisible && variant.compareAtPrice?.gt(price)
            ? toDecimal(variant.compareAtPrice).toFixed(2)
            : null,
        currency: variant.currency,
        inStock: isInStock(stock),
        availableQuantity: availableQuantity(stock),
        optionValueIds: variant.optionValueIds,
      };
    });

    const attributeMap = new Map<string, string[]>();
    for (const attribute of record.attributes) {
      const list = attributeMap.get(attribute.name) ?? [];
      list.push(attribute.value);
      attributeMap.set(attribute.name, list);
    }

    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
      priceVisible,
      categoryId: record.categoryId,
      brand: record.brand,
      breadcrumbs: buildBreadcrumbs(categories, record.categoryId),
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
      images:
        record.images.length > 0
          ? record.images.map((image) => ({
              url: image.url,
              alt: image.alt ?? record.name,
              optionValueId: image.optionValueId,
            }))
          : [{ url: PLACEHOLDER_IMAGE, alt: record.name, optionValueId: null }],
      options: record.options,
      variants,
      attributes: [...attributeMap.entries()].map(([name, values]) => ({
        name,
        values,
      })),
      taxRate: record.taxRate.toFixed(2),
    };
  }
}
