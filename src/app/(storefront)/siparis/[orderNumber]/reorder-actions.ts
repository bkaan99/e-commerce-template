"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/session";
import { cartService } from "@/modules/cart/container";
import {
  getCartIdentity,
  persistCartCookie,
} from "@/modules/cart/cart.session";
import { getOrderService } from "@/modules/orders/container";
import { ReorderService } from "@/modules/orders/reorder.service";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";

export interface ReorderActionResult {
  ok: boolean;
  added?: number;
  skipped?: { productName: string; reason: string }[];
  error?: string;
}

export async function reorderAction(
  orderNumber: string,
  lookupToken: string | null,
): Promise<ReorderActionResult> {
  try {
    const user = await getCurrentUser();
    const service = new ReorderService(getOrderService(), cartService);

    const result = await service.reorder(
      orderNumber,
      { userId: user?.id ?? null, lookupToken },
      await getCartIdentity(),
    );

    await persistCartCookie({ sessionToken: result.sessionToken });
    revalidatePath("/", "layout");

    return { ok: true, added: result.added, skipped: result.skipped };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    reportError(error, { action: "reorder", orderNumber });
    return { ok: false, error: "Ürünler sepete eklenemedi." };
  }
}
