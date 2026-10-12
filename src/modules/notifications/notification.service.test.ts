import { describe, expect, it, vi } from "vitest";
import type { JobQueue } from "@/shared/queue";
import type { OrderRepository } from "../orders/order.repository";
import type { OrderView } from "../orders/order.types";
import { JOB_SEND_EMAIL, NotificationService } from "./notification.service";
import { escapeHtml } from "./templates/layout";

const address = {
  firstName: "Ali <b>",
  lastName: "Veli",
  phone: "05550000000",
  city: "İstanbul",
  district: "Kadıköy",
  neighborhood: null,
  addressLine: "Örnek Sk.",
  postalCode: null,
  invoiceType: "INDIVIDUAL" as const,
  nationalId: null,
  companyName: null,
  taxNumber: null,
  taxOffice: null,
};

const order: OrderView = {
  id: "o1",
  orderNumber: "SABC123",
  lookupToken: "tok",
  status: "PAID",
  paymentStatus: "PAID",
  email: "ali@example.com",
  currency: "TRY",
  subtotal: "200.00",
  discountTotal: "20.00",
  shippingTotal: "50.00",
  taxTotal: "0.00",
  grandTotal: "230.00",
  couponCode: null,
  shippingAddress: address,
  billingAddress: address,
  customerNote: null,
  items: [
    {
      variantId: null,
      productName: "Tişört <script>",
      variantName: "Siyah / M",
      sku: "SKU",
      unitPrice: "100.00",
      quantity: 2,
      lineTotal: "200.00",
    },
  ],
  trackingNumber: "TRK1",
  carrier: "Yurtiçi",
  createdAt: new Date(),
  userId: null,
  paymentMethod: "CARD",
  paymentDueAt: null,
};

function setup(found: OrderView | null = order) {
  const enqueue = vi.fn(async () => "job");
  const queue = { enqueue } as unknown as JobQueue;
  const orders = {
    findById: async () => found,
  } as unknown as OrderRepository;
  const service = new NotificationService(
    orders,
    queue,
    { siteName: "Mağaza", baseUrl: "https://site.test" },
    "yonetici@site.test",
  );
  return { service, enqueue };
}

describe("NotificationService", () => {
  it("ödenen sipariş için müşteriye ve yöneticiye e-posta kuyruğa atar", async () => {
    const { service, enqueue } = setup();
    await service.onOrderPaid("o1");

    expect(enqueue).toHaveBeenCalledTimes(2);
    const [first, second] = enqueue.mock.calls as unknown as [
      string,
      { to: string; subject: string; html: string; text: string },
    ][];
    expect(first![0]).toBe(JOB_SEND_EMAIL);
    expect(first![1].to).toBe("ali@example.com");
    expect(first![1].subject).toContain("SABC123");
    expect(second![1].to).toBe("yonetici@site.test");
  });

  it("kullanıcı verisini HTML'de kaçırır", async () => {
    const { service, enqueue } = setup();
    await service.onOrderPaid("o1");

    const html = (
      enqueue.mock.calls[0] as unknown as [string, { html: string }]
    )[1].html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("Tişört &lt;script&gt;");
    expect(html).toContain("https://site.test/siparis/SABC123?t=tok");
  });

  it("iade edilen iptalde iade bilgisini yazar", async () => {
    const { service, enqueue } = setup();
    await service.onOrderCancelled("o1", true);

    const message = (
      enqueue.mock.calls[0] as unknown as [string, { text: string }]
    )[1];
    expect(message.text).toContain("iade edilecektir");
  });

  it("kargo e-postasında takip numarasını içerir", async () => {
    const { service, enqueue } = setup();
    await service.onOrderShipped("o1");

    const message = (
      enqueue.mock.calls[0] as unknown as [string, { text: string }]
    )[1];
    expect(message.text).toContain("TRK1");
  });

  it("sipariş bulunamazsa e-posta göndermez", async () => {
    const { service, enqueue } = setup(null);
    await service.onOrderPaid("yok");
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("escapeHtml", () => {
  it("özel karakterleri kaçırır", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });
});
