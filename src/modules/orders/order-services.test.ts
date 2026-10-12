import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PaymentCallbackResult,
  PaymentInitResult,
  PaymentProvider,
} from "@/integrations/payment/payment-provider";
import { InMemoryEventBus } from "@/shared/events/event-bus";
import type { OrderRepository, PaymentResultInput } from "./order.repository";
import { OrderService } from "./order.service";
import type { OrderView, PaymentOutcome } from "./order.types";
import { PaymentService } from "./payment.service";

const address = {
  firstName: "Ali",
  lastName: "Veli",
  phone: "05550000000",
  city: "İstanbul",
  district: "Kadıköy",
  neighborhood: null,
  addressLine: "Örnek Sk. No:1",
  postalCode: null,
  invoiceType: "INDIVIDUAL" as const,
  nationalId: null,
  companyName: null,
  taxNumber: null,
  taxOffice: null,
};

const makeOrder = (overrides: Partial<OrderView> = {}): OrderView => ({
  id: "o1",
  orderNumber: "SABC123",
  lookupToken: "token-123",
  status: "PENDING_PAYMENT",
  paymentStatus: "PENDING",
  email: "ali@example.com",
  currency: "TRY",
  subtotal: "200.00",
  discountTotal: "0.00",
  shippingTotal: "0.00",
  taxTotal: "0.00",
  grandTotal: "200.00",
  couponCode: null,
  shippingAddress: address,
  billingAddress: address,
  customerNote: null,
  items: [],
  trackingNumber: null,
  carrier: null,
  createdAt: new Date(),
  userId: "u1",
  paymentMethod: "CARD",
  paymentDueAt: null,
  ...overrides,
});

class FakeOrders implements OrderRepository {
  order: OrderView | null = makeOrder();
  outcome: PaymentOutcome = { kind: "paid", orderId: "o1" };
  appliedResults: PaymentResultInput[] = [];
  cancelled: { id: string; refunded: boolean }[] = [];
  refunds: string[] = [];

  async createPendingOrder(): Promise<never> {
    throw new Error("kullanılmaz");
  }
  async createDeferredOrder(): Promise<never> {
    throw new Error("kullanılmaz");
  }
  async markDeferredPaid() {
    return true;
  }
  async findById(id: string) {
    return this.order && this.order.id === id ? this.order : null;
  }
  async findByOrderNumber(number: string) {
    return this.order && this.order.orderNumber === number ? this.order : null;
  }
  async findByLookupToken() {
    return null;
  }
  async listByUser() {
    return this.order ? [this.order] : [];
  }
  async getPaymentForOrder() {
    return {
      merchantOid: "SABC123",
      amount: "200.00",
      currency: "TRY",
      status: "PENDING",
      provider: "paytr",
      method: "CARD" as const,
    };
  }
  async applyPaymentResult(input: PaymentResultInput) {
    this.appliedResults.push(input);
    return this.outcome;
  }
  async cancelOrder(id: string, refunded: boolean) {
    this.cancelled.push({ id, refunded });
  }
  async recordRefund(orderId: string) {
    this.refunds.push(orderId);
  }
  async releaseExpired() {
    return 0;
  }
  async countCouponUses() {
    return 0;
  }
}

function makeProvider(
  overrides: Partial<PaymentProvider> = {},
): PaymentProvider {
  return {
    name: "fake",
    initiate: vi.fn(async (): Promise<PaymentInitResult> => ({
      token: "t",
      paymentUrl: "https://pay.test/t",
      mode: "iframe",
    })),
    verifyCallback: vi.fn((): PaymentCallbackResult => ({
      merchantOid: "SABC123",
      status: "success",
      amount: "200.00",
      failureReason: null,
    })),
    refund: vi.fn(async () => ({ providerRef: "ref-1" })),
    ...overrides,
  };
}

describe("PaymentService", () => {
  let orders: FakeOrders;
  let events: InMemoryEventBus;

  beforeEach(() => {
    orders = new FakeOrders();
    events = new InMemoryEventBus();
  });

  it("ödeme oturumu açar ve doğru dönüş adreslerini gönderir", async () => {
    const provider = makeProvider();
    const service = new PaymentService(provider, orders, events, {
      baseUrl: "https://site.test",
    });

    const result = await service.start("SABC123", { customerIp: "1.2.3.4" });

    expect(result).toEqual({
      paymentUrl: "https://pay.test/t",
      mode: "iframe",
    });
    const request = vi.mocked(provider.initiate).mock.calls[0]![0];
    expect(request).toMatchObject({
      merchantOid: "SABC123",
      amount: "200.00",
      customerIp: "1.2.3.4",
      okUrl: "https://site.test/siparis/SABC123?t=token-123",
    });
  });

  it("ödemesi alınmış siparişte ödeme başlatmayı reddeder", async () => {
    orders.order = makeOrder({ status: "PAID", paymentStatus: "PAID" });
    const service = new PaymentService(makeProvider(), orders, events, {
      baseUrl: "https://site.test",
    });

    await expect(
      service.start("SABC123", { customerIp: "1.2.3.4" }),
    ).rejects.toThrow("ödeme alınamaz");
  });

  it("başarılı bildirimde order.paid olayı yayınlar", async () => {
    const handler = vi.fn();
    events.subscribe("order.paid", handler);
    const service = new PaymentService(makeProvider(), orders, events, {
      baseUrl: "https://site.test",
    });

    const outcome = await service.handleCallback({ merchant_oid: "SABC123" });

    expect(outcome.kind).toBe("paid");
    expect(handler).toHaveBeenCalledWith({ orderId: "o1" });
    expect(orders.appliedResults[0]).toMatchObject({
      merchantOid: "SABC123",
      success: true,
      amount: "200.00",
    });
  });

  it("tekrar gelen bildirimde olay yayınlamaz", async () => {
    orders.outcome = { kind: "already-processed", orderId: "o1" };
    const handler = vi.fn();
    events.subscribe("order.paid", handler);
    const service = new PaymentService(makeProvider(), orders, events, {
      baseUrl: "https://site.test",
    });

    await service.handleCallback({});

    expect(handler).not.toHaveBeenCalled();
  });

  it("başarısız ödemede order.cancelled olayı yayınlar", async () => {
    orders.outcome = { kind: "failed", orderId: "o1" };
    const provider = makeProvider({
      verifyCallback: vi.fn(() => ({
        merchantOid: "SABC123",
        status: "failed" as const,
        amount: "200.00",
        failureReason: "Yetersiz bakiye",
      })),
    });
    const handler = vi.fn();
    events.subscribe("order.cancelled", handler);
    const service = new PaymentService(provider, orders, events, {
      baseUrl: "https://site.test",
    });

    await service.handleCallback({});

    expect(handler).toHaveBeenCalledWith({ orderId: "o1", refunded: false });
  });

  it("imza doğrulaması başarısızsa siparişe dokunmaz", async () => {
    const provider = makeProvider({
      verifyCallback: vi.fn(() => {
        throw new Error("Geçersiz imza");
      }),
    });
    const service = new PaymentService(provider, orders, events, {
      baseUrl: "https://site.test",
    });

    await expect(service.handleCallback({})).rejects.toThrow("Geçersiz imza");
    expect(orders.appliedResults).toHaveLength(0);
  });
});

describe("OrderService", () => {
  let orders: FakeOrders;
  let events: InMemoryEventBus;
  let provider: PaymentProvider;
  let service: OrderService;

  beforeEach(() => {
    orders = new FakeOrders();
    events = new InMemoryEventBus();
    provider = makeProvider();
    service = new OrderService(orders, provider, events);
  });

  it("sahibi siparişi görebilir", async () => {
    const order = await service.getForAccess("SABC123", { userId: "u1" });
    expect(order.orderNumber).toBe("SABC123");
  });

  it("doğru bağlantı belirteciyle misafir siparişi görebilir", async () => {
    const order = await service.getForAccess("SABC123", {
      lookupToken: "token-123",
    });
    expect(order.id).toBe("o1");
  });

  it("başkasının siparişini ve yanlış belirteci NotFound olarak gizler", async () => {
    await expect(
      service.getForAccess("SABC123", { userId: "baskasi" }),
    ).rejects.toThrow("Sipariş bulunamadı");
    await expect(
      service.getForAccess("SABC123", { lookupToken: "yanlis" }),
    ).rejects.toThrow("Sipariş bulunamadı");
  });

  it("e-posta ile sorgularken büyük/küçük harfi yok sayar", async () => {
    const order = await service.lookupByEmail(" sabc123 ", "ALI@example.com");
    expect(order.id).toBe("o1");
  });

  it("e-posta eşleşmezse sipariş bulunamadı der", async () => {
    await expect(
      service.lookupByEmail("SABC123", "baska@example.com"),
    ).rejects.toThrow("Sipariş bulunamadı");
  });

  it("ödenmemiş siparişi iade yapmadan iptal eder", async () => {
    const handler = vi.fn();
    events.subscribe("order.cancelled", handler);

    await service.cancel("SABC123", { userId: "u1" });

    expect(provider.refund).not.toHaveBeenCalled();
    expect(orders.cancelled).toEqual([{ id: "o1", refunded: false }]);
    expect(handler).toHaveBeenCalledWith({ orderId: "o1", refunded: false });
  });

  it("ödenmiş siparişi iptal ederken önce iade eder", async () => {
    orders.order = makeOrder({ status: "PAID", paymentStatus: "PAID" });

    await service.cancel("SABC123", { userId: "u1" });

    expect(provider.refund).toHaveBeenCalledWith({
      merchantOid: "SABC123",
      amount: "200.00",
    });
    expect(orders.refunds).toEqual(["o1"]);
    expect(orders.cancelled).toEqual([{ id: "o1", refunded: true }]);
  });

  it("iade başarısızsa siparişi iptal etmez", async () => {
    orders.order = makeOrder({ status: "PAID", paymentStatus: "PAID" });
    provider = makeProvider({
      refund: vi.fn(async () => {
        throw new Error("İade reddedildi");
      }),
    });
    service = new OrderService(orders, provider, events);

    await expect(service.cancel("SABC123", { userId: "u1" })).rejects.toThrow(
      "İade reddedildi",
    );
    expect(orders.cancelled).toHaveLength(0);
  });

  it("kargolanmış siparişi iptal etmeyi reddeder", async () => {
    orders.order = makeOrder({ status: "SHIPPED", paymentStatus: "PAID" });
    await expect(service.cancel("SABC123", { userId: "u1" })).rejects.toThrow(
      "iptal edilemez",
    );
  });
});
