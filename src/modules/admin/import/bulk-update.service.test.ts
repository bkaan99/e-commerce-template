import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "@/shared/audit/audit-logger";
import { InMemoryEventBus } from "@/shared/events/event-bus";
import {
  BulkUpdateService,
  type BulkUpdateRepository,
  type VariantSnapshot,
  type VariantUpdate,
} from "./bulk-update.service";

const actor = { userId: "staff", ip: null };

class FakeRepo implements BulkUpdateRepository {
  variants: VariantSnapshot[] = [
    {
      id: "v1",
      sku: "TS-S",
      price: "100.00",
      compareAtPrice: null,
      stockQuantity: 0,
    },
    {
      id: "v2",
      sku: "TS-M",
      price: "100.00",
      compareAtPrice: "150.00",
      stockQuantity: 5,
    },
  ];
  applied: VariantUpdate[] | null = null;

  async findVariantsBySku(skus: string[]) {
    const wanted = new Set(skus.map((s) => s.toUpperCase()));
    return this.variants.filter((v) => wanted.has(v.sku.toUpperCase()));
  }
  async applyUpdates(updates: VariantUpdate[]) {
    this.applied = updates;
  }
}

describe("BulkUpdateService", () => {
  let repo: FakeRepo;
  let audit: AuditEntry[];
  let events: InMemoryEventBus;
  let replenished: string[];
  let service: BulkUpdateService;

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    replenished = [];
    events = new InMemoryEventBus();
    events.subscribe("stock.replenished", ({ variantId }) => {
      replenished.push(variantId);
    });
    service = new BulkUpdateService(repo, events, {
      log: async (entry) => void audit.push(entry),
      purgeOlderThan: async () => 0,
    });
  });

  it("fiyat ve stoğu günceller, denetim yazar, yeniden stok olayı yayınlar", async () => {
    const report = await service.run(
      "sku;fiyat;stok\nts-s;129,90;10\nTS-M;110;5",
      { dryRun: false },
      actor,
    );

    expect(report).toMatchObject({ updated: 2, total: 2, issues: [] });
    expect(repo.applied).toEqual([
      { id: "v1", price: "129.90", stockQuantity: 10 },
      { id: "v2", price: "110", stockQuantity: 5 },
    ]);
    expect(audit[0]).toMatchObject({ action: "product.bulk-update" });
    expect(replenished).toEqual(["v1"]);
  });

  it("önizlemede hiçbir şey uygulanmaz", async () => {
    const report = await service.run(
      "sku;stok\nTS-S;3",
      { dryRun: true },
      actor,
    );
    expect(report.updated).toBe(0);
    expect(repo.applied).toBeNull();
    expect(audit).toHaveLength(0);
  });

  it("boş hücre alanı değiştirmez; '-' indirimsiz fiyatı temizler", async () => {
    await service.run(
      "sku;fiyat;indirimsiz_fiyat;stok\nTS-M;;-;",
      { dryRun: false },
      actor,
    );
    expect(repo.applied).toEqual([{ id: "v2", compareAtPrice: null }]);
  });

  it("hatalı satır varsa dosyanın hiçbiri uygulanmaz", async () => {
    const report = await service.run(
      "sku;fiyat\nTS-S;120\nYOK-1;10\nTS-M;abc",
      { dryRun: false },
      actor,
    );
    expect(report.updated).toBe(0);
    expect(repo.applied).toBeNull();
    expect(report.issues.map((i) => i.row)).toEqual([4, 3]);
  });

  it("tekrar eden SKU ve tutarsız indirimsiz fiyatı yakalar", async () => {
    const report = await service.run(
      "sku;fiyat;indirimsiz_fiyat\nTS-S;100;90\nTS-S;100;",
      { dryRun: true },
      actor,
    );
    expect(report.issues.map((i) => i.message)).toEqual([
      "SKU dosyada tekrar ediyor: TS-S",
      "İndirimsiz fiyat satış fiyatından yüksek olmalı",
    ]);
  });

  it("gerekli sütunlar yoksa reddeder", async () => {
    await expect(
      service.run("fiyat\n10", { dryRun: true }, actor),
    ).rejects.toThrow("Eksik sütun: sku");
    await expect(
      service.run("sku\nA", { dryRun: true }, actor),
    ).rejects.toThrow("en az bir sütun");
  });
});
