import type { PrismaClient } from "@/shared/prisma-client";

export interface GroupRow {
  id: string;
  name: string;
  slug: string;
  discountPercent: string | null;
  customerCount: number;
}

export interface VariantPriceRow {
  variantId: string;
  sku: string;
  productName: string;
  optionLabel: string;
  listPrice: string;
  groupPrice: string | null;
  /** Bu gruba özel kademeler */
  groupTiers: { minQuantity: number; price: string }[];
  /** Tüm müşterilere uygulanan genel kademeler (salt okunur) */
  generalTiers: { minQuantity: number; price: string }[];
}

export interface PriceListRepository {
  listGroups(): Promise<GroupRow[]>;
  findGroup(id: string): Promise<GroupRow | null>;
  groupSlugTaken(slug: string, excludeId?: string): Promise<boolean>;
  createGroup(
    name: string,
    slug: string,
    discountPercent: number | null,
  ): Promise<string>;
  updateGroup(
    id: string,
    name: string,
    discountPercent: number | null,
  ): Promise<void>;
  deleteGroup(id: string): Promise<void>;
  searchVariants(
    groupId: string,
    query: string,
    limit: number,
  ): Promise<VariantPriceRow[]>;
  variantExists(variantId: string): Promise<boolean>;
  setGroupPrice(
    groupId: string,
    variantId: string,
    price: number | null,
  ): Promise<void>;
  replaceTiers(
    variantId: string,
    groupId: string | null,
    tiers: { minQuantity: number; price: number }[],
  ): Promise<void>;
}

export class PrismaPriceListRepository implements PriceListRepository {
  constructor(private readonly db: () => PrismaClient) {}

  private toGroup(row: {
    id: string;
    name: string;
    slug: string;
    discountPercent: { toString(): string } | null;
    _count: { customers: number };
  }): GroupRow {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      discountPercent: row.discountPercent?.toString() ?? null,
      customerCount: row._count.customers,
    };
  }

  async listGroups(): Promise<GroupRow[]> {
    const rows = await this.db().customerGroup.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { customers: true } } },
    });
    return rows.map((row) => this.toGroup(row));
  }

  async findGroup(id: string): Promise<GroupRow | null> {
    const row = await this.db().customerGroup.findUnique({
      where: { id },
      include: { _count: { select: { customers: true } } },
    });
    return row ? this.toGroup(row) : null;
  }

  async groupSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.db().customerGroup.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return found !== null;
  }

  async createGroup(
    name: string,
    slug: string,
    discountPercent: number | null,
  ): Promise<string> {
    const created = await this.db().customerGroup.create({
      data: { name, slug, discountPercent },
      select: { id: true },
    });
    return created.id;
  }

  async updateGroup(
    id: string,
    name: string,
    discountPercent: number | null,
  ): Promise<void> {
    await this.db().customerGroup.update({
      where: { id },
      data: { name, discountPercent },
    });
  }

  async deleteGroup(id: string): Promise<void> {
    await this.db().customerGroup.delete({ where: { id } });
  }

  async searchVariants(
    groupId: string,
    query: string,
    limit: number,
  ): Promise<VariantPriceRow[]> {
    const term = query.trim();
    const variants = await this.db().productVariant.findMany({
      where: {
        isActive: true,
        ...(term
          ? {
              OR: [
                { sku: { contains: term, mode: "insensitive" } },
                { product: { name: { contains: term, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      take: limit,
      include: {
        product: { select: { name: true } },
        optionValues: { include: { optionValue: true } },
        groupPrices: { where: { groupId } },
        tierPrices: {
          where: { OR: [{ groupId }, { groupId: null }] },
          orderBy: { minQuantity: "asc" },
        },
      },
    });

    return variants.map((variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      productName: variant.product.name,
      optionLabel: variant.optionValues
        .map((link) => link.optionValue.value)
        .join(" / "),
      listPrice: variant.price.toFixed(2),
      groupPrice: variant.groupPrices[0]?.price.toFixed(2) ?? null,
      groupTiers: variant.tierPrices
        .filter((tier) => tier.groupId === groupId)
        .map((tier) => ({
          minQuantity: tier.minQuantity,
          price: tier.price.toFixed(2),
        })),
      generalTiers: variant.tierPrices
        .filter((tier) => tier.groupId === null)
        .map((tier) => ({
          minQuantity: tier.minQuantity,
          price: tier.price.toFixed(2),
        })),
    }));
  }

  async variantExists(variantId: string): Promise<boolean> {
    return (
      (await this.db().productVariant.findUnique({
        where: { id: variantId },
        select: { id: true },
      })) !== null
    );
  }

  async setGroupPrice(
    groupId: string,
    variantId: string,
    price: number | null,
  ): Promise<void> {
    if (price === null) {
      await this.db().variantGroupPrice.deleteMany({
        where: { groupId, variantId },
      });
      return;
    }

    await this.db().variantGroupPrice.upsert({
      where: { variantId_groupId: { variantId, groupId } },
      update: { price },
      create: { variantId, groupId, price },
    });
  }

  async replaceTiers(
    variantId: string,
    groupId: string | null,
    tiers: { minQuantity: number; price: number }[],
  ): Promise<void> {
    await this.db().$transaction(async (tx) => {
      await tx.tierPrice.deleteMany({ where: { variantId, groupId } });
      if (tiers.length > 0) {
        await tx.tierPrice.createMany({
          data: tiers.map((tier) => ({ variantId, groupId, ...tier })),
        });
      }
    });
  }
}
