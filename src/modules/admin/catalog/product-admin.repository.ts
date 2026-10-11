import type { Prisma } from "../../../../generated/prisma/client";
import type { PrismaClient } from "@/shared/prisma-client";
import type { ProductInput } from "./product.schema";

export interface ProductListQuery {
  search?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId?: string;
  page: number;
  pageSize: number;
}

export interface ProductListRow {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryName: string;
  variantCount: number;
  totalStock: number;
  minPrice: string | null;
  imageUrl: string | null;
  updatedAt: Date;
}

export interface ProductListResult {
  items: ProductListRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EditableProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId: string;
  brandId: string | null;
  taxRate: string;
  trackInventory: boolean;
  isFeatured: boolean;
  desi: string | null;
  weightGram: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  attributeValueIds: string[];
  options: { name: string; values: string[] }[];
  variants: {
    id: string;
    sku: string;
    barcode: string | null;
    price: string;
    compareAtPrice: string | null;
    stockQuantity: number;
    reservedQuantity: number;
    isActive: boolean;
    optionValues: Record<string, string>;
  }[];
  images: {
    url: string;
    alt: string | null;
    forOption: { option: string; value: string } | null;
  }[];
}

export interface FormReferences {
  categories: { id: string; label: string }[];
  brands: { id: string; name: string }[];
  attributes: {
    id: string;
    name: string;
    values: { id: string; value: string }[];
  }[];
}

export interface ProductAdminRepository {
  list(query: ProductListQuery): Promise<ProductListResult>;
  findForEdit(id: string): Promise<EditableProduct | null>;
  references(): Promise<FormReferences>;
  slugTaken(slug: string, excludeId?: string): Promise<boolean>;
  create(input: ProductInput, slug: string): Promise<string>;
  update(id: string, input: ProductInput, slug: string): Promise<void>;
  addRedirect(fromPath: string, toPath: string): Promise<void>;
}

export class PrismaProductAdminRepository implements ProductAdminRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async list(query: ProductListQuery): Promise<ProductListResult> {
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              {
                variants: {
                  some: { sku: { contains: search, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.db().product.count({ where }),
      this.db().product.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          category: { select: { name: true } },
          variants: { select: { price: true, stockQuantity: true } },
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { url: true },
          },
        },
      }),
    ]);

    return {
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        categoryName: row.category.name,
        variantCount: row.variants.length,
        totalStock: row.variants.reduce((sum, v) => sum + v.stockQuantity, 0),
        minPrice: row.variants.length
          ? row.variants
              .reduce(
                (min, v) => (v.price.lt(min) ? v.price : min),
                row.variants[0]!.price,
              )
              .toFixed(2)
          : null,
        imageUrl: row.images[0]?.url ?? null,
        updatedAt: row.updatedAt,
      })),
    };
  }

  async findForEdit(id: string): Promise<EditableProduct | null> {
    const row = await this.db().product.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: { position: "asc" },
          include: { values: { orderBy: { position: "asc" } } },
        },
        variants: {
          orderBy: { createdAt: "asc" },
          include: {
            optionValues: {
              include: { optionValue: { include: { option: true } } },
            },
          },
        },
        images: {
          orderBy: { position: "asc" },
          include: { optionValue: { include: { option: true } } },
        },
        attributes: { select: { attributeValueId: true } },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      categoryId: row.categoryId,
      brandId: row.brandId,
      taxRate: row.taxRate.toFixed(2),
      trackInventory: row.trackInventory,
      isFeatured: row.isFeatured,
      desi: row.desi?.toString() ?? null,
      weightGram: row.weightGram,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      attributeValueIds: row.attributes.map((a) => a.attributeValueId),
      options: row.options.map((option) => ({
        name: option.name,
        values: option.values.map((value) => value.value),
      })),
      variants: row.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price.toFixed(2),
        compareAtPrice: variant.compareAtPrice?.toFixed(2) ?? null,
        stockQuantity: variant.stockQuantity,
        reservedQuantity: variant.reservedQuantity,
        isActive: variant.isActive,
        optionValues: Object.fromEntries(
          variant.optionValues.map((link) => [
            link.optionValue.option.name,
            link.optionValue.value,
          ]),
        ),
      })),
      images: row.images.map((image) => ({
        url: image.url,
        alt: image.alt,
        forOption: image.optionValue
          ? {
              option: image.optionValue.option.name,
              value: image.optionValue.value,
            }
          : null,
      })),
    };
  }

  async references(): Promise<FormReferences> {
    const [categories, brands, attributes] = await Promise.all([
      this.db().category.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.db().brand.findMany({ orderBy: { name: "asc" } }),
      this.db().attribute.findMany({
        orderBy: { position: "asc" },
        include: { values: { orderBy: { position: "asc" } } },
      }),
    ]);

    const byId = new Map(categories.map((c) => [c.id, c]));
    const labelFor = (id: string): string => {
      const parts: string[] = [];
      let current = byId.get(id);
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        parts.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return parts.join(" › ");
    };

    return {
      categories: categories
        .map((c) => ({ id: c.id, label: labelFor(c.id) }))
        .sort((a, b) => a.label.localeCompare(b.label, "tr")),
      brands: brands.map((b) => ({ id: b.id, name: b.name })),
      attributes: attributes.map((a) => ({
        id: a.id,
        name: a.name,
        values: a.values.map((v) => ({ id: v.id, value: v.value })),
      })),
    };
  }

  async slugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.db().product.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return found !== null;
  }

  async create(input: ProductInput, slug: string): Promise<string> {
    return this.db().$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...this.productFields(input, slug),
          attributes: {
            create: input.attributeValueIds.map((attributeValueId) => ({
              attributeValueId,
            })),
          },
        },
        select: { id: true },
      });

      await this.syncOptionsVariantsImages(tx, product.id, input);
      return product.id;
    });
  }

  async update(id: string, input: ProductInput, slug: string): Promise<void> {
    await this.db().$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: this.productFields(input, slug),
      });

      await tx.productAttributeValue.deleteMany({ where: { productId: id } });
      if (input.attributeValueIds.length > 0) {
        await tx.productAttributeValue.createMany({
          data: input.attributeValueIds.map((attributeValueId) => ({
            productId: id,
            attributeValueId,
          })),
        });
      }

      await this.syncOptionsVariantsImages(tx, id, input);
    });
  }

  async addRedirect(fromPath: string, toPath: string): Promise<void> {
    if (fromPath === toPath) return;
    await this.db().redirect.upsert({
      where: { fromPath },
      update: { toPath },
      create: { fromPath, toPath },
    });
  }

  private productFields(input: ProductInput, slug: string) {
    return {
      name: input.name,
      slug,
      description: input.description,
      status: input.status,
      categoryId: input.categoryId,
      brandId: input.brandId,
      taxRate: input.taxRate,
      trackInventory: input.trackInventory,
      isFeatured: input.isFeatured,
      desi: input.desi,
      weightGram:
        input.weightGram === null ? null : Math.round(input.weightGram),
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    };
  }

  /**
   * Seçenekleri ekler (silmez), varyantları günceller/oluşturur, listede
   * olmayan varyantları pasifleştirir (sipariş geçmişi korunur) ve görselleri
   * baştan yazar.
   */
  private async syncOptionsVariantsImages(
    tx: Prisma.TransactionClient,
    productId: string,
    input: ProductInput,
  ): Promise<void> {
    // Seçenek ve değerler: mevcut olanı koru, eksik olanı ekle.
    const optionIds = new Map<string, string>();
    const valueIds = new Map<string, string>(); // "Seçenek\u0000Değer" → id

    const existingOptions = await tx.productOption.findMany({
      where: { productId },
      include: { values: true },
    });

    for (const [position, option] of input.options.entries()) {
      const existing = existingOptions.find((o) => o.name === option.name);
      const optionId =
        existing?.id ??
        (
          await tx.productOption.create({
            data: { productId, name: option.name, position },
            select: { id: true },
          })
        ).id;
      optionIds.set(option.name, optionId);

      const known = new Map(
        (existing?.values ?? []).map((v) => [v.value, v.id]),
      );
      for (const [valuePosition, value] of option.values.entries()) {
        const valueId =
          known.get(value) ??
          (
            await tx.productOptionValue.create({
              data: { optionId, value, position: valuePosition },
              select: { id: true },
            })
          ).id;
        valueIds.set(`${option.name}\u0000${value}`, valueId);
      }
    }

    const keep = new Set<string>();
    for (const variant of input.variants) {
      const data = {
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stockQuantity: variant.stockQuantity,
        isActive: variant.isActive,
      };

      if (variant.id) {
        await tx.productVariant.update({ where: { id: variant.id }, data });
        keep.add(variant.id);
        continue;
      }

      const created = await tx.productVariant.create({
        data: {
          ...data,
          productId,
          optionValues: {
            create: input.options.map((option) => ({
              optionValueId: valueIds.get(
                `${option.name}\u0000${variant.optionValues[option.name]}`,
              )!,
            })),
          },
        },
        select: { id: true },
      });
      keep.add(created.id);
    }

    await tx.productVariant.updateMany({
      where: { productId, id: { notIn: [...keep] } },
      data: { isActive: false },
    });

    await tx.productImage.deleteMany({ where: { productId } });
    if (input.images.length > 0) {
      await tx.productImage.createMany({
        data: input.images.map((image, position) => ({
          productId,
          url: image.url,
          alt: image.alt,
          position,
          optionValueId: image.forOption
            ? (valueIds.get(
                `${image.forOption.option}\u0000${image.forOption.value}`,
              ) ?? null)
            : null,
        })),
      });
    }
  }
}
