/** Ödeme sağlayıcısına gönderilen başlatma isteği. */
export interface PaymentInitRequest {
  /** Sağlayıcıya iletilen benzersiz sipariş kimliği */
  merchantOid: string;
  /** Ondalık string, örn. "649.90" */
  amount: string;
  currency: string;
  email: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerIp: string;
  description: string;
  okUrl: string;
  failUrl: string;
}

export interface PaymentInitResult {
  /** Sağlayıcıdaki ödeme oturumunu temsil eden belirteç */
  token: string;
  /** Müşterinin ödemeyi yapacağı sayfanın adresi */
  paymentUrl: string;
  /** iframe: sayfa içine gömülür. redirect: müşteri sayfaya yönlendirilir. */
  mode: "iframe" | "redirect";
}

export interface PaymentInitiator {
  initiate(request: PaymentInitRequest): Promise<PaymentInitResult>;
}

export type PaymentCallbackStatus = "success" | "failed";

export interface PaymentCallbackResult {
  merchantOid: string;
  status: PaymentCallbackStatus;
  /** Ondalık string (TL) */
  amount: string;
  failureReason: string | null;
}

export interface PaymentCallbackVerifier {
  /** İmzayı doğrular; geçersizse hata fırlatır. */
  verifyCallback(payload: Record<string, string>): PaymentCallbackResult;
}

export interface RefundRequest {
  merchantOid: string;
  /** Ondalık string (TL) */
  amount: string;
}

export interface RefundResult {
  providerRef: string | null;
}

export interface PaymentRefunder {
  refund(request: RefundRequest): Promise<RefundResult>;
}

/** Bir ödeme sağlayıcısının tüm yeteneklerini birleştiren sözleşme. */
export interface PaymentProvider
  extends PaymentInitiator, PaymentCallbackVerifier, PaymentRefunder {
  readonly name: string;
}
