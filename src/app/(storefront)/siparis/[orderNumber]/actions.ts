"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/session";
import { getOrderService } from "@/modules/orders/container";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";

export interface CancelOrderResult {
  ok: boolean;
  error?: string;
}

export async function cancelOrderAction(
  orderNumber: string,
  lookupToken: string | null,
): Promise<CancelOrderResult> {
  try {
    const user = await getCurrentUser();
    await getOrderService().cancel(orderNumber, {
      userId: user?.id ?? null,
      lookupToken,
    });
    revalidatePath(`/siparis/${orderNumber}`);
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    reportError(error, { action: "cancelOrder", orderNumber });
    return { ok: false, error: "İptal işlemi tamamlanamadı." };
  }
}
