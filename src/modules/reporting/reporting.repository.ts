import Decimal from "decimal.js";
import type { PrismaClient } from "@/shared/prisma-client";
import type {
  CustomerMetrics,
  LowStockItem,
  PeriodTotals,
  ReportingRepository,
  StockDemandItem,
  TopProduct,
} from "./reporting.service";

/** Gelire dahil sayılan sipariş durumları (iptal ve iade hariç). */
const REVENUE_STATUSES = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] as const;

export class PrismaReportingRepository implements ReportingRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async periodTotals(from: Date, to: Date): Promise<PeriodTotals> {
    const result = await this.db().order.aggregate({
      where: {
        status: { in: [...REVENUE_STATUSES] },
        createdAt: { gte: from, lt: to },
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    });

    return {
      revenue: new Decimal(result._sum.grandTotal?.toString() ?? 0),
      orderCount: result._count._all,
    };
  }

  async topProducts(
    from: Date,
    to: Date,
    limit: number,
  ): Promise<TopProduct[]> {
    const grouped = await this.db().orderItem.groupBy({
      by: ["productName"],
      where: {
        order: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: from, lt: to },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });

    return grouped.map((row) => ({
      name: row.productName,
      quantity: row._sum.quantity ?? 0,
      revenue: new Decimal(row._sum.lineTotal?.toString() ?? 0).toFixed(2),
    }));
  }

  countOrdersToProcess(): Promise<number> {
    return this.db().order.count({
      where: { status: { in: ["PAID", "PROCESSING"] } },
    });
  }

  countOpenReturnRequests(): Promise<number> {
    return this.db().returnRequest.count({ where: { status: "REQUESTED" } });
  }

  countPendingDealers(): Promise<number> {
    return this.db().customer.count({ where: { b2bStatus: "PENDING" } });
  }

  async lowStock(threshold: number, limit: number): Promise<LowStockItem[]> {
    const rows = await this.db().productVariant.findMany({
      where: {
        isActive: true,
        product: { status: "ACTIVE", trackInventory: true },
      },
      select: {
        sku: true,
        stockQuantity: true,
        reservedQuantity: true,
        product: { select: { name: true } },
      },
    });

    return rows
      .map((row) => ({
        productName: row.product.name,
        sku: row.sku,
        available: Math.max(0, row.stockQuantity - row.reservedQuantity),
      }))
      .filter((row) => row.available <= threshold)
      .sort((a, b) => a.available - b.available)
      .slice(0, limit);
  }

  async stockDemand(limit: number): Promise<StockDemandItem[]> {
    const grouped = await this.db().backInStockSubscription.groupBy({
      by: ["variantId"],
      where: { notifiedAt: null },
      _count: { _all: true },
      orderBy: { _count: { variantId: "desc" } },
      take: limit,
    });
    if (grouped.length === 0) return [];

    const variants = await this.db().productVariant.findMany({
      where: { id: { in: grouped.map((row) => row.variantId) } },
      select: { id: true, sku: true, product: { select: { name: true } } },
    });
    const byId = new Map(variants.map((variant) => [variant.id, variant]));

    return grouped.flatMap((row) => {
      const variant = byId.get(row.variantId);
      return variant
        ? [
            {
              productName: variant.product.name,
              sku: variant.sku,
              waiting: row._count._all,
            },
          ]
        : [];
    });
  }

  async customerMetrics(from: Date, to: Date): Promise<CustomerMetrics> {
    const [newCustomers, buyerRows] = await Promise.all([
      this.db().user.count({
        where: {
          type: "CUSTOMER",
          anonymizedAt: null,
          createdAt: { gte: from, lt: to },
        },
      }),
      this.db().order.groupBy({
        by: ["userId"],
        where: {
          userId: { not: null },
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: from, lt: to },
        },
      }),
    ]);

    const buyerIds = buyerRows
      .map((row) => row.userId)
      .filter((id): id is string => id !== null);

    // Dönemden önce de gelir sayılan siparişi olanlar "tekrar eden" alıcıdır.
    const returning =
      buyerIds.length === 0
        ? []
        : await this.db().order.groupBy({
            by: ["userId"],
            where: {
              userId: { in: buyerIds },
              status: { in: [...REVENUE_STATUSES] },
              createdAt: { lt: from },
            },
          });

    return {
      newCustomers,
      buyers: buyerIds.length,
      returningBuyers: returning.length,
    };
  }
}
