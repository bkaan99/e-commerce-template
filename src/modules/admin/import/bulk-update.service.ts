import { z } from "zod";
import { ValidationError } from "@/shared/errors";
import { parseCsvRecords } from "@/shared/csv-parse";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import type { EventBus } from "@/shared/events/event-bus";
import type { Actor } from "../orders/admin-order.service";
import { missingColumns, normalizeHeader } from "./headers";
import {
  MAX_IMPORT_ROWS,
  type BulkUpdateReport,
  type RowIssue,
} from "./import.types";

export interface VariantSnapshot {
  id: string;
  sku: string;
  price: string;
  compareAtPrice: string | null;
  stockQuantity: number;
}

export interface VariantUpdate {
  id: string;
  price?: string;
  compareAtPrice?: string | null;
  stockQuantity?: number;
}

export interface BulkUpdateRepository {
  findVariantsBySku(skus: string[]): Promise<VariantSnapshot[]>;
  /** Tüm güncellemeleri tek işlemde uygular. */
  applyUpdates(updates: VariantUpdate[]): Promise<void>;
}

const money = z
  .string()
  .regex(/^\d+([.,]\d{1,2})?$/, "Geçerli bir tutar girin")
  .transform((value) => value.replace(",", "."));

const rowSchema = z.object({
  sku: z.string().min(1, "SKU zorunlu"),
  fiyat: money.optional(),
  /** "-" veya "sil" değeri indirimsiz fiyatı temizler. */
  indirimsiz_fiyat: z.string().optional(),
  stok: z
    .string()
    .regex(/^\d+$/, "Stok tam sayı olmalı")
    .transform(Number)
    .optional(),
});

function blankToUndefined(record: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      value === "" ? undefined : value,
    ]),
  );
}

/** SKU bazlı toplu fiyat/stok güncelleme. Dosyada boş bırakılan alan değiştirilmez. */
export class BulkUpdateService {
  constructor(
    private readonly repository: BulkUpdateRepository,
    private readonly events: EventBus,
    private readonly audit: AuditLogger,
  ) {}

  async run(
    csv: string,
    options: { dryRun: boolean },
    actor: Actor,
  ): Promise<BulkUpdateReport> {
    const { headers, records } = parseCsvRecords(csv, normalizeHeader);

    const missing = missingColumns(headers, ["sku"]);
    if (missing.length > 0) {
      throw new ValidationError(`Eksik sütun: ${missing.join(", ")}`);
    }
    if (
      !headers.some((h) => ["fiyat", "indirimsiz_fiyat", "stok"].includes(h))
    ) {
      throw new ValidationError(
        "Güncellenecek en az bir sütun gerekli: fiyat, indirimsiz_fiyat veya stok",
      );
    }
    if (records.length === 0) throw new ValidationError("Dosyada satır yok");
    if (records.length > MAX_IMPORT_ROWS) {
      throw new ValidationError(
        `Tek dosyada en fazla ${MAX_IMPORT_ROWS} satır işlenebilir`,
      );
    }

    const issues: RowIssue[] = [];
    const parsed: { row: number; data: z.infer<typeof rowSchema> }[] = [];
    const seen = new Set<string>();

    records.forEach((record, index) => {
      const row = index + 2;
      const result = rowSchema.safeParse(blankToUndefined(record));
      if (!result.success) {
        issues.push({ row, message: result.error.issues[0]!.message });
        return;
      }
      const key = result.data.sku.toUpperCase();
      if (seen.has(key)) {
        issues.push({
          row,
          message: `SKU dosyada tekrar ediyor: ${result.data.sku}`,
        });
        return;
      }
      seen.add(key);
      parsed.push({ row, data: result.data });
    });

    const existing = await this.repository.findVariantsBySku(
      parsed.map((item) => item.data.sku),
    );
    const bySku = new Map(existing.map((v) => [v.sku.toUpperCase(), v]));

    const updates: VariantUpdate[] = [];
    const replenished: string[] = [];
    const audited: { sku: string; before: unknown; after: unknown }[] = [];

    for (const { row, data } of parsed) {
      const variant = bySku.get(data.sku.toUpperCase());
      if (!variant) {
        issues.push({ row, message: `SKU bulunamadı: ${data.sku}` });
        continue;
      }

      const update: VariantUpdate = { id: variant.id };
      if (data.fiyat !== undefined) update.price = data.fiyat;
      if (data.indirimsiz_fiyat !== undefined) {
        const raw = data.indirimsiz_fiyat.trim().toLowerCase();
        if (raw === "-" || raw === "sil") update.compareAtPrice = null;
        else {
          const parsedPrice = money.safeParse(data.indirimsiz_fiyat);
          if (!parsedPrice.success) {
            issues.push({ row, message: "İndirimsiz fiyat geçersiz" });
            continue;
          }
          update.compareAtPrice = parsedPrice.data;
        }
      }
      if (data.stok !== undefined) update.stockQuantity = data.stok;

      const price = update.price ?? variant.price;
      if (
        update.compareAtPrice &&
        Number(update.compareAtPrice) <= Number(price)
      ) {
        issues.push({
          row,
          message: "İndirimsiz fiyat satış fiyatından yüksek olmalı",
        });
        continue;
      }

      updates.push(update);
      audited.push({
        sku: variant.sku,
        before: {
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          stock: variant.stockQuantity,
        },
        after: {
          price: update.price,
          compareAtPrice: update.compareAtPrice,
          stock: update.stockQuantity,
        },
      });
      if (
        update.stockQuantity !== undefined &&
        variant.stockQuantity <= 0 &&
        update.stockQuantity > 0
      ) {
        replenished.push(variant.id);
      }
    }

    // Satır hatası olan dosya kısmen uygulanmaz: ya hep ya hiç.
    const canApply = issues.length === 0 && updates.length > 0;
    if (!options.dryRun && canApply) {
      await this.repository.applyUpdates(updates);
      await this.audit.log({
        actorId: actor.userId,
        ip: actor.ip,
        action: "product.bulk-update",
        entityType: "ProductVariant",
        entityId: "bulk",
        after: { count: updates.length, changes: audited.slice(0, 200) },
      });
      for (const variantId of replenished) {
        await this.events.publish("stock.replenished", { variantId });
      }
    }

    return {
      dryRun: options.dryRun,
      total: records.length,
      updated: !options.dryRun && canApply ? updates.length : 0,
      issues,
    };
  }
}
