import type { PrismaClient } from "@/shared/prisma-client";
import type {
  AttributeInput,
  BrandInput,
  CategoryInput,
} from "./taxonomy.schema";

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
}

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}

export interface AttributeRecord {
  id: string;
  name: string;
  slug: string;
  type: "SELECT" | "MULTI_SELECT";
  isFilterable: boolean;
  position: number;
  values: { id: string; value: string; slug: string; productCount: number }[];
}

export interface TaxonomyRepository {
  listCategories(): Promise<CategoryRecord[]>;
  findCategory(id: string): Promise<CategoryRecord | null>;
  categorySlugTaken(slug: string, excludeId?: string): Promise<boolean>;
  createCategory(input: CategoryInput, slug: string): Promise<string>;
  updateCategory(id: string, input: CategoryInput, slug: string): Promise<void>;
  countCategoryChildren(id: string): Promise<number>;
  countCategoryProducts(id: string): Promise<number>;
  deleteCategory(id: string): Promise<void>;
  addRedirect(fromPath: string, toPath: string): Promise<void>;

  listBrands(): Promise<BrandRecord[]>;
  brandSlugTaken(slug: string): Promise<boolean>;
  createBrand(input: BrandInput, slug: string): Promise<string>;
  deleteBrand(id: string): Promise<void>;

  listAttributes(): Promise<AttributeRecord[]>;
  attributeSlugTaken(slug: string): Promise<boolean>;
  createAttribute(input: AttributeInput, slug: string): Promise<string>;
  updateAttribute(id: string, input: AttributeInput): Promise<void>;
  deleteAttribute(id: string): Promise<void>;
  addAttributeValue(
    attributeId: string,
    value: string,
    slug: string,
  ): Promise<void>;
  attributeValueSlugTaken(attributeId: string, slug: string): Promise<boolean>;
  countAttributeValueProducts(valueId: string): Promise<number>;
  deleteAttributeValue(valueId: string): Promise<void>;
}

export class PrismaTaxonomyRepository implements TaxonomyRepository {
  constructor(private readonly db: () => PrismaClient) {}

  private categoryRecord(row: {
    id: string;
    parentId: string | null;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    _count: { products: number };
  }): CategoryRecord {
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      productCount: row._count.products,
    };
  }

  async listCategories(): Promise<CategoryRecord[]> {
    const rows = await this.db().category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((row) => this.categoryRecord(row));
  }

  async findCategory(id: string): Promise<CategoryRecord | null> {
    const row = await this.db().category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    return row ? this.categoryRecord(row) : null;
  }

  async categorySlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.db().category.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return found !== null;
  }

  async createCategory(input: CategoryInput, slug: string): Promise<string> {
    const created = await this.db().category.create({
      data: { ...input, slug },
      select: { id: true },
    });
    return created.id;
  }

  async updateCategory(
    id: string,
    input: CategoryInput,
    slug: string,
  ): Promise<void> {
    await this.db().category.update({
      where: { id },
      data: { ...input, slug },
    });
  }

  countCategoryChildren(id: string): Promise<number> {
    return this.db().category.count({ where: { parentId: id } });
  }

  countCategoryProducts(id: string): Promise<number> {
    return this.db().product.count({ where: { categoryId: id } });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db().category.delete({ where: { id } });
  }

  async addRedirect(fromPath: string, toPath: string): Promise<void> {
    if (fromPath === toPath) return;
    await this.db().redirect.upsert({
      where: { fromPath },
      update: { toPath },
      create: { fromPath, toPath },
    });
  }

  async listBrands(): Promise<BrandRecord[]> {
    const rows = await this.db().brand.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logoUrl,
      productCount: row._count.products,
    }));
  }

  async brandSlugTaken(slug: string): Promise<boolean> {
    return (await this.db().brand.findUnique({ where: { slug } })) !== null;
  }

  async createBrand(input: BrandInput, slug: string): Promise<string> {
    const created = await this.db().brand.create({
      data: { name: input.name, logoUrl: input.logoUrl, slug },
      select: { id: true },
    });
    return created.id;
  }

  async deleteBrand(id: string): Promise<void> {
    await this.db().brand.delete({ where: { id } });
  }

  async listAttributes(): Promise<AttributeRecord[]> {
    const rows = await this.db().attribute.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        values: {
          orderBy: [{ position: "asc" }, { value: "asc" }],
          include: { _count: { select: { products: true } } },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      isFilterable: row.isFilterable,
      position: row.position,
      values: row.values.map((value) => ({
        id: value.id,
        value: value.value,
        slug: value.slug,
        productCount: value._count.products,
      })),
    }));
  }

  async attributeSlugTaken(slug: string): Promise<boolean> {
    return (await this.db().attribute.findUnique({ where: { slug } })) !== null;
  }

  async createAttribute(input: AttributeInput, slug: string): Promise<string> {
    const created = await this.db().attribute.create({
      data: { ...input, slug },
      select: { id: true },
    });
    return created.id;
  }

  async updateAttribute(id: string, input: AttributeInput): Promise<void> {
    await this.db().attribute.update({ where: { id }, data: input });
  }

  async deleteAttribute(id: string): Promise<void> {
    await this.db().attribute.delete({ where: { id } });
  }

  async addAttributeValue(
    attributeId: string,
    value: string,
    slug: string,
  ): Promise<void> {
    const count = await this.db().attributeValue.count({
      where: { attributeId },
    });
    await this.db().attributeValue.create({
      data: { attributeId, value, slug, position: count },
    });
  }

  async attributeValueSlugTaken(
    attributeId: string,
    slug: string,
  ): Promise<boolean> {
    const found = await this.db().attributeValue.findUnique({
      where: { attributeId_slug: { attributeId, slug } },
    });
    return found !== null;
  }

  countAttributeValueProducts(valueId: string): Promise<number> {
    return this.db().productAttributeValue.count({
      where: { attributeValueId: valueId },
    });
  }

  async deleteAttributeValue(valueId: string): Promise<void> {
    await this.db().attributeValue.delete({ where: { id: valueId } });
  }
}
