import { isAppError } from "@/shared/errors";
import type { CartIdentity, CartMutationResult } from "../cart/cart.types";
import type { OrderAccess } from "./order.service";
import type { OrderView } from "./order.types";

export interface ReorderResult {
  added: number;
  skipped: { productName: string; reason: string }[];
  /** İlk ekleme yeni misafir sepeti oluşturduysa çerezde saklanacak belirteç */
  sessionToken?: string;
}

/** "Tekrar sipariş ver": önceki siparişin ürünlerini mevcut stok ve fiyatla sepete ekler. */
export class ReorderService {
  constructor(
    private readonly orders: {
      getForAccess(
        orderNumber: string,
        access: OrderAccess,
      ): Promise<OrderView>;
    },
    private readonly cart: {
      addItem(
        identity: CartIdentity,
        variantId: string,
        quantity: number,
      ): Promise<CartMutationResult>;
    },
  ) {}

  async reorder(
    orderNumber: string,
    access: OrderAccess,
    identity: CartIdentity,
  ): Promise<ReorderResult> {
    const order = await this.orders.getForAccess(orderNumber, access);

    let current = identity;
    let added = 0;
    let sessionToken: string | undefined;
    const skipped: ReorderResult["skipped"] = [];

    for (const item of order.items) {
      if (!item.variantId) {
        skipped.push({
          productName: item.productName,
          reason: "Ürün artık satışta değil",
        });
        continue;
      }

      try {
        const result = await this.cart.addItem(
          current,
          item.variantId,
          item.quantity,
        );
        added += 1;

        // Misafir için oluşan sepet belirteci sonraki eklemelerde kullanılır.
        if (result.sessionToken) {
          sessionToken = result.sessionToken;
          current = { ...current, sessionToken: result.sessionToken };
        }
      } catch (error) {
        if (!isAppError(error)) throw error;
        skipped.push({ productName: item.productName, reason: error.message });
      }
    }

    return { added, skipped, sessionToken };
  }
}
