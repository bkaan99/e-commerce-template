"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCartIdentity } from "@/modules/cart/cart.session";
import { checkoutSchema } from "@/modules/checkout/checkout.schema";
import {
  getCheckoutService,
  getDevPaymentProvider,
  getPaymentService,
} from "@/modules/orders/container";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface CheckoutFormState {
  message?: string;
  fieldErrors?: Record<string, string>;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readAddress(formData: FormData, prefix: string) {
  return {
    firstName: text(formData, `${prefix}.firstName`),
    lastName: text(formData, `${prefix}.lastName`),
    phone: text(formData, `${prefix}.phone`),
    city: text(formData, `${prefix}.city`),
    district: text(formData, `${prefix}.district`),
    neighborhood: text(formData, `${prefix}.neighborhood`),
    addressLine: text(formData, `${prefix}.addressLine`),
    postalCode: text(formData, `${prefix}.postalCode`),
    invoiceType: text(formData, `${prefix}.invoiceType`) || "INDIVIDUAL",
    nationalId: text(formData, `${prefix}.nationalId`),
    companyName: text(formData, `${prefix}.companyName`),
    taxNumber: text(formData, `${prefix}.taxNumber`),
    taxOffice: text(formData, `${prefix}.taxOffice`),
  };
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path
      .map((part) =>
        part === "shippingAddress"
          ? "shipping"
          : part === "billingAddress"
            ? "billing"
            : String(part),
      )
      .join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

export async function placeOrderAction(
  _previous: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const sameBilling = formData.get("sameBilling") === "on";

  const parsed = checkoutSchema.safeParse({
    email: text(formData, "email"),
    shippingAddress: readAddress(formData, "shipping"),
    billingAddress: sameBilling ? undefined : readAddress(formData, "billing"),
    couponCode: text(formData, "couponCode"),
    customerNote: text(formData, "customerNote"),
    paymentMethod: text(formData, "paymentMethod") || "CARD",
    acceptTerms: formData.get("acceptTerms") === "on",
  });

  if (!parsed.success) {
    return {
      message: "Lütfen işaretli alanları kontrol edin.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  let orderNumber: string;
  let lookupToken: string;
  let method: "CARD" | "BANK_TRANSFER" | "DEFERRED" = "CARD";

  try {
    const ip = await getClientIp();
    await enforceRateLimit("checkout", ip, RATE_LIMIT_POLICIES.checkout);

    const identity = await getCartIdentity();
    const created = await getCheckoutService().placeOrder(
      identity,
      parsed.data,
    );
    orderNumber = created.orderNumber;
    lookupToken = created.lookupToken;
    method = parsed.data.paymentMethod;
  } catch (error) {
    if (isAppError(error)) return { message: error.message };
    reportError(error, { action: "placeOrder" });
    return { message: "Siparişiniz oluşturulamadı, lütfen tekrar deneyin." };
  }

  // Kart ödemesi güvenli ödeme sayfasına, havale/vadeli sipariş detay sayfasına gider.
  redirect(
    method === "CARD"
      ? `/odeme/ode/${orderNumber}?t=${lookupToken}`
      : `/siparis/${orderNumber}?t=${lookupToken}`,
  );
}

/** Geliştirme ortamında sahte ödeme sayfasından sonucu bildirir. */
export async function devPaymentAction(formData: FormData): Promise<void> {
  const provider = getDevPaymentProvider();
  if (!provider) return;

  const orderNumber = text(formData, "orderNumber");
  const lookupToken = text(formData, "lookupToken");
  const status = text(formData, "status") === "success" ? "success" : "failed";
  const amount = text(formData, "amount");

  const totalAmount = String(Math.round(Number(amount) * 100));
  const payload = {
    merchant_oid: orderNumber,
    status,
    total_amount: totalAmount,
    hash: provider.signPayload(orderNumber, status, totalAmount),
  };

  await getPaymentService().handleCallback(payload);
  redirect(`/siparis/${orderNumber}?t=${lookupToken}`);
}
