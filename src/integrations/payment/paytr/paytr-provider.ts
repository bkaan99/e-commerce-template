import Decimal from "decimal.js";
import { ExternalServiceError, ValidationError } from "@/shared/errors";
import { paymentLogger } from "@/shared/logger";
import type {
  PaymentCallbackResult,
  PaymentInitRequest,
  PaymentInitResult,
  PaymentProvider,
  RefundRequest,
  RefundResult,
} from "../payment-provider";
import {
  safeEqual,
  signCallback,
  signRefund,
  signTokenRequest,
} from "./paytr-signature";

const TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";
const REFUND_URL = "https://www.paytr.com/odeme/iade";
const PAYMENT_PAGE_URL = "https://www.paytr.com/odeme/guvenli/";

export interface PaytrCredentials {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
}

export interface PaytrOptions {
  /** true ise PayTR test modunda çalışır (gerçek tahsilat yapılmaz) */
  testMode: boolean;
  /** Dakika cinsinden ödeme sayfası zaman aşımı */
  timeoutMinutes: number;
  /** 0: taksit serbest, 1: taksit kapalı */
  noInstallment: 0 | 1;
  /** 0: kart limitine göre en yüksek taksit */
  maxInstallment: number;
}

const DEFAULT_OPTIONS: PaytrOptions = {
  testMode: false,
  timeoutMinutes: 15,
  noInstallment: 0,
  maxInstallment: 0,
};

type Fetch = typeof fetch;

/** PayTR'nin yanıt süresinin uzun olabileceği ağ çağrıları için zaman sınırı. */
const REQUEST_TIMEOUT_MS = 20_000;

export class PaytrProvider implements PaymentProvider {
  readonly name = "paytr";
  private readonly options: PaytrOptions;

  constructor(
    private readonly credentials: PaytrCredentials,
    options: Partial<PaytrOptions> = {},
    private readonly http: Fetch = fetch,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async initiate(request: PaymentInitRequest): Promise<PaymentInitResult> {
    // Sepet tek satır olarak gönderilir; indirim, kargo ve KDV zaten toplam tutarın içindedir.
    const basket = Buffer.from(
      JSON.stringify([[request.description, request.amount, 1]]),
    ).toString("base64");

    const testMode = this.options.testMode ? "1" : "0";
    const noInstallment = String(this.options.noInstallment);
    const maxInstallment = String(this.options.maxInstallment);
    const currency = request.currency === "TRY" ? "TL" : request.currency;

    const token = signTokenRequest({
      merchantId: this.credentials.merchantId,
      userIp: request.customerIp,
      merchantOid: request.merchantOid,
      email: request.email,
      paymentAmount: request.amount,
      userBasket: basket,
      noInstallment,
      maxInstallment,
      currency,
      testMode,
      merchantSalt: this.credentials.merchantSalt,
      merchantKey: this.credentials.merchantKey,
    });

    const body = new URLSearchParams({
      merchant_id: this.credentials.merchantId,
      user_ip: request.customerIp,
      merchant_oid: request.merchantOid,
      email: request.email,
      payment_amount: request.amount,
      paytr_token: token,
      user_basket: basket,
      debug_on: this.options.testMode ? "1" : "0",
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: request.customerName,
      user_address: request.customerAddress,
      user_phone: request.customerPhone,
      merchant_ok_url: request.okUrl,
      merchant_fail_url: request.failUrl,
      timeout_limit: String(this.options.timeoutMinutes),
      currency,
      test_mode: testMode,
      lang: "tr",
    });

    const json = await this.postForm(TOKEN_URL, body);

    if (json["status"] !== "success" || typeof json["token"] !== "string") {
      paymentLogger.error(
        { merchantOid: request.merchantOid, reason: json["reason"] },
        "PayTR token alınamadı",
      );
      throw new ExternalServiceError("PayTR", json["reason"]);
    }

    return {
      token: json["token"],
      paymentUrl: `${PAYMENT_PAGE_URL}${json["token"]}`,
      mode: "iframe",
    };
  }

  verifyCallback(payload: Record<string, string>): PaymentCallbackResult {
    const merchantOid = payload["merchant_oid"];
    const status = payload["status"];
    const totalAmount = payload["total_amount"];
    const hash = payload["hash"];

    if (!merchantOid || !status || !totalAmount || !hash) {
      throw new ValidationError("Eksik bildirim alanı");
    }

    const expected = signCallback({
      merchantOid,
      merchantSalt: this.credentials.merchantSalt,
      status,
      totalAmount,
      merchantKey: this.credentials.merchantKey,
    });

    if (!safeEqual(expected, hash)) {
      paymentLogger.warn({ merchantOid }, "PayTR bildirim imzası geçersiz");
      throw new ValidationError("Geçersiz bildirim imzası");
    }

    if (status !== "success" && status !== "failed") {
      throw new ValidationError("Bilinmeyen ödeme durumu");
    }

    return {
      merchantOid,
      status,
      // PayTR toplam tutarı kuruş cinsinden bildirir.
      amount: new Decimal(totalAmount).dividedBy(100).toFixed(2),
      failureReason:
        status === "failed"
          ? (payload["failed_reason_msg"] ??
            payload["failed_reason_code"] ??
            null)
          : null,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const token = signRefund({
      merchantId: this.credentials.merchantId,
      merchantOid: request.merchantOid,
      returnAmount: request.amount,
      merchantSalt: this.credentials.merchantSalt,
      merchantKey: this.credentials.merchantKey,
    });

    const json = await this.postForm(
      REFUND_URL,
      new URLSearchParams({
        merchant_id: this.credentials.merchantId,
        merchant_oid: request.merchantOid,
        return_amount: request.amount,
        paytr_token: token,
      }),
    );

    if (json["status"] !== "success") {
      paymentLogger.error(
        { merchantOid: request.merchantOid, error: json["err_msg"] },
        "PayTR iadesi başarısız",
      );
      throw new ExternalServiceError("PayTR iade", json["err_msg"]);
    }

    return { providerRef: request.merchantOid };
  }

  private async postForm(
    url: string,
    body: URLSearchParams,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.http(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ExternalServiceError("PayTR", String(error));
    }

    if (!response.ok) {
      throw new ExternalServiceError("PayTR", `HTTP ${response.status}`);
    }

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new ExternalServiceError("PayTR", "Geçersiz yanıt");
    }
  }
}
