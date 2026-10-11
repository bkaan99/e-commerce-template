import type Decimal from "decimal.js";
import type { PrismaClient } from "@/shared/prisma-client";
import type { Prisma } from "../../../generated/prisma/client";
import type { CategoryNode } from "./catalog.types";

export interface ProductFilter {
  categoryIds?: string[];
  search?: string;
  brandSlugs: string[];
  attributeFilters: Record<string, string[]>;
}

export interface ListingRow {
  id: string;
  name: string;
  createdAt: Date;
  minPrice: Decimal;
}

export interface VariantRecord {
  id: string;
  sku: string;
  price: Decimal;
  compareAtPrice: Decimal | null;
  currency: string;
  stockQuantity: number;
  reservedQuantity: number;
  optionValueIds: string[];
}

export interface ProductCardRecord {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  trackInventory: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  variants: VariantRecord[];
}

export interface AttributeFacetRecord {
  attributeSlug: string;
  attributeName: string;
  attributePosition: number;
  valueSlug: string;
  value: string;
  valuePosition: number;
  count: number;
}

export interface BrandCountRecord {
  slug: string;
  name: string;
  count: number;
}

export interface ProductDetailRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  trackInventory: boolean;
  taxRate: Decimal;
  seoTitle: string | null;
  seoDescription: string | null;
  categoryId: string;
  brand: { name: string; slug: string } | null;
  images: {
    url: string;
    alt: string | null;
    optionValueId: string | null;
  }[];
  options: {
    id: string;
    name: string;
    values: { id: string; value: string }[];
  }[];
  variants: VariantRecord[];
  attributes: { name: string; value: string }[];
}

export interface CatalogRepository {
  listCategories(): Promise<CategoryNode[]>;
  searchListing(filter: ProductFilter): Promise<ListingRow[]>;
  findCards(ids: string[]): Promise<ProductCardRecord[]>;
  countAttributeFacets(
    filter: Omit<ProductFilter, "attributeFilters">,
  ): Promise<AttributeFacetRecord[]>;
  countBrands(
    filter: Omit<ProductFilter, "attributeFilters" | "brandSlugs">,
  ): Promise<BrandCountRecord[]>;
  findDetailBySlug(slug: string): Promise<ProductDetailRecord | null>;
  findManualRelatedIds(productId: string, limit: number): Promise<string[]>;
  findSimilarIds(
    productId: string,
    categoryId: string,
    limit: number,
  ): Promise<string[]>;
  findRedirect(path: string): Promise<{ toPath: string } | null>;
  /** Öne çıkan ürünler; yetersizse en yeniler tamamlar. */
  findFeaturedIds(limit: number): Promise<string[]>;
  /** Sitemap için yayındaki tüm ürün slug'ları. */
  listActiveProductSlugs(): Promise<{ slug: string; updatedAt: Date }[]>;
}

const insensitive = "insensitive" as const;

function buildWhere(filter: Partial<ProductFilter>): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (filter.search) {
    const term = filter.search;
    and.push({
      OR: [
        { name: { contains: term, mode: insensitive } },
        { description: { contains: term, mode: insensitive } },
        { brand: { name: { contains: term, mode: insensitive } } },
        { variants: { some: { sku: { contains: term, mode: insensitive } } } },
      ],
    });
  }

  for (const [attributeSlug, valueSlugs] of Object.entries(
    filter.attributeFilters ?? {},
  )) {
    and.push({
      attributes: {
        some: {
          attributeValue: {
            slug: { in: valueSlugs },
            attribute: { slug: attributeSlug },
          },
        },
      },
    });
  }

  return {
    status: "ACTIVE",
    variants: { some: { isActive: true } },
    ...(filter.categoryIds ? { categoryId: { in: filter.categoryIds } } : {}),
    ...(filter.brandSlugs?.length
      ? { brand: { slug: { in: filter.brandSlugs } } }
      : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

const variantSelect = {
  where: { isActive: true },
  orderBy: { price: "asc" },
  select: {
    id: true,
    sku: true,
    price: true,
    compareAtPrice: true,
    currency: true,
    stockQuantity: true,
    reservedQuantity: true,
    optionValues: { select: { optionValueId: true } },
  },
} as const;

type VariantRow = {
  id: string;
  sku: string;
  price: Decimal;
  compareAtPrice: Decimal | null;
  currency: string;
  stockQuantity: number;
  reservedQuantity: number;
  optionValues: { optionValueId: string }[];
};

function toVariantRecord(row: VariantRow): VariantRecord {
  return {
    id: row.id,
    sku: row.sku,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    currency: row.currency,
    stockQuantity: row.stockQuantity,
    reservedQuantity: row.reservedQuantity,
    optionValueIds: row.optionValues.map((item) => item.optionValueId),
  };
}

export class PrismaCatalogRepository implements CatalogRepository {
  /** İstemci tembel verilir; env doğrulaması yalnızca ilk sorguda çalışır. */
  constructor(private readonly db: () => PrismaClient) {}

  async listCategories(): Promise<CategoryNode[]> {
    const rows = await this.db().category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      sortOrder: row.sortOrder,
    }));
  }

  async searchListing(filter: ProductFilter): Promise<ListingRow[]> {
    const rows = await this.db().product.findMany({
      where: buildWhere(filter),
      select: {
        id: true,
        name: true,
        createdAt: true,
        variants: { where: { isActive: true }, select: { price: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      minPrice: row.variants.reduce(
        (min, variant) => (variant.price.lt(min) ? variant.price : min),
        row.variants[0]!.price,
      ),
    }));
  }

  async findCards(ids: string[]): Promise<ProductCardRecord[]> {
    if (ids.length === 0) return [];

    const rows = await this.db().product.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        name: true,
        trackInventory: true,
        brand: { select: { name: true } },
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: { url: true, alt: true },
        },
        variants: variantSelect,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      brandName: row.brand?.name ?? null,
      trackInventory: row.trackInventory,
      imageUrl: row.images[0]?.url ?? null,
      imageAlt: row.images[0]?.alt ?? null,
      variants: row.variants.map(toVariantRecord),
    }));
  }

  async countAttributeFacets(
    filter: Omit<ProductFilter, "attributeFilters">,
  ): Promise<AttributeFacetRecord[]> {
    const where = buildWhere({ ...filter, attributeFilters: {} });

    const grouped = await this.db().productAttributeValue.groupBy({
      by: ["attributeValueId"],
      where: {
        product: where,
        attributeValue: { attribute: { isFilterable: true } },
      },
      _count: { _all: true },
    });
    if (grouped.length === 0) return [];

    const values = await this.db().attributeValue.findMany({
      where: { id: { in: grouped.map((row) => row.attributeValueId) } },
      include: { attribute: true },
    });
    const counts = new Map(
      grouped.map((row) => [row.attributeValueId, row._count._all]),
    );

    return values.map((value) => ({
      attributeSlug: value.attribute.slug,
      attributeName: value.attribute.name,
      attributePosition: value.attribute.position,
      valueSlug: value.slug,
      value: value.value,
      valuePosition: value.position,
      count: counts.get(value.id) ?? 0,
    }));
  }

  async countBrands(
    filter: Omit<ProductFilter, "attributeFilters" | "brandSlugs">,
  ): Promise<BrandCountRecord[]> {
    const where = buildWhere({
      ...filter,
      brandSlugs: [],
      attributeFilters: {},
    });

    const grouped = await this.db().product.groupBy({
      by: ["brandId"],
      where: { ...where, brandId: { not: null } },
      _count: { _all: true },
    });
    if (grouped.length === 0) return [];

    const brands = await this.db().brand.findMany({
      where: { id: { in: grouped.map((row) => row.brandId!) } },
    });
    const counts = new Map(
      grouped.map((row) => [row.brandId, row._count._all]),
    );

    return brands.map((brand) => ({
      slug: brand.slug,
      name: brand.name,
      count: counts.get(brand.id) ?? 0,
    }));
  }

  async findDetailBySlug(slug: string): Promise<ProductDetailRecord | null> {
    const row = await this.db().product.findFirst({
      where: { slug, status: "ACTIVE" },
      include: {
        brand: true,
        images: { orderBy: { position: "asc" } },
        options: {
          orderBy: { position: "asc" },
          include: { values: { orderBy: { position: "asc" } } },
        },
        variants: variantSelect,
        attributes: {
          include: { attributeValue: { include: { attribute: true } } },
        },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      trackInventory: row.trackInventory,
      taxRate: row.taxRate,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      categoryId: row.categoryId,
      brand: row.brand ? { name: row.brand.name, slug: row.brand.slug } : null,
      images: row.images.map((image) => ({
        url: image.url,
        alt: image.alt,
        optionValueId: image.optionValueId,
      })),
      options: row.options.map((option) => ({
        id: option.id,
        name: option.name,
        values: option.values.map((value) => ({
          id: value.id,
          value: value.value,
        })),
      })),
      variants: row.variants.map(toVariantRecord),
      attributes: row.attributes.map((item) => ({
        name: item.attributeValue.attribute.name,
        value: item.attributeValue.value,
      })),
    };
  }

  async findManualRelatedIds(
    productId: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.db().relatedProduct.findMany({
      where: { productId, relatedProduct: { status: "ACTIVE" } },
      orderBy: { position: "asc" },
      take: limit,
      select: { relatedProductId: true },
    });
    return rows.map((row) => row.relatedProductId);
  }

  async findSimilarIds(
    productId: string,
    categoryId: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.db().product.findMany({
      where: {
        id: { not: productId },
        categoryId,
        status: "ACTIVE",
        variants: { some: { isActive: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findRedirect(path: string): Promise<{ toPath: string } | null> {
    const row = await this.db().redirect.findUnique({
      where: { fromPath: path },
      select: { toPath: true },
    });
    return row;
  }

  async findFeaturedIds(limit: number): Promise<string[]> {
    const base = {
      status: "ACTIVE" as const,
      variants: { some: { isActive: true } },
    };
    const featured = await this.db().product.findMany({
      where: { ...base, isFeatured: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true },
    });
    if (featured.length >= limit) return featured.map((row) => row.id);

    const filler = await this.db().product.findMany({
      where: { ...base, id: { notIn: featured.map((row) => row.id) } },
      orderBy: { createdAt: "desc" },
      take: limit - featured.length,
      select: { id: true },
    });
    return [...featured, ...filler].map((row) => row.id);
  }

  listActiveProductSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.db().product.findMany({
      where: { status: "ACTIVE", variants: { some: { isActive: true } } },
      select: { slug: true, updatedAt: true },
    });
  }
}
