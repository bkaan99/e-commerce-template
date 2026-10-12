import { randomBytes } from "node:crypto";
import type Decimal from "decimal.js";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import { toDecimal } from "@/shared/money";
import { availableQuantity } from "../catalog/availability";
import { RetailPriceResolver, type PriceResolver } from "../catalog/pricing";
import type {
  CartItemRecord,
  CartRecord,
  CartRepository,
} from "./cart.repository";
import {
  MAX_LINE_QUANTITY,
  type CartIdentity,
  type CartLine,
  type CartLineIssue,
  type CartMutationResult,
  type CartView,
} from "./cart.types";

const PLACEHOLDER_IMAGE = "/placeholder.svg";

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Satırın satın alınabilirliğini ve karşılanabilen adedi hesaplar. */
export function evaluateLine(item: CartItemRecord): {
  issue: CartLineIssue | null;
  available: number | null;
} {
  if (!item.isActive || item.product.status !== "ACTIVE") {
    return { issue: "UNAVAILABLE", available: 0 };
  }

  const available = availableQuantity({
    trackInventory: item.product.trackInventory,
    stockQuantity: item.stockQuantity,
    reservedQuantity: item.reservedQuantity,
  });

  if (available === null) return { issue: null, available: null };
  if (available === 0) return { issue: "OUT_OF_STOCK", available };
  if (item.quantity > available)
    return { issue: "QUANTITY_REDUCED", available };
  return { issue: null, available };
}

export class CartService {
  constructor(
    private readonly repository: CartRepository,
    private readonly priceResolver: PriceResolver = new RetailPriceResolver(),
  ) {}

  /** Mevcut sepeti görüntüler; sepet yoksa boş döner (oluşturmaz). */
  async getCart(identity: CartIdentity): Promise<CartMutationResult> {
    const resolved = await this.resolveExisting(identity);
    return {
      cart: await this.buildView(
        resolved.cart,
        identity.customerGroupId ?? null,
      ),
      clearSessionToken: resolved.clearSessionToken,
    };
  }

  async addItem(
    identity: CartIdentity,
    variantId: string,
    quantity: number,
  ): Promise<CartMutationResult> {
    this.assertQuantity(quantity, 1);

    const { cart, sessionToken, clearSessionToken } =
      await this.resolveOrCreate(identity);
    const current = await this.repository.getItemQuantity(cart.id, variantId);
    const next = Math.min(MAX_LINE_QUANTITY, current + quantity);

    await this.assertSellable(variantId, next);
    await this.repository.setItemQuantity(cart.id, variantId, next);

    return {
      cart: await this.buildView(cart, identity.customerGroupId ?? null),
      sessionToken,
      clearSessionToken,
    };
  }

  async setQuantity(
    identity: CartIdentity,
    variantId: string,
    quantity: number,
  ): Promise<CartMutationResult> {
    this.assertQuantity(quantity, 0);

    const resolved = await this.resolveExisting(identity);
    if (!resolved.cart) throw new NotFoundError("Sepet");

    if (quantity === 0) {
      await this.repository.removeItem(resolved.cart.id, variantId);
    } else {
      await this.assertSellable(variantId, quantity);
      await this.repository.setItemQuantity(
        resolved.cart.id,
        variantId,
        quantity,
      );
    }

    return {
      cart: await this.buildView(
        resolved.cart,
        identity.customerGroupId ?? null,
      ),
      clearSessionToken: resolved.clearSessionToken,
    };
  }

  removeItem(
    identity: CartIdentity,
    variantId: string,
  ): Promise<CartMutationResult> {
    return this.setQuantity(identity, variantId, 0);
  }

  private assertQuantity(quantity: number, min: number): void {
    if (
      !Number.isInteger(quantity) ||
      quantity < min ||
      quantity > MAX_LINE_QUANTITY
    ) {
      throw new ValidationError("Geçersiz adet");
    }
  }

  private async assertSellable(
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const stock = await this.repository.findVariantStock(variantId);
    if (!stock || !stock.isActive || !stock.productActive) {
      throw new NotFoundError("Ürün");
    }

    const available = availableQuantity(stock);
    if (available !== null && quantity > available) {
      throw new ConflictError(
        available === 0
          ? "Bu ürün şu anda stokta yok"
          : `Stokta yalnızca ${available} adet var`,
      );
    }
  }

  /** Sepeti bulur; üye girişinde misafir sepetini üyenin sepetine katar. */
  private async resolveExisting(identity: CartIdentity): Promise<{
    cart: CartRecord | null;
    clearSessionToken?: boolean;
  }> {
    const guest = identity.sessionToken
      ? await this.repository.findByToken(identity.sessionToken)
      : null;

    if (!identity.userId) return { cart: guest };

    const owned = await this.repository.findByUserId(identity.userId);

    if (!guest || guest.userId === identity.userId) {
      return {
        cart: owned ?? guest,
        clearSessionToken: guest ? true : undefined,
      };
    }

    if (!owned) {
      // Misafir sepeti doğrudan üyeye devredilir.
      return {
        cart: await this.adoptGuestCart(guest, identity.userId),
        clearSessionToken: true,
      };
    }

    await this.repository.moveItems(guest.id, owned.id, MAX_LINE_QUANTITY);
    return { cart: owned, clearSessionToken: true };
  }

  private async adoptGuestCart(
    guest: CartRecord,
    userId: string,
  ): Promise<CartRecord> {
    const cart = await this.repository.create({ userId });
    await this.repository.moveItems(guest.id, cart.id, MAX_LINE_QUANTITY);
    return cart;
  }

  private async resolveOrCreate(identity: CartIdentity): Promise<{
    cart: CartRecord;
    sessionToken?: string;
    clearSessionToken?: boolean;
  }> {
    const existing = await this.resolveExisting(identity);
    if (existing.cart) {
      return {
        cart: existing.cart,
        clearSessionToken: existing.clearSessionToken,
      };
    }

    if (identity.userId) {
      return {
        cart: await this.repository.create({ userId: identity.userId }),
      };
    }

    const token = generateToken();
    const cart = await this.repository.create({ sessionToken: token });
    return { cart, sessionToken: token };
  }

  private async buildView(
    cart: CartRecord | null,
    customerGroupId: string | null,
  ): Promise<CartView> {
    if (!cart) {
      return {
        id: null,
        lines: [],
        itemCount: 0,
        subtotal: "0.00",
        currency: "TRY",
        hasIssues: false,
      };
    }

    const items = await this.repository.listItems(cart.id);
    let subtotal: Decimal = toDecimal(0);
    let itemCount = 0;
    let hasIssues = false;

    const unitPrices = await this.priceResolver.resolveUnitPrices(
      items.map((item) => ({
        variantId: item.variantId,
        listPrice: item.price,
        quantity: item.quantity,
      })),
      { customerGroupId },
    );

    const lines: CartLine[] = items.map((item) => {
      const { issue, available } = evaluateLine(item);
      const unit = unitPrices.get(item.variantId) ?? toDecimal(item.price);
      const lineTotal = unit.times(item.quantity);

      itemCount += item.quantity;
      if (issue) hasIssues = true;
      else subtotal = subtotal.plus(lineTotal);

      return {
        variantId: item.variantId,
        productName: item.product.name,
        productSlug: item.product.slug,
        variantLabel: item.optionLabels.length
          ? item.optionLabels.join(" / ")
          : null,
        sku: item.sku,
        imageUrl: item.product.imageUrl ?? PLACEHOLDER_IMAGE,
        unitPrice: unit.toFixed(2),
        quantity: item.quantity,
        lineTotal: lineTotal.toFixed(2),
        availableQuantity: available,
        issue,
      };
    });

    return {
      id: cart.id,
      lines,
      itemCount,
      subtotal: subtotal.toFixed(2),
      currency: items[0]?.currency ?? "TRY",
      hasIssues,
    };
  }
}
