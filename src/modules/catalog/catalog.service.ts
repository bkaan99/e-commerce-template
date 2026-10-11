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

    return ids
      .map((id) => byId.get(id))
      .filter((record): record is ProductCardRecord => record !== undefined)
      .map((record) => this.toCard(record, identity));
  }

  async getProductBySlug(
    slug: string,
    identity: PricingIdentity = ANONYMOUS,
  ): Promise<ProductDetail> {
    const record = await this.repository.findDetailBySlug(slug);
    if (!record) throw new NotFoundError("Ürün");

    const categories = await this.repository.listCategories();
    return this.toDetail(record, categories, identity);
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

  private unitPrice(
    variant: VariantRecord,
    identity: PricingIdentity,
  ): Decimal {
    return this.priceResolver.resolveUnitPrice(variant, {
      customerGroupId: identity.customerGroupId,
      quantity: 1,
    });
  }

  private toCard(
    record: ProductCardRecord,
    identity: PricingIdentity,
  ): ProductCard {
    const prices = record.variants.map((v) => this.unitPrice(v, identity));
    const min = prices.reduce((a, b) => (b.lt(a) ? b : a));
    const max = prices.reduce((a, b) => (b.gt(a) ? b : a));
    const cheapest = record.variants[prices.findIndex((p) => p.eq(min))]!;

    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      brandName: record.brandName,
      imageUrl: record.imageUrl ?? PLACEHOLDER_IMAGE,
      imageAlt: record.imageAlt ?? record.name,
      price: min.toFixed(2),
      compareAtPrice: cheapest.compareAtPrice?.gt(min)
        ? cheapest.compareAtPrice.toFixed(2)
        : null,
      hasPriceRange: !min.eq(max),
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
    identity: PricingIdentity,
  ): ProductDetail {
    const variants: VariantView[] = record.variants.map((variant) => {
      const stock = {
        trackInventory: record.trackInventory,
        stockQuantity: variant.stockQuantity,
        reservedQuantity: variant.reservedQuantity,
      };
      const price = this.unitPrice(variant, identity);

      return {
        id: variant.id,
        sku: variant.sku,
        price: price.toFixed(2),
        compareAtPrice: variant.compareAtPrice?.gt(price)
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
