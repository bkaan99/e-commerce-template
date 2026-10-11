import type Decimal from "decimal.js";
import type { PrismaClient } from "@/shared/prisma-client";

export interface CartRecord {
  id: string;
  userId: string | null;
  sessionToken: string | null;
}

export interface CartItemRecord {
  variantId: string;
  quantity: number;
  sku: string;
  price: Decimal;
  currency: string;
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    trackInventory: boolean;
    imageUrl: string | null;
  };
  optionLabels: string[];
}

export interface VariantStockRecord {
  variantId: string;
  isActive: boolean;
  productActive: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  reservedQuantity: number;
}

export interface CartRepository {
  findByUserId(userId: string): Promise<CartRecord | null>;
  findByToken(token: string): Promise<CartRecord | null>;
  create(data: { userId?: string; sessionToken?: string }): Promise<CartRecord>;
  delete(cartId: string): Promise<void>;
  listItems(cartId: string): Promise<CartItemRecord[]>;
  getItemQuantity(cartId: string, variantId: string): Promise<number>;
  setItemQuantity(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void>;
  removeItem(cartId: string, variantId: string): Promise<void>;
  findVariantStock(variantId: string): Promise<VariantStockRecord | null>;
  /** Kaynak sepetin satırlarını hedefe ekler (aynı varyantta adetler toplanır). */
  moveItems(
    fromCartId: string,
    toCartId: string,
    maxQuantity: number,
  ): Promise<void>;
}

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly db: () => PrismaClient) {}

  findByUserId(userId: string): Promise<CartRecord | null> {
    return this.db().cart.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, userId: true, sessionToken: true },
    });
  }

  findByToken(token: string): Promise<CartRecord | null> {
    return this.db().cart.findUnique({
      where: { sessionToken: token },
      select: { id: true, userId: true, sessionToken: true },
    });
  }

  create(data: {
    userId?: string;
    sessionToken?: string;
  }): Promise<CartRecord> {
    return this.db().cart.create({
      data: { userId: data.userId, sessionToken: data.sessionToken },
      select: { id: true, userId: true, sessionToken: true },
    });
  }

  async delete(cartId: string): Promise<void> {
    await this.db().cart.deleteMany({ where: { id: cartId } });
  }

  async listItems(cartId: string): Promise<CartItemRecord[]> {
    const rows = await this.db().cartItem.findMany({
      where: { cartId },
      orderBy: { createdAt: "asc" },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                trackInventory: true,
                images: {
                  orderBy: { position: "asc" },
                  take: 1,
                  select: { url: true },
                },
              },
            },
            optionValues: {
              include: { optionValue: { include: { option: true } } },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      variantId: row.variantId,
      quantity: row.quantity,
      sku: row.variant.sku,
      price: row.variant.price,
      currency: row.variant.currency,
      isActive: row.variant.isActive,
      stockQuantity: row.variant.stockQuantity,
      reservedQuantity: row.variant.reservedQuantity,
      product: {
        id: row.variant.product.id,
        name: row.variant.product.name,
        slug: row.variant.product.slug,
        status: row.variant.product.status,
        trackInventory: row.variant.product.trackInventory,
        imageUrl: row.variant.product.images[0]?.url ?? null,
      },
      optionLabels: row.variant.optionValues
        .sort(
          (a, b) =>
            a.optionValue.option.position - b.optionValue.option.position,
        )
        .map((item) => item.optionValue.value),
    }));
  }

  async getItemQuantity(cartId: string, variantId: string): Promise<number> {
    const item = await this.db().cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
      select: { quantity: true },
    });
    return item?.quantity ?? 0;
  }

  async setItemQuantity(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    await this.db().cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      update: { quantity },
      create: { cartId, variantId, quantity },
    });
    await this.db().cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });
  }

  async removeItem(cartId: string, variantId: string): Promise<void> {
    await this.db().cartItem.deleteMany({ where: { cartId, variantId } });
  }

  async findVariantStock(
    variantId: string,
  ): Promise<VariantStockRecord | null> {
    const variant = await this.db().productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        isActive: true,
        stockQuantity: true,
        reservedQuantity: true,
        product: { select: { status: true, trackInventory: true } },
      },
    });
    if (!variant) return null;

    return {
      variantId: variant.id,
      isActive: variant.isActive,
      productActive: variant.product.status === "ACTIVE",
      trackInventory: variant.product.trackInventory,
      stockQuantity: variant.stockQuantity,
      reservedQuantity: variant.reservedQuantity,
    };
  }

  async moveItems(
    fromCartId: string,
    toCartId: string,
    maxQuantity: number,
  ): Promise<void> {
    await this.db().$transaction(async (tx) => {
      const items = await tx.cartItem.findMany({
        where: { cartId: fromCartId },
      });

      for (const item of items) {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: { cartId: toCartId, variantId: item.variantId },
          },
        });
        const quantity = Math.min(
          maxQuantity,
          item.quantity + (existing?.quantity ?? 0),
        );

        await tx.cartItem.upsert({
          where: {
            cartId_variantId: { cartId: toCartId, variantId: item.variantId },
          },
          update: { quantity },
          create: { cartId: toCartId, variantId: item.variantId, quantity },
        });
      }

      await tx.cart.deleteMany({ where: { id: fromCartId } });
    });
  }
}
