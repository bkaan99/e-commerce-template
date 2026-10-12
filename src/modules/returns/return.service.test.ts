import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/shared/audit/audit-logger";
import type {
  ReturnOrderRecord,
  ReturnRepository,
  ReturnRequestRecord,
} from "./return.repository";
import { calculateRefund } from "./refund-calculator";
import { ReturnService } from "./return.service";
import type { ReturnStatus } from "./return.types";

const d = (v: string | number) => new Decimal(v);
const actor = { userId: "staff", ip: null };

describe("calculateRefund", () => {
  it("indirimsiz siparişte ürün tutarını iade eder", () => {
    expect(
      calculateRefund([{ unitPrice: 100, quantity: 2 }], 400, 0).toFixed(2),
    ).toBe("200.00");
  });

  it("siparişteki indirimi orantılı düşer", () => {
    // 400 TL sepette 40 TL (%10) indirim: 200 TL'lik ürün için 180 TL
    expect(
      calculateRefund([{ unitPrice: 100, quantity: 2 }], 400, 40).toFixed(2),
    ).toBe("180.00");
  });

  it("sıfır ara toplamda sıfır döner", () => {
    expect(calculateRefund([], 0, 0).toFixed(2)).toBe("0.00");
  });
});

const baseOrder = (
  overrides: Partial<ReturnOrderRecord> = {},
): ReturnOrderRecord => ({
  id: "o1",
  orderNumber: "SABC",
  email: "ali@example.com",
  status: "DELIVERED",
  paymentStatus: "PAID",
  subtotal: d(400),
  discountTotal: d(0),
  grandTotal: d(400),
  createdAt: new Date("2026-06-01T00:00:00Z"),
  shippedAt: new Date("2026-06-02T00:00:00Z"),
  deliveredAt: new Date("2026-06-04T00:00:00Z"),
  items: [
    {
      id: "i1",
      productName: "Tişört",
      variantName: "M",
      unitPrice: d(100),
      quantity: 2,
    },
    {
      id: "i2",
      productName: "Pantolon",
      variantName: null,
      unitPrice: d(200),
      quantity: 1,
    },
  ],
  ...overrides,
});

class FakeRepo implements ReturnRepository {
  order: ReturnOrderRecord | null = baseOrder();
  requested = new Map<string, number>();
  created: {
    items: { orderItemId: string; quantity: number }[];
    reason: string;
  }[] = [];
  request: ReturnRequestRecord | null = null;
  completed: { amount: string; restock: boolean }[] = [];
  rejectResult = true;

  async findOrder() {
    return this.order;
  }
  async requestedQuantities() {
    return this.requested;
  }
  async createRequest(
    _orderId: string,
    data: {
      reason: string;
      note: string | null;
      items: { orderItemId: string; quantity: number }[];
    },
  ) {
    this.created.push(data);
    return "r1";
  }
  async list(status?: ReturnStatus) {
    return this.request && (!status || this.request.status === status)
      ? [this.request]
      : [];
  }
  async get() {
    return this.request;
  }
  async reject() {
    return this.rejectResult;
  }
  async complete(
    _id: string,
    data: { amount: string; providerRef: string | null; restock: boolean },
  ) {
    this.completed.push({ amount: data.amount, restock: data.restock });
  }
}

const requestRecord = (): ReturnRequestRecord => ({
  id: "r1",
  status: "REQUESTED",
  reason: "Beden uymadı",
  note: null,
  adminNote: null,
  createdAt: new Date(),
  order: {
    id: "o1",
    orderNumber: "SABC",
    email: "ali@example.com",
    subtotal: d(400),
    discountTotal: d(40),
    grandTotal: d(360),
    merchantOid: "SABC",
  },
  items: [
    {
      orderItemId: "i1",
      variantId: "v1",
      productName: "Tişört",
      variantName: "M",
      unitPrice: d(100),
      quantity: 2,
      trackInventory: true,
    },
  ],
});

describe("ReturnService", () => {
  let repo: FakeRepo;
  let refund: ReturnType<
    typeof vi.fn<
      (r: {
        merchantOid: string;
        amount: string;
      }) => Promise<{ providerRef: string }>
    >
  >;
  let audit: AuditEntry[];
  let now: Date;
  let service: ReturnService;

  let notified: {
    email: string;
    orderNumber: string;
    approved: boolean;
    amount: string | null;
    note: string | null;
  }[];
  let notifierFails: boolean;

  beforeEach(() => {
    repo = new FakeRepo();
    refund = vi.fn(async (r: { merchantOid: string; amount: string }) => ({
      providerRef: r.merchantOid,
    }));
    audit = [];
    notified = [];
    notifierFails = false;
    now = new Date("2026-06-10T00:00:00Z");
    service = new ReturnService({
      returns: repo,
      orderAccess: { getForAccess: async () => ({}) },
      refunder: { refund },
      audit: {
        log: async (e) => void audit.push(e),
        purgeOlderThan: async () => 0,
      },
      notifier: {
        onReturnDecided: async (info) => {
          if (notifierFails) throw new Error("kuyruk kapalı");
          notified.push(info);
        },
      },
      withdrawalPeriodDays: 14,
      now: () => now,
    });
  });

  it("teslimden itibaren süre içindeyse iade edilebilir", async () => {
    const result = await service.getEligibility("SABC", { userId: "u1" });
    expect(result.eligible).toBe(true);
    expect(result.items[0]!.requestableQuantity).toBe(2);
  });

  it("süre dolmuşsa reddeder", async () => {
    now = new Date("2026-07-01T00:00:00Z");
    const result = await service.getEligibility("SABC", { userId: "u1" });
    expect(result).toMatchObject({ eligible: false });
    expect(result.reason).toContain("14 gün");
  });

  it("kargolanmamış siparişte iade talebi açılamaz", async () => {
    repo.order = baseOrder({ status: "PAID" });
    const result = await service.getEligibility("SABC", { userId: "u1" });
    expect(result.eligible).toBe(false);
  });

  it("daha önce talep edilen adetleri düşer", async () => {
    repo.requested = new Map([["i1", 1]]);
    const result = await service.getEligibility("SABC", { userId: "u1" });
    expect(
      result.items.find((i) => i.orderItemId === "i1")!.requestableQuantity,
    ).toBe(1);
  });

  it("talep oluşturur", async () => {
    const id = await service.request(
      "SABC",
      { userId: "u1" },
      {
        items: [{ orderItemId: "i1", quantity: 1 }],
        reason: "Beden uymadı",
        note: null,
      },
    );
    expect(id).toBe("r1");
    expect(repo.created[0]!.items).toEqual([
      { orderItemId: "i1", quantity: 1 },
    ]);
  });

  it("sipariş edilenden fazla adedi ve geçersiz ürünü reddeder", async () => {
    await expect(
      service.request(
        "SABC",
        { userId: "u1" },
        {
          items: [{ orderItemId: "i1", quantity: 3 }],
          reason: "x",
          note: null,
        },
      ),
    ).rejects.toThrow("adedi aşamaz");

    await expect(
      service.request(
        "SABC",
        { userId: "u1" },
        {
          items: [{ orderItemId: "yok", quantity: 1 }],
          reason: "x",
          note: null,
        },
      ),
    ).rejects.toThrow("Geçersiz ürün");
  });

  it("onayda önce iade yapar, sonra talebi tamamlar ve denetim kaydı yazar", async () => {
    repo.request = requestRecord();

    await service.approve("r1", { restock: true }, actor);

    // 2 × 100 = 200, %10 indirim oranı → 180
    expect(refund).toHaveBeenCalledWith({
      merchantOid: "SABC",
      amount: "180.00",
    });
    expect(repo.completed).toEqual([{ amount: "180.00", restock: true }]);
    expect(audit[0]).toMatchObject({
      action: "return.approve",
      entityId: "r1",
    });
  });

  it("sağlayıcı iadesi başarısızsa talebi tamamlamaz", async () => {
    repo.request = requestRecord();
    refund.mockRejectedValueOnce(new Error("İade reddedildi"));

    await expect(
      service.approve("r1", { restock: false }, actor),
    ).rejects.toThrow("İade reddedildi");
    expect(repo.completed).toHaveLength(0);
  });

  it("işlenmiş talebi tekrar onaylamaz", async () => {
    repo.request = { ...requestRecord(), status: "COMPLETED" };
    await expect(
      service.approve("r1", { restock: false }, actor),
    ).rejects.toThrow("zaten işlenmiş");
    expect(refund).not.toHaveBeenCalled();
  });

  it("reddeder ve denetim kaydı yazar", async () => {
    repo.request = requestRecord();
    await service.reject("r1", "Kullanılmış ürün", actor);
    expect(audit[0]).toMatchObject({ action: "return.reject" });
  });

  it("onay ve ret sonucunu müşteriye bildirir", async () => {
    repo.request = requestRecord();
    await service.approve("r1", { restock: false }, actor);
    expect(notified[0]).toMatchObject({ approved: true, note: null });
    expect(notified[0]!.amount).not.toBeNull();

    repo.request = requestRecord();
    await service.reject("r1", " Kullanılmış ürün ", actor);
    expect(notified[1]).toMatchObject({
      approved: false,
      amount: null,
      note: "Kullanılmış ürün",
    });
  });

  it("bildirim hatası iade işlemini bozmaz", async () => {
    repo.request = requestRecord();
    notifierFails = true;
    await expect(
      service.approve("r1", { restock: false }, actor),
    ).resolves.toBeUndefined();
    expect(repo.completed).toHaveLength(1);
  });
});
