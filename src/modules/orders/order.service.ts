import { timingSafeEqual } from "node:crypto";
import { ConflictError, NotFoundError } from "@/shared/errors";
import type { EventBus } from "@/shared/events/event-bus";
import type { PaymentRefunder } from "@/integrations/payment/payment-provider";
import type { OrderRepository } from "./order.repository";
import type { OrderStatus, OrderView } from "./order.types";

/** Siparişe erişen tarafı tanımlar: giriş yapmış sahibi ya da bağlantıdaki belirteç. */
export interface OrderAccess {
  userId?: string | null;
  lookupToken?: string | null;
}

const CANCELLABLE: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
];

function tokensMatch(
  expected: string,
  actual: string | null | undefined,
): boolean {
  if (!actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly refunder: PaymentRefunder,
    private readonly events: EventBus,
  ) {}

  /** Erişim yetkisi yoksa siparişin varlığını sızdırmamak için NotFoundError verir. */
  async getForAccess(
    orderNumber: string,
    access: OrderAccess,
  ): Promise<OrderView> {
    const order = await this.orders.findByOrderNumber(orderNumber);
    if (!order || !this.canAccess(order, access)) {
      throw new NotFoundError("Sipariş");
    }
    return order;
  }

  /** Misafir sorgusu: sipariş numarası ve e-posta birlikte eşleşmelidir. */
  async lookupByEmail(orderNumber: string, email: string): Promise<OrderView> {
    const order = await this.orders.findByOrderNumber(
      orderNumber.trim().toUpperCase(),
    );
    if (!order || order.email.toLowerCase() !== email.trim().toLowerCase()) {
      throw new NotFoundError("Sipariş");
    }
    return order;
  }

  listForUser(userId: string): Promise<OrderView[]> {
    return this.orders.listByUser(userId);
  }

  /** Kargolanmamış siparişi iptal eder; ödenmişse iadeyi başlatır. */
  async cancel(orderNumber: string, access: OrderAccess): Promise<OrderView> {
    const order = await this.getForAccess(orderNumber, access);
    await this.cancelOrder(order);
    return (await this.orders.findByOrderNumber(order.orderNumber))!;
  }

  /**
   * Personel iptali: sahiplik denetimi yapmaz (yetki çağıran katmanda
   * doğrulanır). Ödenmişse önce iade edilir.
   */
  async cancelByStaff(orderNumber: string): Promise<void> {
    const order = await this.orders.findByOrderNumber(orderNumber);
    if (!order) throw new NotFoundError("Sipariş");

    await this.cancelOrder(order);
  }

  private async cancelOrder(order: OrderView): Promise<void> {
    if (!CANCELLABLE.includes(order.status)) {
      throw new ConflictError("Bu sipariş artık iptal edilemez");
    }

    const paid = order.paymentStatus === "PAID";

    if (paid) {
      const payment = await this.orders.getPaymentForOrder(order.id);
      if (!payment) throw new NotFoundError("Ödeme");

      // Yalnızca kartla tahsil edilen ödeme sağlayıcı üzerinden iade edilir;
      // havale ve vadeli ödemede iade manuel yapılır. İade başarısızsa hata
      // fırlar ve sipariş değişmeden kalır.
      const refund =
        payment.method === "CARD"
          ? await this.refunder.refund({
              merchantOid: payment.merchantOid,
              amount: payment.amount,
            })
          : { providerRef: null };

      await this.orders.recordRefund(
        order.id,
        payment.amount,
        payment.method === "CARD" ? "İptal" : "İptal (manuel iade)",
        refund.providerRef,
      );
    }

    await this.orders.cancelOrder(order.id, paid);
    await this.events.publish("order.cancelled", {
      orderId: order.id,
      refunded: paid,
    });
  }

  private canAccess(order: OrderView, access: OrderAccess): boolean {
    if (access.userId && order.userId === access.userId) return true;
    return tokensMatch(order.lookupToken, access.lookupToken);
  }
}
