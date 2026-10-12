import Decimal from "decimal.js";
import { beforeEach, describe, expect, it } from "vitest";
import type { CartIdentity } from "../cart/cart.types";
import type { OrderRepository } from "../orders/order.repository";
import type { NewOrder } from "../orders/order.types";
import type { CheckoutInput } from "./checkout.schema";
import type {
  CampaignRecord,
  CheckoutLineRecord,
  CheckoutRepository,
  CouponRecord,
} from "./checkout.repository";
import {
  CheckoutService,
  type CartSource,
  type CheckoutSettings,
  type DealerTerms,
} from "./checkout.service";
import { ConfiguredShippingRateCalculator } from "./shipping";

const identity: CartIdentity = { userId: null, sessionToken: "tok" };

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

const input = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
  email: "ali@example.com",
  shippingAddress: address,
  billingAddress: undefined,
  couponCode: null,
  customerNote: null,
  paymentMethod: "CARD",
  acceptTerms: true,
  ...overrides,
});

const line = (
  overrides: Partial<CheckoutLineRecord> = {},
): CheckoutLineRecord => ({
  variantId: "v1",
  quantity: 2,
  sku: "SKU-1",
  price: new Decimal("100.00"),
  currency: "TRY",
  isActive: true,
  stockQuantity: 10,
  reservedQuantity: 0,
  desi: 0,
  product: {
    name: "Tişört",
    status: "ACTIVE",
    trackInventory: true,
    taxRate: new Decimal(20),
    categoryId: "cat-1",
    desi: 0,
  },
  optionLabels: ["Siyah", "M"],
  ...overrides,
});

const settings: CheckoutSettings = {
  guestCheckoutEnabled: true,
  reservationMinutes: 15,
  shippingTaxRate: 20,
  paymentProvider: "paytr",
};

const shipping = new ConfiguredShippingRateCalculator({
  freeShippingThreshold: 500,
  flatRate: 50,
  desiTariff: [],
  extraDesiPrice: 5,
  taxRate: 20,
});

class FakeCheckoutRepo implements CheckoutRepository {
  lines: CheckoutLineRecord[] = [line()];
  coupon: CouponRecord | null = null;
  campaigns: CampaignRecord[] = [];
  async loadCartLines() {
    return this.lines;
  }
  async findCoupon() {
    return this.coupon;
  }
  async listActiveCampaigns() {
    return this.campaigns;
  }
}

class FakeOrders implements OrderRepository {
  created: NewOrder[] = [];
  deferred: NewOrder[] = [];
  couponUses = 0;
  async createPendingOrder(order: NewOrder) {
    this.created.push(order);
    return {
      orderId: "o1",
      orderNumber: "SABC",
      lookupToken: "tok",
      merchantOid: "SABC",
    };
  }
  async countCouponUses() {
    return this.couponUses;
  }
  async createDeferredOrder(order: NewOrder) {
    this.created.push(order);
    this.deferred.push(order);
    return {
      orderId: "o2",
      orderNumber: "SDEF",
      lookupToken: "tok2",
      merchantOid: "SDEF",
    };
  }
  async markDeferredPaid() {
    return true;
  }
  async findById() {
    return null;
  }
  async findByOrderNumber() {
    return null;
  }
  async findByLookupToken() {
    return null;
  }
  async listByUser() {
    return [];
  }
  async getPaymentForOrder() {
    return null;
  }
  async applyPaymentResult() {
    return { kind: "not-found" as const };
  }
  async cancelOrder() {}
  async recordRefund() {}
  async releaseExpired() {
    return 0;
  }
}

const carts = (id: string | null, count = 1): CartSource => ({
  getCart: async () => ({
    cart: {
      id,
      lines: Array.from({ length: count }, () => ({}) as never),
      itemCount: count,
      subtotal: "0",
      currency: "TRY",
      hasIssues: false,
    },
  }),
});

describe("CheckoutService", () => {
  let repo: FakeCheckoutRepo;
  let orders: FakeOrders;
  let service: CheckoutService;
  const now = new Date("2026-06-01T12:00:00Z");

  const build = (
    overrides: Partial<CheckoutSettings> = {},
    cart = carts("c1"),
  ) =>
    new CheckoutService({
      carts: cart,
      checkout: repo,
      orders,
      shipping,
      settings: { ...settings, ...overrides },
      now: () => now,
    });

  beforeEach(() => {
    repo = new FakeCheckoutRepo();
    orders = new FakeOrders();
    service = build();
  });

  it("toplamları ve kargoyu hesaplar", async () => {
    const quote = await service.quote(identity, null, {
      userId: null,
      email: null,
    });

    expect(quote).toMatchObject({
      subtotal: "200.00",
      shippingTotal: "50.00",
      discountTotal: "0.00",
      grandTotal: "250.00",
    });
    expect(quote.lines[0]).toMatchObject({
      variantName: "Siyah / M",
      quantity: 2,
    });
  });

  it("limit üzerinde kargoyu ücretsiz yapar", async () => {
    repo.lines = [line({ quantity: 6 })];
    const quote = await service.quote(identity, null, {
      userId: null,
      email: null,
    });
    expect(quote.shippingTotal).toBe("0.00");
  });

  it("boş sepette hata verir", async () => {
    service = build({}, carts(null, 0));
    await expect(
      service.quote(identity, null, { userId: null, email: null }),
    ).rejects.toThrow("Sepetiniz boş");
  });

  it("stoğu yetmeyen satırda ConflictError fırlatır", async () => {
    repo.lines = [line({ quantity: 5, stockQuantity: 3 })];
    await expect(service.placeOrder(identity, input())).rejects.toThrow(
      "yeterli stok yok",
    );
  });

  it("satıştan kalkmış ürünü reddeder", async () => {
    repo.lines = [line({ isActive: false })];
    await expect(service.placeOrder(identity, input())).rejects.toThrow(
      "artık satışta değil",
    );
  });

  it("misafir siparişi kapalıysa girişsiz sipariş vermeyi engeller", async () => {
    service = build({ guestCheckoutEnabled: false });
    await expect(service.placeOrder(identity, input())).rejects.toThrow(
      "giriş yapmalısınız",
    );
  });

  it("siparişi fiyat anlık görüntüsüyle oluşturur", async () => {
    const result = await service.placeOrder(identity, input());

    expect(result).toMatchObject({ orderNumber: "SABC", grandTotal: "250.00" });
    const order = orders.created[0]!;
    expect(order).toMatchObject({
      email: "ali@example.com",
      cartId: "c1",
      subtotal: "200.00",
      grandTotal: "250.00",
      paymentProvider: "paytr",
    });
    expect(order.items[0]).toMatchObject({
      sku: "SKU-1",
      unitPrice: "100.00",
      lineTotal: "200.00",
      taxRate: "20.00",
      trackInventory: true,
    });
    // Fatura adresi verilmediyse teslimat adresi kullanılır.
    expect(order.billingAddress).toEqual(order.shippingAddress);
  });

  describe("kupon", () => {
    const coupon = (overrides: Partial<CouponRecord> = {}): CouponRecord => ({
      code: "YAZ10",
      type: "PERCENT",
      value: new Decimal(10),
      minSubtotal: null,
      maxUses: null,
      perCustomerLimit: null,
      usedCount: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
      ...overrides,
    });
    const owner = { userId: null, email: "ali@example.com" };

    it("geçerli kuponu uygular ve siparişe yazar", async () => {
      repo.coupon = coupon();
      const result = await service.placeOrder(
        identity,
        input({ couponCode: "YAZ10" }),
      );

      expect(result.grandTotal).toBe("230.00"); // 200 - 20 + 50
      expect(orders.created[0]!.couponCode).toBe("YAZ10");
    });

    it.each([
      ["bulunamayan", null, "geçersiz"],
      ["pasif", coupon({ isActive: false }), "geçersiz"],
      [
        "henüz başlamamış",
        coupon({ startsAt: new Date("2026-07-01") }),
        "henüz geçerli değil",
      ],
      [
        "süresi dolmuş",
        coupon({ endsAt: new Date("2026-05-01") }),
        "süresi dolmuş",
      ],
      ["limiti dolmuş", coupon({ maxUses: 5, usedCount: 5 }), "limiti dolmuş"],
      [
        "minimum tutar altında",
        coupon({ minSubtotal: new Decimal(1000) }),
        "minimum sepet tutarı",
      ],
    ])("%s kuponu reddeder", async (_name, record, message) => {
      repo.coupon = record;
      await expect(service.quote(identity, "YAZ10", owner)).rejects.toThrow(
        message,
      );
    });

    it("müşteri başına limiti aşınca reddeder", async () => {
      repo.coupon = coupon({ perCustomerLimit: 1 });
      orders.couponUses = 1;
      await expect(service.quote(identity, "YAZ10", owner)).rejects.toThrow(
        "daha fazla kullanamazsınız",
      );
    });
  });

  it("aktif kampanyayı otomatik uygular", async () => {
    repo.campaigns = [
      {
        name: "Sepette %10",
        ruleType: "cart-threshold",
        config: { minSubtotal: 100, type: "PERCENT", value: 10 },
        priority: 1,
      },
    ];
    const quote = await service.quote(identity, null, {
      userId: null,
      email: null,
    });

    expect(quote.discounts).toEqual([
      { label: "Sepette %10", amount: "20.00" },
    ]);
    expect(quote.grandTotal).toBe("230.00");
  });

  it("bozuk kampanya yapılandırması ödemeyi engellemez", async () => {
    repo.campaigns = [
      {
        name: "Bozuk",
        ruleType: "category",
        config: { yanlis: true },
        priority: 1,
      },
    ];
    const quote = await service.quote(identity, null, {
      userId: null,
      email: null,
    });
    expect(quote.discountTotal).toBe("0.00");
  });
});

describe("CheckoutService: B2B kuralları", () => {
  const events: { name: string; payload: unknown }[] = [];
  const bus = {
    publish: async (name: string, payload: unknown) =>
      void events.push({ name, payload }),
    subscribe: () => {},
  };

  const dealers = (
    profile: Awaited<ReturnType<DealerTerms["findProfile"]>>,
    outstanding = "0",
  ): DealerTerms => ({
    findProfile: async () => profile,
    outstandingDeferredTotal: async () => new Decimal(outstanding),
  });

  const approved = {
    status: "APPROVED",
    creditLimit: "1000.00",
    minOrderAmount: null,
  };

  function build(
    overrides: Partial<CheckoutSettings> = {},
    terms?: DealerTerms,
  ) {
    const repo = new FakeCheckoutRepo();
    const orders = new FakeOrders();
    const service = new CheckoutService({
      carts: carts("c1"),
      checkout: repo,
      orders,
      shipping,
      settings: {
        ...settings,
        bankTransferConfigured: true,
        deferredPaymentDays: 30,
        ...overrides,
      },
      dealers: terms,
      events: bus as never,
      now: () => new Date("2026-06-01T12:00:00Z"),
    });
    return { service, orders };
  }

  const dealerIdentity: CartIdentity = { userId: "u1", sessionToken: null };

  beforeEach(() => {
    events.length = 0;
  });

  it("yalnızca-B2B modunda bayi olmayanı reddeder", async () => {
    const { service } = build({ requireDealer: true }, dealers(null));
    await expect(service.placeOrder(dealerIdentity, input())).rejects.toThrow(
      "yalnızca onaylı bayiler",
    );
  });

  it("onaylı bayi yalnızca-B2B modunda sipariş verebilir", async () => {
    const { service, orders } = build(
      { requireDealer: true },
      dealers(approved),
    );
    await service.placeOrder(dealerIdentity, input());
    expect(orders.created).toHaveLength(1);
  });

  it("minimum sipariş tutarının altını reddeder", async () => {
    const { service } = build(
      {},
      dealers({ ...approved, minOrderAmount: "5000.00" }),
    );
    await expect(service.placeOrder(dealerIdentity, input())).rejects.toThrow(
      "Minimum sipariş tutarınız",
    );
  });

  it("bayi olmayan müşteri havale veya vadeli ödeme seçemez", async () => {
    const { service } = build({}, dealers(null));
    for (const paymentMethod of ["BANK_TRANSFER", "DEFERRED"] as const) {
      await expect(
        service.placeOrder(dealerIdentity, input({ paymentMethod })),
      ).rejects.toThrow("yalnızca onaylı bayiler içindir");
    }
  });

  it("havale/EFT siparişinde uzun rezervasyon süresi uygular ve olay yayınlar", async () => {
    const { service, orders } = build(
      { bankTransferHoldHours: 48 },
      dealers(approved),
    );

    await service.placeOrder(
      dealerIdentity,
      input({ paymentMethod: "BANK_TRANSFER" }),
    );

    expect(orders.created[0]).toMatchObject({
      paymentMethod: "BANK_TRANSFER",
      reservationMinutes: 48 * 60,
      paymentProvider: "bank_transfer",
    });
    expect(events).toEqual([
      {
        name: "order.placed",
        payload: { orderId: "o1", method: "BANK_TRANSFER" },
      },
    ]);
  });

  it("havale hesabı tanımlı değilse havaleyi reddeder", async () => {
    const { service } = build(
      { bankTransferConfigured: false },
      dealers(approved),
    );
    await expect(
      service.placeOrder(
        dealerIdentity,
        input({ paymentMethod: "BANK_TRANSFER" }),
      ),
    ).rejects.toThrow("Havale/EFT");
  });

  it("vadeli ödemede kredi limiti içindeyse vade tarihiyle sipariş oluşturur", async () => {
    const { service, orders } = build({}, dealers(approved, "100"));

    await service.placeOrder(
      dealerIdentity,
      input({ paymentMethod: "DEFERRED" }),
    );

    expect(orders.deferred).toHaveLength(1);
    expect(orders.created[0]!.paymentMethod).toBe("DEFERRED");
    expect(events[0]).toMatchObject({ name: "order.placed" });
  });

  it("kredi limitini aşan vadeli siparişi reddeder", async () => {
    const { service, orders } = build({}, dealers(approved, "900"));
    await expect(
      service.placeOrder(dealerIdentity, input({ paymentMethod: "DEFERRED" })),
    ).rejects.toThrow("Kredi limitiniz yetersiz");
    expect(orders.created).toHaveLength(0);
  });

  it("kredi limiti tanımsızsa vadeli ödemeyi reddeder", async () => {
    const { service } = build({}, dealers({ ...approved, creditLimit: null }));
    await expect(
      service.placeOrder(dealerIdentity, input({ paymentMethod: "DEFERRED" })),
    ).rejects.toThrow("kredi limitiniz tanımlı değil");
  });

  it("ödeme seçeneklerini ve kalan krediyi listeler", async () => {
    const { service } = build({}, dealers(approved, "400"));
    const options = await service.paymentOptions(dealerIdentity, "250.00");

    expect(options.map((o) => [o.method, o.available])).toEqual([
      ["CARD", true],
      ["BANK_TRANSFER", true],
      ["DEFERRED", true],
    ]);
    expect(options[2]!.note).toContain("Kullanılabilir limit");
  });

  it("bayi olmayan müşteriye yalnızca kartı sunar", async () => {
    const { service } = build({}, dealers(null));
    const options = await service.paymentOptions(dealerIdentity, "250.00");
    expect(options.map((o) => o.method)).toEqual(["CARD"]);
  });
});
