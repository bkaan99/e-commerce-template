import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit";
import type { EventBus } from "@/shared/events/event-bus";
import type { OrderRepository } from "../../orders/order.repository";
import type { OrderService } from "../../orders/order.service";
import type { OrderStatus } from "../../orders/order.types";
import type {
  AdminOrderDetail,
  AdminOrderList,
  AdminOrderListQuery,
  AdminOrderRepository,
} from "./admin-order.repository";
import { allowedTransitions, isStaffCancellable } from "./order-state";

export interface Actor {
  userId: string;
  ip?: string | null;
}

export interface ShipInput {
  carrier: string;
  trackingNumber: string | null;
}

export const CARRIERS = [
  "Yurtiçi Kargo",
  "Aras Kargo",
  "MNG Kargo",
  "PTT Kargo",
  "Diğer",
] as const;

/** Personelin siparişi yönettiği uygulama servisi; her değişiklik denetim kaydına yazılır. */
export class AdminOrderService {
  constructor(
    private readonly orders: AdminOrderRepository,
    private readonly orderService: Pick<OrderService, "cancelByStaff">,
    private readonly events: EventBus,
    private readonly audit: AuditLogger,
    private readonly payments: Pick<
      OrderRepository,
      "applyPaymentResult" | "markDeferredPaid"
    >,
  ) {}

  list(query: AdminOrderListQuery): Promise<AdminOrderList> {
    return this.orders.list(query);
  }

  async get(orderNumber: string): Promise<AdminOrderDetail> {
    const order = await this.orders.findDetail(orderNumber);
    if (!order) throw new NotFoundError("Sipariş");
    return order;
  }

  async markProcessing(orderNumber: string, actor: Actor): Promise<void> {
    await this.move(orderNumber, "PROCESSING", actor);
  }

  async ship(
    orderNumber: string,
    input: ShipInput,
    actor: Actor,
  ): Promise<void> {
    const carrier = input.carrier.trim();
    if (!carrier) throw new ValidationError("Kargo firması seçin");
    const trackingNumber = input.trackingNumber?.trim() || null;

    const order = await this.get(orderNumber);
    await this.assertTransition(order.status, "SHIPPED");

    const moved = await this.orders.transition(
      order.id,
      allowedFrom("SHIPPED"),
      "SHIPPED",
    );
    if (!moved)
      throw new ConflictError("Sipariş durumu değişmiş, sayfayı yenileyin");

    await this.orders.createShipment(order.id, { carrier, trackingNumber });
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "order.ship",
      entityType: "Order",
      entityId: order.id,
      before: { status: order.status },
      after: { status: "SHIPPED", carrier, trackingNumber },
    });
    await this.events.publish("order.shipped", {
      orderId: order.id,
      trackingNumber,
    });
  }

  async markDelivered(orderNumber: string, actor: Actor): Promise<void> {
    const order = await this.get(orderNumber);
    await this.move(orderNumber, "DELIVERED", actor);
    await this.orders.markShipmentsDelivered(order.id);
  }

  /** Havale/EFT'nin hesaba geçtiğini onaylar; sipariş ödenmiş sayılır ve stok düşer. */
  async confirmBankTransfer(orderNumber: string, actor: Actor): Promise<void> {
    const order = await this.get(orderNumber);
    const payment = order.payments[0];

    if (
      !payment ||
      payment.method !== "BANK_TRANSFER" ||
      order.status !== "PENDING_PAYMENT"
    ) {
      throw new ConflictError("Bu sipariş için havale onayı yapılamaz");
    }

    const outcome = await this.payments.applyPaymentResult({
      merchantOid: payment.merchantOid,
      success: true,
      amount: payment.amount,
      failureReason: null,
      rawPayload: { source: "manual", confirmedBy: actor.userId },
    });

    if (outcome.kind !== "paid") {
      throw new ConflictError(
        "Ödeme onaylanamadı; sipariş süresi dolmuş veya zaten işlenmiş olabilir",
      );
    }

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "order.bank-transfer.confirm",
      entityType: "Order",
      entityId: order.id,
      before: { status: order.status, paymentStatus: order.paymentStatus },
      after: { status: "PAID", amount: payment.amount },
    });
    await this.events.publish("order.paid", { orderId: order.id });
  }

  /** Vadeli siparişin tahsil edildiğini işaretler. */
  async markDeferredCollected(
    orderNumber: string,
    actor: Actor,
  ): Promise<void> {
    const order = await this.get(orderNumber);
    const payment = order.payments[0];

    if (!payment || payment.method !== "DEFERRED") {
      throw new ConflictError("Bu sipariş vadeli ödemeli değil");
    }

    const updated = await this.payments.markDeferredPaid(order.id);
    if (!updated) throw new ConflictError("Ödeme zaten tahsil edilmiş");

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "order.deferred.collected",
      entityType: "Order",
      entityId: order.id,
      before: { paymentStatus: order.paymentStatus },
      after: { paymentStatus: "PAID", amount: payment.amount },
    });
  }

  async cancel(orderNumber: string, actor: Actor): Promise<void> {
    const order = await this.get(orderNumber);
    if (!isStaffCancellable(order.status)) {
      throw new ConflictError("Bu sipariş artık iptal edilemez");
    }

    await this.orderService.cancelByStaff(orderNumber);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "order.cancel",
      entityType: "Order",
      entityId: order.id,
      before: { status: order.status, paymentStatus: order.paymentStatus },
    });
  }

  private async move(
    orderNumber: string,
    to: OrderStatus,
    actor: Actor,
  ): Promise<void> {
    const order = await this.get(orderNumber);
    await this.assertTransition(order.status, to);

    const moved = await this.orders.transition(order.id, allowedFrom(to), to);
    if (!moved)
      throw new ConflictError("Sipariş durumu değişmiş, sayfayı yenileyin");

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: `order.${to.toLowerCase()}`,
      entityType: "Order",
      entityId: order.id,
      before: { status: order.status },
      after: { status: to },
    });
  }

  private async assertTransition(
    from: OrderStatus,
    to: OrderStatus,
  ): Promise<void> {
    if (!allowedTransitions(from).includes(to)) {
      throw new ConflictError("Bu durum geçişi yapılamaz");
    }
  }
}

/** `to` durumuna geçebilen tüm kaynak durumlar (eşzamanlılık koruması için). */
function allowedFrom(to: OrderStatus): OrderStatus[] {
  const all: OrderStatus[] = [
    "PENDING_PAYMENT",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];
  return all.filter((status) => allowedTransitions(status).includes(to));
}
