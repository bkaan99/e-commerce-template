import { createHmac, timingSafeEqual } from "node:crypto";
import Decimal from "decimal.js";
import { ValidationError } from "@/shared/errors";
import type {
  PaymentCallbackResult,
  PaymentInitRequest,
  PaymentInitResult,
  PaymentProvider,
  RefundRequest,
  RefundResult,
} from "../payment-provider";

/**
 * Yerel geliştirme için sahte ödeme sağlayıcısı. PayTR anahtarları tanımlı
 * değilken kullanılır; gerçek tahsilat yapmaz. Production'da kullanılmamalıdır.
 */
export class DevPaymentProvider implements PaymentProvider {
  readonly name = "dev";

  constructor(
    private readonly secret: string,
    private readonly baseUrl: string,
  ) {}

  async initiate(request: PaymentInitRequest): Promise<PaymentInitResult> {
    // Sipariş erişim belirteci, dönüş adresinden alınıp sayfaya taşınır.
    const token = new URL(request.okUrl).searchParams.get("t") ?? "";

    return {
      token: request.merchantOid,
      paymentUrl: `${this.baseUrl}/odeme/gelistirme/${request.merchantOid}?t=${encodeURIComponent(token)}`,
      mode: "redirect",
    };
  }

  /** Geliştirme ödeme sayfasının sunucu tarafında bildirim yükünü imzalaması için. */
  signPayload(
    merchantOid: string,
    status: string,
    totalAmount: string,
  ): string {
    return this.sign(merchantOid, status, totalAmount);
  }

  verifyCallback(payload: Record<string, string>): PaymentCallbackResult {
    const {
      merchant_oid: merchantOid,
      status,
      total_amount: total,
      hash,
    } = payload;
    if (!merchantOid || !status || !total || !hash) {
      throw new ValidationError("Eksik bildirim alanı");
    }

    const expected = Buffer.from(this.sign(merchantOid, status, total));
    const actual = Buffer.from(hash);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new ValidationError("Geçersiz bildirim imzası");
    }
    if (status !== "success" && status !== "failed") {
      throw new ValidationError("Bilinmeyen ödeme durumu");
    }

    return {
      merchantOid,
      status,
      amount: new Decimal(total).dividedBy(100).toFixed(2),
      failureReason:
        status === "failed" ? "Geliştirme ortamında reddedildi" : null,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    return { providerRef: `dev-${request.merchantOid}` };
  }

  private sign(merchantOid: string, status: string, total: string): string {
    return createHmac("sha256", this.secret)
      .update(`${merchantOid}|${status}|${total}`)
      .digest("base64");
  }
}
