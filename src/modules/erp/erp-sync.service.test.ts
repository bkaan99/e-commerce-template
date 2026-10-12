import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "@/shared/audit/audit-logger";
import { InMemoryEventBus } from "@/shared/events/event-bus";
import type {
  BulkUpdateRepository,
  VariantSnapshot,
  VariantUpdate,
} from "../admin/import/bulk-update.service";
import { ErpSyncService } from "./erp-sync.service";
import type { ErpStockRecord } from "./erp.types";

class FakeVariants implements BulkUpdateRepository {
  variants: VariantSnapshot[] = [
    {
      id: "v1",
      sku: "A-1",
      price: "100.00",
      compareAtPrice: null,
      stockQuantity: 0,
    },
    {
      id: "v2",
      sku: "A-2",
      price: "50.00",
      compareAtPrice: null,
      stockQuantity: 7,
    },
  ];
  applied: VariantUpdate[] = [];
  async findVariantsBySku(skus: string[]) {
    const wanted = new Set(skus.map((s) => s.toUpperCase()));
    return this.variants.filter((v) => wanted.has(v.sku.toUpperCase()));
  }
  async applyUpdates(updates: VariantUpdate[]) {
    this.applied.push(...updates);
  }
}

describe("ErpSyncService", () => {
  let variants: FakeVariants;
  let audit: AuditEntry[];
  let replenished: string[];
  let records: ErpStockRecord[];
  let service: ErpSyncService;

  beforeEach(() => {
    variants = new FakeVariants();
    audit = [];
    replenished = [];
    records = [];
    const events = new InMemoryEventBus();
    events.subscribe("stock.replenished", ({ variantId }) => {
      replenished.push(variantId);
    });
    service = new ErpSyncService(
      { name: "test", fetchStock: async () => records },
      variants,
      events,
      {
        log: async (entry) => void audit.push(entry),
        purgeOlderThan: async () => 0,
      },
    );
  });

  it("yalnızca değişen stok ve fiyatları uygular", async () => {
    records = [
      { sku: "a-1", stockQuantity: 12 },
      { sku: "A-2", stockQuantity: 7, price: "50.00" },
    ];
    const report = await service.syncStock();

    expect(report).toEqual({ fetched: 2, updated: 1, unknown: 0, invalid: 0 });
    expect(variants.applied).toEqual([{ id: "v1", stockQuantity: 12 }]);
    expect(replenished).toEqual(["v1"]);
    expect(audit[0]).toMatchObject({ action: "erp.stock-sync", actorId: null });
  });

  it("fiyat değişimini uygular", async () => {
    records = [{ sku: "A-2", stockQuantity: 7, price: "59.90" }];
    await service.syncStock();
    expect(variants.applied).toEqual([{ id: "v2", price: "59.90" }]);
  });

  it("bilinmeyen SKU ve geçersiz kayıtları atlar, akışı durdurmaz", async () => {
    records = [
      { sku: "YOK", stockQuantity: 1 },
      { sku: "A-1", stockQuantity: -3 },
      { sku: "A-2", stockQuantity: 1.5 },
      { sku: "", stockQuantity: 1 },
      { sku: "A-2", stockQuantity: 2 },
    ];
    const report = await service.syncStock();

    expect(report).toEqual({ fetched: 5, updated: 1, unknown: 1, invalid: 3 });
    expect(variants.applied).toEqual([{ id: "v2", stockQuantity: 2 }]);
  });

  it("aynı SKU tekrar ederse sonuncuyu kullanır", async () => {
    records = [
      { sku: "A-1", stockQuantity: 3 },
      { sku: "a-1", stockQuantity: 9 },
    ];
    await service.syncStock();
    expect(variants.applied).toEqual([{ id: "v1", stockQuantity: 9 }]);
  });
});
