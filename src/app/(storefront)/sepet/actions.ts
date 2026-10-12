"use server";

import { revalidatePath } from "next/cache";
import { getRequestPricing } from "@/modules/b2b/pricing-identity";
import { cartService } from "@/modules/cart/container";
import {
  getCartIdentity,
  persistCartCookie,
} from "@/modules/cart/cart.session";
import type { CartView } from "@/modules/cart/cart.types";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";

export interface CartActionResult {
  ok: boolean;
  error?: string;
  cart?: CartView;
}

async function run(
  operation: (
    identity: Awaited<ReturnType<typeof getCartIdentity>>,
  ) => ReturnType<typeof cartService.addItem>,
): Promise<CartActionResult> {
  try {
    const result = await operation(await getCartIdentity());
    await persistCartCookie(result);
    revalidatePath("/", "layout");
    return { ok: true, cart: result.cart };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    reportError(error, { action: "cart" });
    return { ok: false, error: "İşlem tamamlanamadı, lütfen tekrar deneyin." };
  }
}

export async function addToCartAction(
  variantId: string,
  quantity: number,
): Promise<CartActionResult> {
  // Yalnızca-B2B modunda fiyat göremeyen ziyaretçi sepete ekleyemez.
  const pricing = await getRequestPricing();
  if (!pricing.pricesVisible) {
    return { ok: false, error: "Sipariş için bayi girişi yapmalısınız." };
  }

  return run((identity) => cartService.addItem(identity, variantId, quantity));
}

export async function updateCartQuantityAction(
  variantId: string,
  quantity: number,
): Promise<CartActionResult> {
  return run((identity) =>
    cartService.setQuantity(identity, variantId, quantity),
  );
}

export async function removeCartItemAction(
  variantId: string,
): Promise<CartActionResult> {
  return run((identity) => cartService.removeItem(identity, variantId));
}
