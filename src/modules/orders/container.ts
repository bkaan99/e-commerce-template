import { siteConfig } from "@/config/site.config";
import { features } from "@/config/features";
import { DevPaymentProvider } from "@/integrations/payment/dev/dev-payment-provider";
import type { PaymentProvider } from "@/integrations/payment/payment-provider";
import { PaytrProvider } from "@/integrations/payment/paytr/paytr-provider";
import { getDb } from "@/shared/db";
import { getEnv } from "@/shared/env";
import { getEventBus } from "@/shared/events";
import { getJobQueue } from "@/shared/queue";
import { getSiteUrl } from "@/shared/site-url";
import { cartService } from "../cart/container";
import { priceResolver } from "../catalog/container";
import { PrismaDealerRepository } from "../b2b/dealer.repository";
import { PrismaCheckoutRepository } from "../checkout/checkout.repository";
import { CheckoutService } from "../checkout/checkout.service";
import { ConfiguredShippingRateCalculator } from "../checkout/shipping";
import { NotificationService } from "../notifications/notification.service";
import { PrismaOrderRepository } from "./order.repository";
import { OrderService } from "./order.service";
import { PaymentService } from "./payment.service";

export const orderRepository = new PrismaOrderRepository(getDb);

let paymentProvider: PaymentProvider | undefined;

/** PayTR anahtarları varsa PayTR, yoksa (yalnızca geliştirmede) sahte sağlayıcı. */
export function getPaymentProvider(): PaymentProvider {
  if (paymentProvider) return paymentProvider;

  const env = getEnv();
  if (
    env.PAYTR_MERCHANT_ID &&
    env.PAYTR_MERCHANT_KEY &&
    env.PAYTR_MERCHANT_SALT
  ) {
    paymentProvider = new PaytrProvider(
      {
        merchantId: env.PAYTR_MERCHANT_ID,
        merchantKey: env.PAYTR_MERCHANT_KEY,
        merchantSalt: env.PAYTR_MERCHANT_SALT,
      },
      { testMode: env.NODE_ENV !== "production" || env.PAYTR_TEST_MODE },
    );
  } else {
    paymentProvider = new DevPaymentProvider(env.AUTH_SECRET, getSiteUrl());
  }

  return paymentProvider;
}

export function getDevPaymentProvider(): DevPaymentProvider | null {
  const provider = getPaymentProvider();
  return provider instanceof DevPaymentProvider ? provider : null;
}

let notifications: NotificationService | undefined;

/** Bildirim servisi; olay aboneleri ilk kullanımda bir kez bağlanır. */
export function getNotificationService(): NotificationService {
  if (notifications) return notifications;

  notifications = new NotificationService(orderRepository, getJobQueue(), {
    siteName: siteConfig.name,
    baseUrl: getSiteUrl(),
  });

  const bus = getEventBus();
  const service = notifications;
  bus.subscribe("order.paid", ({ orderId }) => service.onOrderPaid(orderId));
  bus.subscribe("order.placed", ({ orderId, method }) =>
    service.onOrderPlaced(orderId, method),
  );
  bus.subscribe("order.cancelled", ({ orderId, refunded }) =>
    service.onOrderCancelled(orderId, refunded),
  );
  bus.subscribe("order.shipped", ({ orderId }) =>
    service.onOrderShipped(orderId),
  );

  return notifications;
}

export function getPaymentService(): PaymentService {
  getNotificationService();
  return new PaymentService(
    getPaymentProvider(),
    orderRepository,
    getEventBus(),
    { baseUrl: getSiteUrl() },
  );
}

export function getOrderService(): OrderService {
  getNotificationService();
  return new OrderService(orderRepository, getPaymentProvider(), getEventBus());
}

export function getCheckoutService(): CheckoutService {
  return new CheckoutService({
    carts: cartService,
    priceResolver,
    checkout: new PrismaCheckoutRepository(getDb),
    orders: orderRepository,
    shipping: new ConfiguredShippingRateCalculator(),
    settings: {
      guestCheckoutEnabled: features.guestCheckout,
      reservationMinutes: siteConfig.inventory.reservationMinutes,
      shippingTaxRate: siteConfig.shipping.taxRate,
      paymentProvider: getPaymentProvider().name,
      requireDealer: siteConfig.salesMode === "b2b",
      bankTransferConfigured: siteConfig.b2b.bankAccounts.length > 0,
      bankTransferHoldHours: siteConfig.b2b.bankTransferHoldHours,
      deferredPaymentDays: siteConfig.b2b.deferredPaymentDays,
    },
    dealers: features.b2b ? new PrismaDealerRepository(getDb) : undefined,
    events: getEventBus(),
  });
}
