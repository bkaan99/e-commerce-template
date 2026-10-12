import { randomBytes, randomInt } from "node:crypto";
import Decimal from "decimal.js";
import type { Prisma } from "../../../generated/prisma/client";
import { ConflictError, NotFoundError } from "@/shared/errors";
import type { PrismaClient } from "@/shared/prisma-client";
import type {
  AddressSnapshot,
  CreatedOrder,
  NewOrder,
  OrderView,
  PaymentOutcome,
} from "./order.types";

export interface PaymentResultInput {
  merchantOid: string;
  success: boolean;
  /** Sağlayıcının bildirdiği tutar (ondalık string) */
  amount: string;
  failureReason: string | null;
  rawPayload: Record<string, string>;
}

export interface DeferredTerms {
  /** Bayinin kredi limiti (ondalık string) */
  creditLimit: string;
  dueAt: Date;
}

export interface OrderRepository {
  createPendingOrder(order: NewOrder): Promise<CreatedOrder>;
  /**
   * Vadeli ödemeli siparişi oluşturur: kredi limiti kontrolü ve stok düşümü
   * tek transaction'da yapılır (aynı bayinin eşzamanlı siparişleri sıraya girer).
   */
  createDeferredOrder(
    order: NewOrder,
    terms: DeferredTerms,
  ): Promise<CreatedOrder>;
  /** Vadeli siparişin tahsil edildiğini işaretler; zaten ödenmişse false döner. */
  markDeferredPaid(orderId: string): Promise<boolean>;
  findById(orderId: string): Promise<OrderView | null>;
  findByOrderNumber(orderNumber: string): Promise<OrderView | null>;
  findByLookupToken(token: string): Promise<OrderView | null>;
  listByUser(userId: string): Promise<OrderView[]>;
  getPaymentForOrder(orderId: string): Promise<{
    merchantOid: string;
    amount: string;
    currency: string;
    status: string;
    provider: string;
    method: "CARD" | "BANK_TRANSFER" | "DEFERRED";
  } | null>;
  applyPaymentResult(input: PaymentResultInput): Promise<PaymentOutcome>;
  /** Siparişi iptal eder; stoğu/rezervasyonu geri alır. İade ayrı yapılır. */
  cancelOrder(orderId: string, markRefunded: boolean): Promise<void>;
  recordRefund(
    orderId: string,
    amount: string,
    reason: string | null,
    providerRef: string | null,
  ): Promise<void>;
  /** Süresi dolan rezervasyonları bırakır ve ödemesi bekleyen siparişleri iptal eder. */
  releaseExpired(now: Date): Promise<number>;
  countCouponUses(
    code: string,
    owner: { userId: string | null; email: string },
  ): Promise<number>;
}

const ORDER_NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateOrderNumber(): string {
  let value = "S";
  for (let i = 0; i < 10; i += 1) {
    value += ORDER_NUMBER_ALPHABET[randomInt(ORDER_NUMBER_ALPHABET.length)];
  }
  return value;
}

function toAddress(json: unknown): AddressSnapshot {
  return json as AddressSnapshot;
}

const orderInclude = {
  items: true,
  shipments: { orderBy: { createdAt: "desc" }, take: 1 },
  payments: { orderBy: { createdAt: "desc" }, take: 1 },
} as const;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toView(row: OrderRow): OrderView {
  const shipment = row.shipments[0];

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    lookupToken: row.lookupToken,
    status: row.status,
    paymentStatus: row.paymentStatus,
    email: row.guestEmail ?? "",
    currency: row.currency,
    subtotal: row.subtotal.toFixed(2),
    discountTotal: row.discountTotal.toFixed(2),
    shippingTotal: row.shippingTotal.toFixed(2),
    taxTotal: row.taxTotal.toFixed(2),
    grandTotal: row.grandTotal.toFixed(2),
    couponCode: row.couponCode,
    shippingAddress: toAddress(row.shippingAddress),
    billingAddress: toAddress(row.billingAddress),
    customerNote: row.customerNote,
    items: row.items.map((item) => ({
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toFixed(2),
    })),
    trackingNumber: shipment?.trackingNumber ?? null,
    carrier: shipment?.carrier ?? null,
    createdAt: row.createdAt,
    userId: row.userId,
    paymentMethod: row.payments[0]?.method ?? "CARD",
    paymentDueAt: row.payments[0]?.dueAt ?? null,
  };
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async createPendingOrder(order: NewOrder): Promise<CreatedOrder> {
    const orderNumber = generateOrderNumber();
    const lookupToken = randomBytes(24).toString("base64url");

    return this.db().$transaction(async (tx) => {
      const expiresAt = new Date(
        Date.now() + order.reservationMinutes * 60_000,
      );

      // Stok rezervasyonu: koşullu güncelleme yarış durumunu ve fazla satışı önler.
      for (const item of order.items) {
        if (!item.trackInventory) continue;

        const updated = await tx.$executeRaw`
          UPDATE "ProductVariant"
          SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}
          WHERE "id" = ${item.variantId}
            AND "isActive" = true
            AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}`;

        if (updated === 0) {
          throw new ConflictError(
            `"${item.productName}" için yeterli stok yok`,
          );
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          lookupToken,
          userId: order.userId,
          guestEmail: order.email,
          cartId: order.cartId,
          currency: order.currency,
          subtotal: order.subtotal,
          discountTotal: order.discountTotal,
          shippingTotal: order.shippingTotal,
          taxTotal: order.taxTotal,
          grandTotal: order.grandTotal,
          couponCode: order.couponCode,
          shippingAddress:
            order.shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress:
            order.billingAddress as unknown as Prisma.InputJsonValue,
          customerNote: order.customerNote,
          items: {
            create: order.items.map((item) => ({
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
          payments: {
            create: {
              provider: order.paymentProvider,
              method: order.paymentMethod,
              amount: order.grandTotal,
              currency: order.currency,
              merchantOid: orderNumber,
            },
          },
        },
        select: { id: true },
      });

      const reservations = order.items.filter((item) => item.trackInventory);
      if (reservations.length > 0) {
        await tx.stockReservation.createMany({
          data: reservations.map((item) => ({
            variantId: item.variantId,
            orderId: created.id,
            quantity: item.quantity,
            expiresAt,
          })),
        });
      }

      return {
        orderId: created.id,
        orderNumber,
        lookupToken,
        merchantOid: orderNumber,
      };
    });
  }

  async createDeferredOrder(
    order: NewOrder,
    terms: DeferredTerms,
  ): Promise<CreatedOrder> {
    const orderNumber = generateOrderNumber();
    const lookupToken = randomBytes(24).toString("base64url");

    return this.db().$transaction(async (tx) => {
      if (!order.userId) {
        throw new ConflictError("Vadeli ödeme yalnızca üye bayiler içindir");
      }

      // Aynı bayinin eşzamanlı siparişlerini sıraya sokar (limit aşımı yarışı).
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "userId" = ${order.userId} FOR UPDATE`;

      const outstanding = await tx.order.aggregate({
        where: {
          userId: order.userId,
          paymentStatus: "PENDING",
          status: { notIn: ["CANCELLED", "REFUNDED", "PENDING_PAYMENT"] },
          payments: { some: { method: "DEFERRED" } },
        },
        _sum: { grandTotal: true },
      });
      const used = new Decimal(outstanding._sum.grandTotal?.toString() ?? 0);
      const requested = new Decimal(order.grandTotal);
      const limit = new Decimal(terms.creditLimit);

      if (used.plus(requested).gt(limit)) {
        const available = Decimal.max(limit.minus(used), 0);
        throw new ConflictError(
          `Kredi limitiniz yetersiz (kullanılabilir: ${available.toFixed(2)} TL)`,
        );
      }

      // Vadeli siparişte stok rezerve edilmez, doğrudan düşülür.
      for (const item of order.items) {
        if (!item.trackInventory) continue;

        const updated = await tx.$executeRaw`
          UPDATE "ProductVariant"
          SET "stockQuantity" = "stockQuantity" - ${item.quantity}
          WHERE "id" = ${item.variantId}
            AND "isActive" = true
            AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}`;

        if (updated === 0) {
          throw new ConflictError(
            `"${item.productName}" için yeterli stok yok`,
          );
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          lookupToken,
          userId: order.userId,
          guestEmail: order.email,
          cartId: order.cartId,
          status: "PROCESSING",
          paymentStatus: "PENDING",
          currency: order.currency,
          subtotal: order.subtotal,
          discountTotal: order.discountTotal,
          shippingTotal: order.shippingTotal,
          taxTotal: order.taxTotal,
          grandTotal: order.grandTotal,
          couponCode: order.couponCode,
          shippingAddress:
            order.shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress:
            order.billingAddress as unknown as Prisma.InputJsonValue,
          customerNote: order.customerNote,
          items: {
            create: order.items.map((item) => ({
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
          payments: {
            create: {
              provider: "deferred",
              method: "DEFERRED",
              amount: order.grandTotal,
              currency: order.currency,
              merchantOid: orderNumber,
              dueAt: terms.dueAt,
            },
          },
        },
        select: { id: true },
      });

      if (order.couponCode) {
        await tx.coupon.updateMany({
          where: { code: order.couponCode },
          data: { usedCount: { increment: 1 } },
        });
      }
      if (order.cartId) {
        await tx.cart.deleteMany({ where: { id: order.cartId } });
      }

      return {
        orderId: created.id,
        orderNumber,
        lookupToken,
        merchantOid: orderNumber,
      };
    });
  }

  async markDeferredPaid(orderId: string): Promise<boolean> {
    return this.db().$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { orderId, method: "DEFERRED", status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (claimed.count === 0) return false;

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID" },
      });
      return true;
    });
  }

  async findById(orderId: string): Promise<OrderView | null> {
    const row = await this.db().order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    return row ? toView(row) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<OrderView | null> {
    const row = await this.db().order.findUnique({
      where: { orderNumber },
      include: orderInclude,
    });
    return row ? toView(row) : null;
  }

  async findByLookupToken(token: string): Promise<OrderView | null> {
    const row = await this.db().order.findUnique({
      where: { lookupToken: token },
      include: orderInclude,
    });
    return row ? toView(row) : null;
  }

  async listByUser(userId: string): Promise<OrderView[]> {
    const rows = await this.db().order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    });
    return rows.map(toView);
  }

  async getPaymentForOrder(orderId: string) {
    const payment = await this.db().payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) return null;

    return {
      merchantOid: payment.merchantOid,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      method: payment.method,
    };
  }

  async applyPaymentResult(input: PaymentResultInput): Promise<PaymentOutcome> {
    return this.db().$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { merchantOid: input.merchantOid },
        include: { order: true },
      });
      if (!payment) return { kind: "not-found" } as const;

      // Aynı bildirim tekrar gelirse: yalnızca PENDING ödeme işlenir (idempotent).
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: input.success ? "PAID" : "FAILED",
          rawPayload: input.rawPayload as Prisma.InputJsonValue,
          paidAt: input.success ? new Date() : null,
        },
      });
      if (claimed.count === 0) {
        return { kind: "already-processed", orderId: payment.orderId } as const;
      }

      const orderId = payment.orderId;

      if (input.success && !new Decimal(input.amount).eq(payment.amount)) {
        // Tutar uyuşmuyor: ödeme kabul edilmez, inceleme için işaretlenir.
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        return { kind: "amount-mismatch", orderId } as const;
      }

      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: "ACTIVE" },
      });

      if (input.success) {
        for (const reservation of reservations) {
          await tx.productVariant.update({
            where: { id: reservation.variantId },
            data: {
              stockQuantity: { decrement: reservation.quantity },
              reservedQuantity: { decrement: reservation.quantity },
            },
          });
        }
        await tx.stockReservation.updateMany({
          where: { orderId, status: "ACTIVE" },
          data: { status: "CONSUMED" },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: "PAID", paymentStatus: "PAID" },
        });
        if (payment.order.couponCode) {
          await tx.coupon.updateMany({
            where: { code: payment.order.couponCode },
            data: { usedCount: { increment: 1 } },
          });
        }
        if (payment.order.cartId) {
          await tx.cart.deleteMany({ where: { id: payment.order.cartId } });
        }
        return { kind: "paid", orderId } as const;
      }

      for (const reservation of reservations) {
        await tx.productVariant.update({
          where: { id: reservation.variantId },
          data: { reservedQuantity: { decrement: reservation.quantity } },
        });
      }
      await tx.stockReservation.updateMany({
        where: { orderId, status: "ACTIVE" },
        data: { status: "RELEASED" },
      });
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          paymentStatus: "FAILED",
          cancelledAt: new Date(),
        },
      });
      return { kind: "failed", orderId } as const;
    });
  }

  async cancelOrder(orderId: string, markRefunded: boolean): Promise<void> {
    await this.db().$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!order) throw new NotFoundError("Sipariş");

      // Ödenmiş siparişte ve vadeli (stoğu doğrudan düşülmüş) siparişte stok geri yüklenir.
      const wasPaid = order.paymentStatus === "PAID";
      const stockConsumed = wasPaid || order.payments[0]?.method === "DEFERRED";

      if (stockConsumed) {
        // Düşülmüş stok iade edilir.
        for (const item of order.items) {
          if (!item.variantId) continue;
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { product: { select: { trackInventory: true } } },
          });
          if (variant?.product.trackInventory) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      } else {
        const reservations = await tx.stockReservation.findMany({
          where: { orderId, status: "ACTIVE" },
        });
        for (const reservation of reservations) {
          await tx.productVariant.update({
            where: { id: reservation.variantId },
            data: { reservedQuantity: { decrement: reservation.quantity } },
          });
        }
        await tx.stockReservation.updateMany({
          where: { orderId, status: "ACTIVE" },
          data: { status: "RELEASED" },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: markRefunded ? "REFUNDED" : "CANCELLED",
          paymentStatus: markRefunded ? "REFUNDED" : order.paymentStatus,
          cancelledAt: new Date(),
        },
      });
    });
  }

  async recordRefund(
    orderId: string,
    amount: string,
    reason: string | null,
    providerRef: string | null,
  ): Promise<void> {
    const payment = await this.db().payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) throw new NotFoundError("Ödeme");

    await this.db().refund.create({
      data: {
        paymentId: payment.id,
        amount,
        reason,
        providerRef,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    await this.db().payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });
  }

  async releaseExpired(now: Date): Promise<number> {
    const expired = await this.db().stockReservation.findMany({
      where: { status: "ACTIVE", expiresAt: { lt: now } },
      select: { orderId: true },
    });
    const orderIds = [
      ...new Set(
        expired.map((r) => r.orderId).filter((id): id is string => id !== null),
      ),
    ];

    let released = 0;
    for (const orderId of orderIds) {
      const order = await this.db().order.findUnique({
        where: { id: orderId },
        select: { status: true, paymentStatus: true },
      });
      // Yalnızca ödemesi hâlâ beklenen siparişler iptal edilir.
      if (
        order?.status === "PENDING_PAYMENT" &&
        order.paymentStatus === "PENDING"
      ) {
        await this.cancelOrder(orderId, false);
        await this.db().payment.updateMany({
          where: { orderId, status: "PENDING" },
          data: { status: "FAILED" },
        });
        released += 1;
      }
    }
    return released;
  }

  async countCouponUses(
    code: string,
    owner: { userId: string | null; email: string },
  ): Promise<number> {
    return this.db().order.count({
      where: {
        couponCode: code,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        OR: [
          ...(owner.userId ? [{ userId: owner.userId }] : []),
          { guestEmail: owner.email },
        ],
      },
    });
  }
}
