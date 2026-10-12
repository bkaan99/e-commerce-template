import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry, AuditLogger } from "@/shared/audit/audit-logger";
import { InMemoryEventBus } from "@/shared/events/event-bus";
import type {
  AdminOrderDetail,
  AdminOrderRepository,
} from "./admin-order.repository";
import { AdminOrderService } from "./admin-order.service";
import type { OrderStatus, PaymentOutcome } from "../../orders/order.types";

const detail = (status: OrderStatus): AdminOrderDetail => ({
  id: "o1",
  orderNumber: "SABC",
  status,
  paymentStatus: "PAID",
  email: "ali@example.com",
  userId: null,
  source: "web",
  currency: "TRY",
  subtotal: "100.00",
  discountTotal: "0.00",
  shippingTotal: "0.00",
  taxTotal: "0.00",
  grandTotal: "100.00",
  couponCode: null,
  customerNote: null,
  createdAt: new Date(),
  shippingAddress: {},
  billingAddress: {},
  items: [],
  payments: [],
  shipments: [],
  returns: [],
});

class FakeRepo implements AdminOrderRepository {
  current: AdminOrderDetail | null = detail("PAID");
  transitions: { from: readonly OrderStatus[]; to: OrderStatus }[] = [];
  shipments: { carrier: string; trackingNumber: string | null }[] = [];
  deliveredMarked = false;
  transitionResult = true;

  async list() {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
  async findDetail() {
    return this.current;
  }
  async transition(_id: string, from: readonly OrderStatus[], to: OrderStatus) {
    this.transitions.push({ from, to });
    return this.transitionResult;
  }
  async createShipment(
    _id: string,
    data: { carrier: string; trackingNumber: string | null },
  ) {
    this.shipments.push(data);
  }
  async markShipmentsDelivered() {
    this.deliveredMarked = true;
  }
}

describe("AdminOrderService", () => {
  let repo: FakeRepo;
  let audit: AuditEntry[];
  let events: InMemoryEventBus;
  let paymentCalls: { applied: string[]; deferredPaid: string[] };
  let paymentOutcome: PaymentOutcome = { kind: "paid", orderId: "o1" };
  let deferredResult = true;
  let cancelByStaff: ReturnType<
    typeof vi.fn<(orderNumber: string) => Promise<void>>
  >;
  let service: AdminOrderService;
  const actor = { userId: "staff1", ip: "1.1.1.1" };

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    events = new InMemoryEventBus();
    cancelByStaff = vi.fn(async (orderNumber: string) => void orderNumber);
    const auditLogger: AuditLogger = {
      log: async (entry) => void audit.push(entry),
      purgeOlderThan: async () => 0,
    };
    paymentCalls = { applied: [], deferredPaid: [] };
    service = new AdminOrderService(
      repo,
      { cancelByStaff },
      events,
      auditLogger,
      {
        applyPaymentResult: async (input) => {
          paymentCalls.applied.push(input.merchantOid);
          return paymentOutcome;
        },
        markDeferredPaid: async (orderId) => {
          paymentCalls.deferredPaid.push(orderId);
          return deferredResult;
        },
      },
    );
  });

  it("kargolarken gönderi kaydı açar, olay yayınlar ve denetim kaydı yazar", async () => {
    const handler = vi.fn();
    events.subscribe("order.shipped", handler);

    await service.ship(
      "SABC",
      { carrier: "Yurtiçi Kargo", trackingNumber: " 123 " },
      actor,
    );

    expect(repo.shipments).toEqual([
      { carrier: "Yurtiçi Kargo", trackingNumber: "123" },
    ]);
    expect(handler).toHaveBeenCalledWith({
      orderId: "o1",
      trackingNumber: "123",
    });
    expect(audit[0]).toMatchObject({
      actorId: "staff1",
      action: "order.ship",
      entityId: "o1",
      before: { status: "PAID" },
    });
  });

  it("kargo firması olmadan kargolamayı reddeder", async () => {
    await expect(
      service.ship("SABC", { carrier: " ", trackingNumber: null }, actor),
    ).rejects.toThrow("Kargo firması");
  });

  it("izin verilmeyen geçişi reddeder ve kayıt yazmaz", async () => {
    repo.current = detail("DELIVERED");
    await expect(service.markProcessing("SABC", actor)).rejects.toThrow(
      "durum geçişi yapılamaz",
    );
    expect(audit).toHaveLength(0);
  });

  it("eşzamanlı değişiklikte (geçiş uygulanamadı) ConflictError verir", async () => {
    repo.transitionResult = false;
    await expect(service.markProcessing("SABC", actor)).rejects.toThrow(
      "durumu değişmiş",
    );
    expect(audit).toHaveLength(0);
  });

  it("teslim edildi işaretlenince gönderileri de teslim edilmiş yapar", async () => {
    repo.current = detail("SHIPPED");
    await service.markDelivered("SABC", actor);
    expect(repo.deliveredMarked).toBe(true);
  });

  it("kargolanmış siparişi iptal ettirmez", async () => {
    repo.current = detail("SHIPPED");
    await expect(service.cancel("SABC", actor)).rejects.toThrow(
      "iptal edilemez",
    );
    expect(cancelByStaff).not.toHaveBeenCalled();
  });

  it("iptali sipariş servisine devreder ve denetim kaydı yazar", async () => {
    await service.cancel("SABC", actor);
    expect(cancelByStaff).toHaveBeenCalledWith("SABC");
    expect(audit[0]).toMatchObject({ action: "order.cancel" });
  });

  it("bilinmeyen siparişte NotFoundError verir", async () => {
    repo.current = null;
    await expect(service.get("YOK")).rejects.toThrow("Sipariş bulunamadı");
  });

  describe("manuel ödeme onayı", () => {
    const withPayment = (
      status: OrderStatus,
      method: "CARD" | "BANK_TRANSFER" | "DEFERRED",
    ): AdminOrderDetail => ({
      ...detail(status),
      paymentStatus: "PENDING",
      payments: [
        {
          provider: method.toLowerCase(),
          method,
          status: "PENDING",
          amount: "100.00",
          merchantOid: "SABC",
          paidAt: null,
          dueAt: null,
        },
      ],
    });

    beforeEach(() => {
      paymentOutcome = { kind: "paid", orderId: "o1" };
      deferredResult = true;
    });

    it("havale alındığında ödemeyi uygular, olay yayınlar ve denetim yazar", async () => {
      repo.current = withPayment("PENDING_PAYMENT", "BANK_TRANSFER");
      const handler = vi.fn();
      events.subscribe("order.paid", handler);

      await service.confirmBankTransfer("SABC", actor);

      expect(paymentCalls.applied).toEqual(["SABC"]);
      expect(handler).toHaveBeenCalledWith({ orderId: "o1" });
      expect(audit[0]).toMatchObject({ action: "order.bank-transfer.confirm" });
    });

    it("kart ödemeli veya ödenmiş siparişte havale onayını reddeder", async () => {
      repo.current = withPayment("PENDING_PAYMENT", "CARD");
      await expect(service.confirmBankTransfer("SABC", actor)).rejects.toThrow(
        "havale onayı yapılamaz",
      );

      repo.current = withPayment("PAID", "BANK_TRANSFER");
      await expect(service.confirmBankTransfer("SABC", actor)).rejects.toThrow(
        "havale onayı yapılamaz",
      );
      expect(paymentCalls.applied).toHaveLength(0);
    });

    it("süresi dolmuş (işlenemeyen) siparişte hata verir ve olay yayınlamaz", async () => {
      repo.current = withPayment("PENDING_PAYMENT", "BANK_TRANSFER");
      paymentOutcome = { kind: "already-processed", orderId: "o1" };
      const handler = vi.fn();
      events.subscribe("order.paid", handler);

      await expect(service.confirmBankTransfer("SABC", actor)).rejects.toThrow(
        "onaylanamadı",
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it("vadeli siparişin tahsilini işaretler", async () => {
      repo.current = withPayment("PROCESSING", "DEFERRED");
      await service.markDeferredCollected("SABC", actor);

      expect(paymentCalls.deferredPaid).toEqual(["o1"]);
      expect(audit[0]).toMatchObject({ action: "order.deferred.collected" });
    });

    it("vadeli olmayan veya zaten tahsil edilmiş siparişte hata verir", async () => {
      repo.current = withPayment("PROCESSING", "CARD");
      await expect(
        service.markDeferredCollected("SABC", actor),
      ).rejects.toThrow("vadeli ödemeli değil");

      repo.current = withPayment("PROCESSING", "DEFERRED");
      deferredResult = false;
      await expect(
        service.markDeferredCollected("SABC", actor),
      ).rejects.toThrow("zaten tahsil");
    });
  });
});
