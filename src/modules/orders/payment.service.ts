import { ConflictError, NotFoundError } from "@/shared/errors";
import type { EventBus } from "@/shared/events/event-bus";
import { paymentLogger } from "@/shared/logger";
import type { PaymentProvider } from "@/integrations/payment/payment-provider";
import type { OrderRepository } from "./order.repository";
import type { AddressSnapshot, PaymentOutcome } from "./order.types";

export interface PaymentUrls {
  /** Sitenin kök adresi, sonda eğik çizgi olmadan */
  baseUrl: string;
}

function formatAddress(address: AddressSnapshot): string {
  return [
    address.addressLine,
    address.neighborhood,
    address.district,
    address.city,
  ]
    .filter(Boolean)
    .join(" ");
}

export class PaymentService {
  constructor(
    private readonly provider: PaymentProvider,
    private readonly orders: OrderRepository,
    private readonly events: EventBus,
    private readonly urls: PaymentUrls,
  ) {}

  /** Ödeme bekleyen sipariş için sağlayıcıda ödeme oturumu açar. */
  async start(
    orderNumber: string,
    context: { customerIp: string },
  ): Promise<{ paymentUrl: string; mode: "iframe" | "redirect" }> {
    const order = await this.orders.findByOrderNumber(orderNumber);
    if (!order) throw new NotFoundError("Sipariş");

    if (
      order.status !== "PENDING_PAYMENT" ||
      order.paymentStatus !== "PENDING"
    ) {
      throw new ConflictError("Bu sipariş için ödeme alınamaz");
    }

    const payment = await this.orders.getPaymentForOrder(order.id);
    if (!payment) throw new NotFoundError("Ödeme");

    const address = order.shippingAddress;
    const result = await this.provider.initiate({
      merchantOid: payment.merchantOid,
      amount: payment.amount,
      currency: payment.currency,
      email: order.email,
      customerName: `${address.firstName} ${address.lastName}`,
      customerPhone: address.phone,
      customerAddress: formatAddress(address),
      customerIp: context.customerIp,
      description: `Sipariş ${order.orderNumber}`,
      okUrl: `${this.urls.baseUrl}/siparis/${order.orderNumber}?t=${order.lookupToken}`,
      failUrl: `${this.urls.baseUrl}/siparis/${order.orderNumber}?t=${order.lookupToken}&durum=basarisiz`,
    });

    return { paymentUrl: result.paymentUrl, mode: result.mode };
  }

  /**
   * Sağlayıcı bildirimini işler. İmza geçersizse hata fırlatır; aynı bildirim
   * tekrar gelirse güvenle yok sayılır.
   */
  async handleCallback(
    payload: Record<string, string>,
  ): Promise<PaymentOutcome> {
    const result = this.provider.verifyCallback(payload);

    const outcome = await this.orders.applyPaymentResult({
      merchantOid: result.merchantOid,
      success: result.status === "success",
      amount: result.amount,
      failureReason: result.failureReason,
      rawPayload: payload,
    });

    paymentLogger.info(
      { merchantOid: result.merchantOid, outcome: outcome.kind },
      "Ödeme bildirimi işlendi",
    );

    switch (outcome.kind) {
      case "paid":
        await this.events.publish("order.paid", { orderId: outcome.orderId });
        break;
      case "failed":
        await this.events.publish("order.cancelled", {
          orderId: outcome.orderId,
          refunded: false,
        });
        break;
      case "amount-mismatch":
        paymentLogger.error(
          { merchantOid: result.merchantOid, reported: result.amount },
          "Ödeme tutarı sipariş tutarıyla uyuşmuyor, inceleme gerekli",
        );
        break;
      default:
        break;
    }

    return outcome;
  }
}
