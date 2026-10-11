"use server";

import { getStockAlertService } from "@/modules/stock-alerts/container";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface StockAlertResult {
  ok: boolean;
  error?: string;
}

export async function subscribeStockAlertAction(
  variantId: string,
  email: string,
): Promise<StockAlertResult> {
  try {
    const ip = await getClientIp();
    await enforceRateLimit("stock-alert", ip, RATE_LIMIT_POLICIES.stockAlert);
    await getStockAlertService().subscribe(variantId, email);
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    reportError(error, { action: "stockAlert" });
    return { ok: false, error: "Kayıt yapılamadı, lütfen tekrar deneyin." };
  }
}
