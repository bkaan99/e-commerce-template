"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/session";
import { getReturnService } from "@/modules/returns/container";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface ReturnRequestResult {
  ok: boolean;
  error?: string;
}

export async function requestReturnAction(
  orderNumber: string,
  lookupToken: string | null,
  payload: {
    items: { orderItemId: string; quantity: number }[];
    reason: string;
    note: string;
  },
): Promise<ReturnRequestResult> {
  try {
    const ip = await getClientIp();
    await enforceRateLimit("return-request", ip, RATE_LIMIT_POLICIES.checkout);

    const user = await getCurrentUser();
    await getReturnService().request(
      orderNumber,
      { userId: user?.id ?? null, lookupToken },
      {
        items: payload.items,
        reason: payload.reason,
        note: payload.note || null,
      },
    );
    revalidatePath(`/siparis/${orderNumber}`);
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    reportError(error, { action: "requestReturn", orderNumber });
    return { ok: false, error: "Talep oluşturulamadı, lütfen tekrar deneyin." };
  }
}
