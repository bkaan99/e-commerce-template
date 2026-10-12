import type { Prisma } from "../../../../generated/prisma/client";
import type { PrismaClient } from "@/shared/prisma-client";
import type { OrderStatus } from "../../orders/order.types";

export interface AdminOrderListQuery {
  status?: OrderStatus;
  search?: string;
  page: number;
  pageSize: number;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  email: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: string;
  grandTotal: string;
  currency: string;
  itemCount: number;
  createdAt: Date;
}

export interface AdminOrderList {
  items: AdminOrderRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  email: string;
  userId: string | null;
  source: string;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  couponCode: string | null;
  customerNote: string | null;
  createdAt: Date;
  shippingAddress: Record<string, string | null>;
  billingAddress: Record<string, string | null>;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    sku: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }[];
  payments: {
    provider: string;
    method: "CARD" | "BANK_TRANSFER" | "DEFERRED";
    status: string;
    amount: string;
    merchantOid: string;
    paidAt: Date | null;
    dueAt: Date | null;
  }[];
  shipments: {
    carrier: string;
    trackingNumber: string | null;
    status: string;
    shippedAt: Date | null;
  }[];
  returns: {
    id: string;
    status: string;
    reason: string;
    createdAt: Date;
  }[];
}

export interface AdminOrderRepository {
  list(query: AdminOrderListQuery): Promise<AdminOrderList>;
  findDetail(orderNumber: string): Promise<AdminOrderDetail | null>;
  /** `from` içindeki bir durumdaysa `to`'ya geçirir; geçiş yapılamadıysa false. */
  transition(
    orderId: string,
    from: readonly OrderStatus[],
    to: OrderStatus,
  ): Promise<boolean>;
  createShipment(
    orderId: string,
    data: { carrier: string; trackingNumber: string | null },
  ): Promise<void>;
  markShipmentsDelivered(orderId: string): Promise<void>;
}

function toAddress(json: unknown): Record<string, string | null> {
  return (json ?? {}) as Record<string, string | null>;
}

export class PrismaAdminOrderRepository implements AdminOrderRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async list(query: AdminOrderListQuery): Promise<AdminOrderList> {
    const search = query.search?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { guestEmail: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.db().order.count({ where }),
      this.db().order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { items: { select: { quantity: true } } },
      }),
    ]);

    return {
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      items: rows.map((row) => {
        const address = toAddress(row.shippingAddress);
        return {
          id: row.id,
          orderNumber: row.orderNumber,
          email: row.guestEmail ?? "",
          customerName:
            `${address["firstName"] ?? ""} ${address["lastName"] ?? ""}`.trim(),
          status: row.status,
          paymentStatus: row.paymentStatus,
          grandTotal: row.grandTotal.toFixed(2),
          currency: row.currency,
          itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: row.createdAt,
        };
      }),
    };
  }

  async findDetail(orderNumber: string): Promise<AdminOrderDetail | null> {
    const row = await this.db().order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" } },
        shipments: { orderBy: { createdAt: "desc" } },
        returns: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      paymentStatus: row.paymentStatus,
      email: row.guestEmail ?? "",
      userId: row.userId,
      source: row.source,
      currency: row.currency,
      subtotal: row.subtotal.toFixed(2),
      discountTotal: row.discountTotal.toFixed(2),
      shippingTotal: row.shippingTotal.toFixed(2),
      taxTotal: row.taxTotal.toFixed(2),
      grandTotal: row.grandTotal.toFixed(2),
      couponCode: row.couponCode,
      customerNote: row.customerNote,
      createdAt: row.createdAt,
      shippingAddress: toAddress(row.shippingAddress),
      billingAddress: toAddress(row.billingAddress),
      items: row.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        unitPrice: item.unitPrice.toFixed(2),
        quantity: item.quantity,
        lineTotal: item.lineTotal.toFixed(2),
      })),
      payments: row.payments.map((payment) => ({
        provider: payment.provider,
        method: payment.method,
        status: payment.status,
        amount: payment.amount.toFixed(2),
        merchantOid: payment.merchantOid,
        paidAt: payment.paidAt,
        dueAt: payment.dueAt,
      })),
      shipments: row.shipments.map((shipment) => ({
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        shippedAt: shipment.shippedAt,
      })),
      returns: row.returns.map((request) => ({
        id: request.id,
        status: request.status,
        reason: request.reason,
        createdAt: request.createdAt,
      })),
    };
  }

  async transition(
    orderId: string,
    from: readonly OrderStatus[],
    to: OrderStatus,
  ): Promise<boolean> {
    const result = await this.db().order.updateMany({
      where: { id: orderId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count > 0;
  }

  async createShipment(
    orderId: string,
    data: { carrier: string; trackingNumber: string | null },
  ): Promise<void> {
    await this.db().shipment.create({
      data: {
        orderId,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        status: "SHIPPED",
        shippedAt: new Date(),
      },
    });
  }

  async markShipmentsDelivered(orderId: string): Promise<void> {
    await this.db().shipment.updateMany({
      where: { orderId, status: "SHIPPED" },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
  }
}
