import type { AuditLogger } from "@/shared/audit/audit-logger";
import type { EventBus } from "@/shared/events/event-bus";
import type {
  BulkUpdateRepository,
  VariantUpdate,
} from "../admin/import/bulk-update.service";
import type { ErpConnector, ErpStockRecord, ErpSyncReport } from "./erp.types";

const BATCH_SIZE = 500;
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

function isValid(record: ErpStockRecord): boolean {
  return (
    record.sku.trim() !== "" &&
    Number.isInteger(record.stockQuantity) &&
    record.stockQuantity >= 0 &&
    (record.price === undefined || PRICE_PATTERN.test(record.price))
  );
}

/**
 * ERP'den stok/fiyat çeker ve yalnızca değişenleri uygular. Bilinmeyen SKU'lar
 * ve geçersiz kayıtlar atlanır; toplu içe aktarmanın aksine hep-ya-hiç değildir,
 * çünkü ERP verisi sürekli akar ve tek bozuk kayıt akışı durdurmamalıdır.
 */
export class ErpSyncService {
  constructor(
    private readonly connector: ErpConnector,
    private readonly variants: BulkUpdateRepository,
    private readonly events: EventBus,
    private readonly audit: AuditLogger,
  ) {}

  async syncStock(): Promise<ErpSyncReport> {
    const records = await this.connector.fetchStock();
    const report: ErpSyncReport = {
      fetched: records.length,
      updated: 0,
      unknown: 0,
      invalid: 0,
    };

    // Aynı SKU birden fazla gelirse sonuncusu geçerlidir.
    const latest = new Map<string, ErpStockRecord>();
    for (const record of records) {
      if (!isValid(record)) {
        report.invalid++;
        continue;
      }
      latest.set(record.sku.trim().toUpperCase(), {
        ...record,
        sku: record.sku.trim(),
      });
    }

    const entries = [...latest.values()];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const existing = await this.variants.findVariantsBySku(
        batch.map((r) => r.sku),
      );
      const bySku = new Map(existing.map((v) => [v.sku.toUpperCase(), v]));

      const updates: VariantUpdate[] = [];
      const replenished: string[] = [];

      for (const record of batch) {
        const variant = bySku.get(record.sku.toUpperCase());
        if (!variant) {
          report.unknown++;
          continue;
        }

        const update: VariantUpdate = { id: variant.id };
        let changed = false;

        if (variant.stockQuantity !== record.stockQuantity) {
          update.stockQuantity = record.stockQuantity;
          changed = true;
          if (variant.stockQuantity <= 0 && record.stockQuantity > 0) {
            replenished.push(variant.id);
          }
        }
        if (
          record.price !== undefined &&
          Number(record.price) !== Number(variant.price)
        ) {
          update.price = record.price;
          changed = true;
        }
        if (changed) updates.push(update);
      }

      if (updates.length > 0) {
        await this.variants.applyUpdates(updates);
        report.updated += updates.length;
      }
      for (const variantId of replenished) {
        await this.events.publish("stock.replenished", { variantId });
      }
    }

    await this.audit.log({
      actorId: null,
      action: "erp.stock-sync",
      entityType: "ErpSync",
      entityId: this.connector.name,
      after: report,
    });

    return report;
  }
}
