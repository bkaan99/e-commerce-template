"use server";

import { revalidatePath } from "next/cache";
import { getRequestPricing } from "@/modules/b2b/pricing-identity";
import { catalogService } from "@/modules/catalog/container";
import type { ProductCard } from "@/modules/catalog/catalog.types";
import { getCurrentUser } from "@/modules/auth/session";
import { wishlistService } from "@/modules/wishlist/container";
import { isFeatureEnabled } from "@/config/features";
import { isAppError } from "@/shared/errors";

export interface WishlistActionResult {
  ok: boolean;
  error?: string;
  ids?: string[];
}

export async function setWishlistItemAction(
  productId: string,
  favorite: boolean,
): Promise<WishlistActionResult> {
  if (!isFeatureEnabled("wishlist")) return { ok: false, error: "Kapalı" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Giriş gerekli" };

  try {
    if (favorite) await wishlistService.add(user.id, productId);
    else await wishlistService.remove(user.id, productId);
    revalidatePath("/favoriler");
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

/** Giriş sonrası misafir favorilerini hesaba aktarır. */
export async function mergeWishlistAction(
  productIds: string[],
): Promise<WishlistActionResult> {
  if (!isFeatureEnabled("wishlist")) return { ok: false };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Giriş gerekli" };

  const ids = await wishlistService.mergeGuestItems(user.id, productIds);
  return { ok: true, ids };
}

/** Misafir favori kimliklerinden ürün kartlarını getirir. */
export async function getWishlistCardsAction(
  productIds: string[],
): Promise<ProductCard[]> {
  if (!isFeatureEnabled("wishlist")) return [];
  return catalogService.getCardsInOrder(
    productIds.slice(0, 100),
    await getRequestPricing(),
  );
}
