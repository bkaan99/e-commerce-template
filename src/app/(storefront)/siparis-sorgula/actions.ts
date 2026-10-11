"use server";

import { redirect } from "next/navigation";
import { getOrderService } from "@/modules/orders/container";
import { isAppError } from "@/shared/errors";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface LookupState {
  error?: string;
}

export async function lookupOrderAction(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const email = String(formData.get("email") ?? "");

  if (!orderNumber.trim() || !email.trim()) {
    return { error: "Sipariş numarası ve e-posta gerekli." };
  }

  try {
    const ip = await getClientIp();
    await enforceRateLimit("order-lookup", ip, RATE_LIMIT_POLICIES.orderLookup);

    const order = await getOrderService().lookupByEmail(orderNumber, email);
    redirect(`/siparis/${order.orderNumber}?t=${order.lookupToken}`);
  } catch (error) {
    // redirect() özel bir hata fırlatır; uygulama hatası değilse yeniden fırlatılır.
    if (!isAppError(error)) throw error;
    if (error.code === "NOT_FOUND") {
      return { error: "Bu bilgilerle eşleşen bir sipariş bulunamadı." };
    }
    return { error: error.message };
  }
}
