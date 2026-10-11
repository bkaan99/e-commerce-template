import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  StockAlertService,
  type AlertVariantRecord,
  type PendingSubscription,
  type StockAlertRepository,
} from "./stock-alert.service";

const variant = (
  overrides: Partial<AlertVariantRecord> = {},
): AlertVariantRecord => ({
  variantId: "v1",
  isActive: true,
  productActive: true,
  productName: "Tişört",
  productSlug: "tisort",
  trackInventory: true,
  stockQuantity: 0,
  reservedQuantity: 0,
  ...overrides,
});

class FakeRepo implements StockAlertRepository {
  variants = new Map<string, AlertVariantRecord>();
  subs: PendingSubscription[] = [];
  notified: string[] = [];
  deleted: string[] = [];
  upserts: { variantId: string; email: string }[] = [];

  async findVariant(id: string) {
    return this.variants.get(id) ?? null;
  }
  async upsertSubscription(variantId: string, email: string) {
    this.upserts.push({ variantId, email });
  }
  async listPending() {
    return this.subs;
  }
  async listPendingForVariant(variantId: string) {
    return this.subs.filter((s) => s.variant.variantId === variantId);
  }
  async markNotified(ids: string[]) {
    this.notified.push(...ids);
  }
  async deleteSubscription(id: string) {
    this.deleted.push(id);
  }
}

describe("StockAlertService", () => {
  let repo: FakeRepo;
  const sendStockAvailable = vi.fn(async () => {});
  let service: StockAlertService;

  beforeEach(() => {
    repo = new FakeRepo();
    sendStockAvailable.mockClear();
    service = new StockAlertService({
      alerts: repo,
      mailer: { sendStockAvailable },
      secret: "s".repeat(32),
      baseUrl: "https://site.test",
    });
  });

  it("stokta olmayan ürüne abonelik kaydeder ve e-postayı normalleştirir", async () => {
    repo.variants.set("v1", variant());
    await service.subscribe("v1", "  ALI@Example.com ");
    expect(repo.upserts).toEqual([
      { variantId: "v1", email: "ali@example.com" },
    ]);
  });

  it("stokta olan ürüne abonelik kabul etmez", async () => {
    repo.variants.set("v1", variant({ stockQuantity: 5 }));
    await expect(service.subscribe("v1", "ali@example.com")).rejects.toThrow(
      "stokta",
    );
  });

  it("geçersiz e-postayı ve bilinmeyen ürünü reddeder", async () => {
    repo.variants.set("v1", variant());
    await expect(service.subscribe("v1", "gecersiz")).rejects.toThrow(
      "e-posta",
    );
    await expect(service.subscribe("yok", "ali@example.com")).rejects.toThrow(
      "Ürün bulunamadı",
    );
  });

  it("stoğa giren varyantın abonelerine bildirir ve işaretler", async () => {
    repo.subs = [
      {
        id: "s1",
        email: "a@example.com",
        variant: variant({ stockQuantity: 3 }),
      },
      {
        id: "s2",
        email: "b@example.com",
        variant: variant({ variantId: "v2", stockQuantity: 0 }),
      },
    ];

    const count = await service.notifyAvailable();

    expect(count).toBe(1);
    expect(sendStockAvailable).toHaveBeenCalledTimes(1);
    expect(repo.notified).toEqual(["s1"]);
    const [email, product, link] = sendStockAvailable.mock
      .calls[0] as unknown as [string, { name: string }, string];
    expect(email).toBe("a@example.com");
    expect(product.name).toBe("Tişört");
    expect(link).toContain("https://site.test/bildirim-iptal?token=");
  });

  it("rezerve stok satılabilir sayılmaz", async () => {
    repo.subs = [
      {
        id: "s1",
        email: "a@example.com",
        variant: variant({ stockQuantity: 3, reservedQuantity: 3 }),
      },
    ];
    expect(await service.notifyAvailable()).toBe(0);
  });

  it("abonelikten çıkış bağlantısı aboneliği siler", async () => {
    repo.subs = [
      {
        id: "s1",
        email: "a@example.com",
        variant: variant({ stockQuantity: 3 }),
      },
    ];
    await service.notifyAvailable();
    const link = (
      sendStockAvailable.mock.calls[0] as unknown as [string, unknown, string]
    )[2];
    const token = decodeURIComponent(new URL(link).searchParams.get("token")!);

    await service.unsubscribe(token);

    expect(repo.deleted).toEqual(["s1"]);
  });

  it("geçersiz abonelik iptal belirtecini reddeder", async () => {
    await expect(service.unsubscribe("bozuk.token")).rejects.toThrow(
      "geçersiz",
    );
  });
});
