import { createHmac, timingSafeEqual } from "node:crypto";

function hmacBase64(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64");
}

export interface PaytrTokenInput {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string;
  userBasket: string;
  noInstallment: string;
  maxInstallment: string;
  currency: string;
  testMode: string;
  merchantSalt: string;
  merchantKey: string;
}

/** get-token isteği için `paytr_token` imzası. */
export function signTokenRequest(input: PaytrTokenInput): string {
  const data =
    input.merchantId +
    input.userIp +
    input.merchantOid +
    input.email +
    input.paymentAmount +
    input.userBasket +
    input.noInstallment +
    input.maxInstallment +
    input.currency +
    input.testMode +
    input.merchantSalt;

  return hmacBase64(data, input.merchantKey);
}

/** Bildirim (callback) imzasını hesaplar. */
export function signCallback(input: {
  merchantOid: string;
  merchantSalt: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
}): string {
  return hmacBase64(
    input.merchantOid + input.merchantSalt + input.status + input.totalAmount,
    input.merchantKey,
  );
}

/** İade isteği imzası. */
export function signRefund(input: {
  merchantId: string;
  merchantOid: string;
  returnAmount: string;
  merchantSalt: string;
  merchantKey: string;
}): string {
  return hmacBase64(
    input.merchantId +
      input.merchantOid +
      input.returnAmount +
      input.merchantSalt,
    input.merchantKey,
  );
}

/** Zamanlama saldırılarına karşı sabit sürede karşılaştırır. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
