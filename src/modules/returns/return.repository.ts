import type Decimal from "decimal.js";
import { NotFoundError } from "@/shared/errors";
import type { PrismaClient } from "@/shared/prisma-client";
import type { ReturnStatus } from "./return.types";

export interface ReturnOrderRecord {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  paymentStatus: string;
  subtotal: Decimal;
  discountTotal: Decimal;
  grandTotal: Decimal;
  createdAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    unitPrice: Decimal;
    quantity: number;
  }[];
}

export interface ReturnRequestRecord {
  id: string;
  status: ReturnStatus;
  reason: string;
  note: string | null;
  adminNote: string | null;
  createdAt: Date;
  order: {
    id: string;
    orderNumber: string;
    email: string;
    subtotal: Decimal;
    discountTotal: Decimal;
    grandTotal: Decimal;
    merchantOid: string | null;
  };
  items: {
    orderItemId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    unitPrice: Decimal;
    quantity: number;
    trackInventory: boolean;
  }[];
}

export interface ReturnRepository {
  findOrder(orderNumber: string): Promise<ReturnOrderRecord | null>;
  /** İptal edilmemiş (reddedilmemiş) taleplerde ürün başına iade istenen adet. */
  requestedQuantities(orderId: string): Promise<Map<string, number>>;
  createRequest(
    orderId: string,
    data: {
      reason: string;
      note: string | null;
      items: { orderItemId: string; quantity: number }[];
    },
  ): Promise<string>;
  list(status?: ReturnStatus): Promise<ReturnRequestRecord[]>;
  get(requestId: string): Promise<ReturnRequestRecord | null>;
  reject(requestId: string, adminNote: string | null): Promise<boolean>;
  /** Talebi tamamlar, iade kaydı açar, isteğe bağlı stoğu geri yükler. */
  complete(
    requestId: string,
    data: { amount: string; providerRef: string | null; restock: boolean },
  ): Promise<void>;
}

export class PrismaReturnRepository implements ReturnRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async findOrder(orderNumber: string): Promise<ReturnOrderRecord | null> {
    const row = await this.db().order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        shipments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      orderNumber: row.orderNumber,
      email: row.guestEmail ?? "",
      status: row.status,
      paymentStatus: row.paymentStatus,
      subtotal: row.subtotal,
      discountTotal: row.discountTotal,
      grandTotal: row.grandTotal,
      createdAt: row.createdAt,
      shippedAt: row.shipments[0]?.shippedAt ?? null,
      deliveredAt: row.shipments[0]?.deliveredAt ?? null,
      items: row.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    };
  }

  async requestedQuantities(orderId: string): Promise<Map<string, number>> {
    const rows = await this.db().returnRequestItem.findMany({
      where: {
        returnRequest: { orderId, status: { not: "REJECTED" } },
      },
      select: { orderItemId: true, quantity: true },
    });

    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(
        row.orderItemId,
        (totals.get(row.orderItemId) ?? 0) + row.quantity,
      );
    }
    return totals;
  }

  async createRequest(
    orderId: string,
    data: {
      reason: string;
      note: string | null;
      items: { orderItemId: string; quantity: number }[];
    },
  ): Promise<string> {
    const created = await this.db().returnRequest.create({
      data: {
        orderId,
        reason: data.reason,
        note: data.note,
        items: { create: data.items },
      },
      select: { id: true },
    });
    return created.id;
  }

  private async toRecord(id: string): Promise<ReturnRequestRecord | null> {
    const row = await this.db().returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
        },
        items: {
          include: {
            orderItem: {
              include: {
                variant: {
                  select: { product: { select: { trackInventory: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!row) return null;
    return this.map(row);
  }

  private map(row: {
    id: string;
    status: string;
    reason: string;
    note: string | null;
    adminNote: string | null;
    createdAt: Date;
    order: {
      id: string;
      orderNumber: string;
      guestEmail: string | null;
      subtotal: Decimal;
      discountTotal: Decimal;
      grandTotal: Decimal;
      payments: { merchantOid: string }[];
    };
    items: {
      orderItemId: string;
      quantity: number;
      orderItem: {
        variantId: string | null;
        productName: string;
        variantName: string | null;
        unitPrice: Decimal;
        variant: { product: { trackInventory: boolean } } | null;
      };
    }[];
  }): ReturnRequestRecord {
    return {
      id: row.id,
      status: row.status as ReturnStatus,
      reason: row.reason,
      note: row.note,
      adminNote: row.adminNote,
      createdAt: row.createdAt,
      order: {
        id: row.order.id,
        orderNumber: row.order.orderNumber,
        email: row.order.guestEmail ?? "",
        subtotal: row.order.subtotal,
        discountTotal: row.order.discountTotal,
        grandTotal: row.order.grandTotal,
        merchantOid: row.order.payments[0]?.merchantOid ?? null,
      },
      items: row.items.map((item) => ({
        orderItemId: item.orderItemId,
        variantId: item.orderItem.variantId,
        productName: item.orderItem.productName,
        variantName: item.orderItem.variantName,
        unitPrice: item.orderItem.unitPrice,
        quantity: item.quantity,
        trackInventory: item.orderItem.variant?.product.trackInventory ?? false,
      })),
    };
  }

  async list(status?: ReturnStatus): Promise<ReturnRequestRecord[]> {
    const rows = await this.db().returnRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        order: {
          include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
        },
        items: {
          include: {
            orderItem: {
              include: {
                variant: {
                  select: { product: { select: { trackInventory: true } } },
                },
              },
            },
          },
        },
      },
    });
    return rows.map((row) => this.map(row));
  }

  get(requestId: string): Promise<ReturnRequestRecord | null> {
    return this.toRecord(requestId);
  }

  async reject(requestId: string, adminNote: string | null): Promise<boolean> {
    const result = await this.db().returnRequest.updateMany({
      where: { id: requestId, status: "REQUESTED" },
      data: { status: "REJECTED", adminNote, resolvedAt: new Date() },
    });
    return result.count > 0;
  }

  async complete(
    requestId: string,
    data: { amount: string; providerRef: string | null; restock: boolean },
  ): Promise<void> {
    await this.db().$transaction(async (tx) => {
      const request = await tx.returnRequest.findUnique({
        where: { id: requestId },
        include: {
          items: { include: { orderItem: true } },
          order: {
            include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
      });
      if (!request) throw new NotFoundError("İade talebi");

      const claimed = await tx.returnRequest.updateMany({
        where: { id: requestId, status: "REQUESTED" },
        data: { status: "COMPLETED", resolvedAt: new Date() },
      });
      if (claimed.count === 0) return;

      const payment = request.order.payments[0];
      if (payment) {
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            amount: data.amount,
            reason: `İade talebi: ${request.reason}`,
            providerRef: data.providerRef,
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });

        const refunded = await tx.refund.aggregate({
          where: { paymentId: payment.id, status: "COMPLETED" },
          _sum: { amount: true },
        });
        const total = refunded._sum.amount ?? payment.amount.mul(0);
        const full = total.gte(payment.amount);

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
        });
        await tx.order.update({
          where: { id: request.orderId },
          data: {
            paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
            ...(full ? { status: "REFUNDED" as const } : {}),
          },
        });
      }

      if (data.restock) {
        for (const item of request.items) {
          const variantId = item.orderItem.variantId;
          if (!variantId) continue;

          const variant = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: { product: { select: { trackInventory: true } } },
          });
          if (variant?.product.trackInventory) {
            await tx.productVariant.update({
              where: { id: variantId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      }
    });
  }
}
