import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import type { PaymentRefunder } from "@/integrations/payment/payment-provider";
import type { Actor } from "../admin/orders/admin-order.service";
import type { OrderAccess } from "../orders/order.service";
import type {
  ReturnOrderRecord,
  ReturnRepository,
  ReturnRequestRecord,
} from "./return.repository";
import { calculateRefund } from "./refund-calculator";
import type {
  ReturnEligibility,
  ReturnRequestInput,
  ReturnRequestSummary,
  ReturnStatus,
} from "./return.types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** İade sonucunu müşteriye bildirir; hata iade işlemini bozmaz. */
export interface ReturnNotifier {
  onReturnDecided(info: {
    email: string;
    orderNumber: string;
    approved: boolean;
    amount: string | null;
    note: string | null;
  }): Promise<void>;
}

export interface ReturnServiceDeps {
  returns: ReturnRepository;
  /** Müşterinin siparişe erişim hakkını doğrular (sahip veya bağlantı belirteci). */
  orderAccess: {
    getForAccess(orderNumber: string, access: OrderAccess): Promise<unknown>;
  };
  refunder: PaymentRefunder;
  audit: AuditLogger;
  notifier?: ReturnNotifier;
  withdrawalPeriodDays: number;
  now?: () => Date;
}

export class ReturnService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReturnServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Müşteri tarafı: siparişin iade edilebilirlik durumu. */
  async getEligibility(
    orderNumber: string,
    access: OrderAccess,
  ): Promise<ReturnEligibility> {
    await this.deps.orderAccess.getForAccess(orderNumber, access);
    const order = await this.requireOrder(orderNumber);
    return this.evaluate(order);
  }

  async request(
    orderNumber: string,
    access: OrderAccess,
    input: ReturnRequestInput,
  ): Promise<string> {
    await this.deps.orderAccess.getForAccess(orderNumber, access);
    const order = await this.requireOrder(orderNumber);
    const eligibility = await this.evaluate(order);

    if (!eligibility.eligible) {
      throw new ConflictError(
        eligibility.reason ?? "İade talebi oluşturulamaz",
      );
    }

    const reason = input.reason.trim();
    if (!reason) throw new ValidationError("İade nedenini seçin");

    const requestable = new Map(
      eligibility.items.map((item) => [
        item.orderItemId,
        item.requestableQuantity,
      ]),
    );
    const items = input.items.filter((item) => item.quantity > 0);
    if (items.length === 0)
      throw new ValidationError("İade edilecek ürün seçin");

    for (const item of items) {
      const max = requestable.get(item.orderItemId);
      if (max === undefined) throw new ValidationError("Geçersiz ürün seçimi");
      if (!Number.isInteger(item.quantity) || item.quantity > max) {
        throw new ValidationError("İade adedi sipariş edilen adedi aşamaz");
      }
    }

    return this.deps.returns.createRequest(order.id, {
      reason,
      note: input.note?.trim() || null,
      items,
    });
  }

  async list(status?: ReturnStatus): Promise<ReturnRequestSummary[]> {
    const records = await this.deps.returns.list(status);
    return records.map((record) => this.summarize(record));
  }

  async approve(
    requestId: string,
    options: { restock: boolean },
    actor: Actor,
  ): Promise<void> {
    const request = await this.requireRequest(requestId);
    if (request.status !== "REQUESTED") {
      throw new ConflictError("Bu talep zaten işlenmiş");
    }
    if (!request.order.merchantOid) throw new NotFoundError("Ödeme");

    const amount = this.refundAmount(request);

    // Önce sağlayıcıdan iade alınır; başarısızsa talep açık kalır.
    const refund = await this.deps.refunder.refund({
      merchantOid: request.order.merchantOid,
      amount,
    });

    await this.deps.returns.complete(requestId, {
      amount,
      providerRef: refund.providerRef,
      restock: options.restock,
    });

    await this.deps.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "return.approve",
      entityType: "ReturnRequest",
      entityId: requestId,
      after: {
        amount,
        restock: options.restock,
        order: request.order.orderNumber,
      },
    });

    await this.notify(request, true, amount, null);
  }

  async reject(
    requestId: string,
    adminNote: string | null,
    actor: Actor,
  ): Promise<void> {
    const request = await this.requireRequest(requestId);
    const rejected = await this.deps.returns.reject(
      requestId,
      adminNote?.trim() || null,
    );
    if (!rejected) throw new ConflictError("Bu talep zaten işlenmiş");

    await this.deps.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "return.reject",
      entityType: "ReturnRequest",
      entityId: requestId,
      after: { adminNote, order: request.order.orderNumber },
    });

    await this.notify(request, false, null, adminNote?.trim() || null);
  }

  private async notify(
    request: ReturnRequestRecord,
    approved: boolean,
    amount: string | null,
    note: string | null,
  ): Promise<void> {
    if (!this.deps.notifier || !request.order.email) return;
    try {
      await this.deps.notifier.onReturnDecided({
        email: request.order.email,
        orderNumber: request.order.orderNumber,
        approved,
        amount,
        note,
      });
    } catch {
      // İade zaten tamamlandı; bildirim hatası işlemi geri almamalı.
    }
  }

  private async requireOrder(orderNumber: string): Promise<ReturnOrderRecord> {
    const order = await this.deps.returns.findOrder(orderNumber);
    if (!order) throw new NotFoundError("Sipariş");
    return order;
  }

  private async requireRequest(
    requestId: string,
  ): Promise<ReturnRequestRecord> {
    const request = await this.deps.returns.get(requestId);
    if (!request) throw new NotFoundError("İade talebi");
    return request;
  }

  private async evaluate(order: ReturnOrderRecord): Promise<ReturnEligibility> {
    const requested = await this.deps.returns.requestedQuantities(order.id);
    const items = order.items.map((item) => ({
      orderItemId: item.id,
      productName: item.productName,
      variantName: item.variantName,
      unitPrice: item.unitPrice.toFixed(2),
      orderedQuantity: item.quantity,
      requestableQuantity: Math.max(
        0,
        item.quantity - (requested.get(item.id) ?? 0),
      ),
    }));

    const base = { items, deadline: null as Date | null };

    if (order.status !== "SHIPPED" && order.status !== "DELIVERED") {
      return {
        ...base,
        eligible: false,
        reason: "İade talebi, kargolanan siparişler için oluşturulabilir",
      };
    }

    const reference = order.deliveredAt ?? order.shippedAt ?? order.createdAt;
    const deadline = new Date(
      reference.getTime() + this.deps.withdrawalPeriodDays * DAY_MS,
    );
    if (this.now() > deadline) {
      return {
        ...base,
        deadline,
        eligible: false,
        reason: `İade süresi (${this.deps.withdrawalPeriodDays} gün) dolmuş`,
      };
    }

    if (items.every((item) => item.requestableQuantity === 0)) {
      return {
        ...base,
        deadline,
        eligible: false,
        reason: "Tüm ürünler için iade talebi oluşturulmuş",
      };
    }

    return { ...base, deadline, eligible: true, reason: null };
  }

  private refundAmount(request: ReturnRequestRecord): string {
    return calculateRefund(
      request.items.map((item) => ({
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      request.order.subtotal,
      request.order.discountTotal,
    ).toFixed(2);
  }

  private summarize(record: ReturnRequestRecord): ReturnRequestSummary {
    return {
      id: record.id,
      orderNumber: record.order.orderNumber,
      email: record.order.email,
      status: record.status,
      reason: record.reason,
      note: record.note,
      adminNote: record.adminNote,
      createdAt: record.createdAt,
      items: record.items.map((item) => ({
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
      })),
      refundAmount: this.refundAmount(record),
    };
  }
}
