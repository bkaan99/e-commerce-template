import type { PrismaClient } from "@/shared/prisma-client";
import type {
  AlertVariantRecord,
  PendingSubscription,
  StockAlertRepository,
} from "./stock-alert.service";

const variantSelect = {
  id: true,
  isActive: true,
  stockQuantity: true,
  reservedQuantity: true,
  product: {
    select: { name: true, slug: true, status: true, trackInventory: true },
  },
} as const;

type VariantRow = {
  id: string;
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  product: {
    name: string;
    slug: string;
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    trackInventory: boolean;
  };
};

function toRecord(row: VariantRow): AlertVariantRecord {
  return {
    variantId: row.id,
    isActive: row.isActive,
    productActive: row.product.status === "ACTIVE",
    productName: row.product.name,
    productSlug: row.product.slug,
    trackInventory: row.product.trackInventory,
    stockQuantity: row.stockQuantity,
    reservedQuantity: row.reservedQuantity,
  };
}

export class PrismaStockAlertRepository implements StockAlertRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async findVariant(variantId: string): Promise<AlertVariantRecord | null> {
    const row = await this.db().productVariant.findUnique({
      where: { id: variantId },
      select: variantSelect,
    });
    return row ? toRecord(row) : null;
  }

  async upsertSubscription(variantId: string, email: string): Promise<void> {
    await this.db().backInStockSubscription.upsert({
      where: { variantId_email: { variantId, email } },
      // Daha önce bildirilmişse yeniden beklemeye alınır.
      update: { notifiedAt: null },
      create: { variantId, email },
    });
  }

  async listPending(limit: number): Promise<PendingSubscription[]> {
    const rows = await this.db().backInStockSubscription.findMany({
      where: { notifiedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: { variant: { select: variantSelect } },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      variant: toRecord(row.variant),
    }));
  }

  async listPendingForVariant(
    variantId: string,
  ): Promise<PendingSubscription[]> {
    const rows = await this.db().backInStockSubscription.findMany({
      where: { variantId, notifiedAt: null },
      include: { variant: { select: variantSelect } },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      variant: toRecord(row.variant),
    }));
  }

  async markNotified(subscriptionIds: string[]): Promise<void> {
    if (subscriptionIds.length === 0) return;
    await this.db().backInStockSubscription.updateMany({
      where: { id: { in: subscriptionIds } },
      data: { notifiedAt: new Date() },
    });
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.db().backInStockSubscription.deleteMany({
      where: { id: subscriptionId },
    });
  }
}
