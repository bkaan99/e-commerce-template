import type Decimal from "decimal.js";
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/shared/errors";
import { formatMoney, toDecimal } from "@/shared/money";
import { availableQuantity } from "../catalog/availability";
import { RetailPriceResolver, type PriceResolver } from "../catalog/pricing";
import type { CartIdentity, CartMutationResult } from "../cart/cart.types";
import type { OrderRepository } from "../orders/order.repository";
import type {
  AddressSnapshot,
  CreatedOrder,
  NewOrderItem,
} from "../orders/order.types";
import type { CheckoutInput } from "./checkout.schema";
import type {
  CheckoutLineRecord,
  CheckoutRepository,
  CouponRecord,
} from "./checkout.repository";
import {
  CouponRule,
  applyDiscountRules,
  createCampaignRule,
  type AppliedDiscount,
  type DiscountRule,
} from "./discounts";
import type { ShippingRateCalculator } from "./shipping";
import { calculateOrderTotals, type OrderTotals } from "./totals";

/** Checkout'un sepetten yalnızca ihtiyaç duyduğu parça. */
export interface CartSource {
  getCart(identity: CartIdentity): Promise<CartMutationResult>;
}

export interface CheckoutSettings {
  guestCheckoutEnabled: boolean;
  reservationMinutes: number;
  shippingTaxRate: number;
  paymentProvider: string;
}

export interface CheckoutQuote {
  cartId: string;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  discounts: { label: string; amount: string }[];
  lines: {
    variantId: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
}

interface PricedLine {
  record: CheckoutLineRecord;
  unitPrice: Decimal;
}

export interface CheckoutDeps {
  carts: CartSource;
  checkout: CheckoutRepository;
  orders: OrderRepository;
  shipping: ShippingRateCalculator;
  settings: CheckoutSettings;
  priceResolver?: PriceResolver;
  now?: () => Date;
}

export class CheckoutService {
  private readonly priceResolver: PriceResolver;
  private readonly now: () => Date;

  constructor(private readonly deps: CheckoutDeps) {
    this.priceResolver = deps.priceResolver ?? new RetailPriceResolver();
    this.now = deps.now ?? (() => new Date());
  }

  /** Sepet için fiyat/indirim/kargo özetini üretir; kayıt oluşturmaz. */
  async quote(
    identity: CartIdentity,
    couponCode: string | null,
    owner: { userId: string | null; email: string | null },
  ): Promise<CheckoutQuote> {
    const { cartId, lines } = await this.loadSellableLines(identity);
    return (
      await this.compute(
        cartId,
        lines,
        couponCode,
        owner,
        identity.customerGroupId ?? null,
      )
    ).quote;
  }

  async placeOrder(
    identity: CartIdentity,
    input: CheckoutInput,
  ): Promise<CreatedOrder & { grandTotal: string }> {
    if (!identity.userId && !this.deps.settings.guestCheckoutEnabled) {
      throw new ForbiddenError("Sipariş vermek için giriş yapmalısınız");
    }

    const { cartId, lines } = await this.loadSellableLines(identity);
    const computed = await this.compute(
      cartId,
      lines,
      input.couponCode,
      { userId: identity.userId, email: input.email },
      identity.customerGroupId ?? null,
    );

    const items: NewOrderItem[] = computed.priced.map((entry, index) => ({
      variantId: entry.record.variantId,
      productName: entry.record.product.name,
      variantName: entry.record.optionLabels.length
        ? entry.record.optionLabels.join(" / ")
        : null,
      sku: entry.record.sku,
      unitPrice: entry.unitPrice.toFixed(2),
      taxRate: toDecimal(entry.record.product.taxRate).toFixed(2),
      quantity: entry.record.quantity,
      lineTotal: computed.totals.lines[index]!.lineTotal.toFixed(2),
      trackInventory: entry.record.product.trackInventory,
    }));

    const shipping: AddressSnapshot = input.shippingAddress;
    const billing: AddressSnapshot =
      input.billingAddress ?? input.shippingAddress;

    const created = await this.deps.orders.createPendingOrder({
      userId: identity.userId,
      email: input.email,
      cartId,
      currency: computed.quote.currency,
      subtotal: computed.quote.subtotal,
      discountTotal: computed.quote.discountTotal,
      shippingTotal: computed.quote.shippingTotal,
      taxTotal: computed.quote.taxTotal,
      grandTotal: computed.quote.grandTotal,
      couponCode: computed.appliedCoupon,
      shippingAddress: shipping,
      billingAddress: billing,
      customerNote: input.customerNote,
      items,
      reservationMinutes: this.deps.settings.reservationMinutes,
      paymentProvider: this.deps.settings.paymentProvider,
      paymentMethod: "CARD",
    });

    return { ...created, grandTotal: computed.quote.grandTotal };
  }

  private async loadSellableLines(identity: CartIdentity): Promise<{
    cartId: string;
    lines: CheckoutLineRecord[];
  }> {
    const { cart } = await this.deps.carts.getCart(identity);
    if (!cart.id || cart.lines.length === 0) {
      throw new ValidationError("Sepetiniz boş");
    }

    const lines = await this.deps.checkout.loadCartLines(cart.id);
    if (lines.length === 0) throw new ValidationError("Sepetiniz boş");

    for (const line of lines) {
      if (!line.isActive || line.product.status !== "ACTIVE") {
        throw new ConflictError(`"${line.product.name}" artık satışta değil`);
      }

      const available = availableQuantity({
        trackInventory: line.product.trackInventory,
        stockQuantity: line.stockQuantity,
        reservedQuantity: line.reservedQuantity,
      });
      if (available !== null && line.quantity > available) {
        throw new ConflictError(
          `"${line.product.name}" için yeterli stok yok (kalan: ${available})`,
        );
      }
    }

    return { cartId: cart.id, lines };
  }

  private async compute(
    cartId: string,
    lines: CheckoutLineRecord[],
    couponCode: string | null,
    owner: { userId: string | null; email: string | null },
    customerGroupId: string | null,
  ) {
    const unitPrices = await this.priceResolver.resolveUnitPrices(
      lines.map((record) => ({
        variantId: record.variantId,
        listPrice: record.price,
        quantity: record.quantity,
      })),
      { customerGroupId },
    );
    const priced: PricedLine[] = lines.map((record) => ({
      record,
      unitPrice: unitPrices.get(record.variantId) ?? toDecimal(record.price),
    }));

    const subtotal = priced.reduce(
      (sum, entry) => sum.plus(entry.unitPrice.times(entry.record.quantity)),
      toDecimal(0),
    );

    const rules = await this.collectRules(subtotal, couponCode, owner);
    const discountContext = {
      subtotal,
      lines: priced.map((entry) => ({
        variantId: entry.record.variantId,
        categoryId: entry.record.product.categoryId,
        quantity: entry.record.quantity,
        unitPrice: entry.unitPrice,
      })),
    };
    const { applied, total: discountTotal } = applyDiscountRules(
      rules.list,
      discountContext,
    );

    const afterDiscount = subtotal.minus(discountTotal);
    const totalDesi = priced.reduce(
      (sum, entry) => sum + entry.record.desi * entry.record.quantity,
      0,
    );
    const shippingTotal = this.deps.shipping.calculate({
      subtotal: afterDiscount,
      totalDesi,
    });

    const totals = calculateOrderTotals({
      lines: priced.map((entry) => ({
        variantId: entry.record.variantId,
        quantity: entry.record.quantity,
        unitPrice: entry.unitPrice,
        taxRate: entry.record.product.taxRate,
      })),
      discountTotal,
      shippingTotal,
      shippingTaxRate: this.deps.settings.shippingTaxRate,
    });

    const currency = priced[0]?.record.currency ?? "TRY";

    return {
      priced,
      totals,
      appliedCoupon: rules.couponApplied ? couponCode : null,
      quote: this.toQuote(cartId, currency, priced, totals, applied),
    };
  }

  private async collectRules(
    subtotal: Decimal,
    couponCode: string | null,
    owner: { userId: string | null; email: string | null },
  ): Promise<{ list: DiscountRule[]; couponApplied: boolean }> {
    const now = this.now();
    const campaigns = await this.deps.checkout.listActiveCampaigns(now);
    const list: DiscountRule[] = campaigns
      .map((campaign) =>
        createCampaignRule({
          name: campaign.name,
          ruleType: campaign.ruleType,
          config: campaign.config,
        }),
      )
      .filter((rule): rule is DiscountRule => rule !== null);

    if (!couponCode) return { list, couponApplied: false };

    const coupon = await this.deps.checkout.findCoupon(couponCode);
    await this.assertCouponUsable(coupon, subtotal, owner);

    list.push(
      new CouponRule({
        code: coupon!.code,
        type: coupon!.type,
        value: coupon!.value,
        minSubtotal: coupon!.minSubtotal,
      }),
    );
    return { list, couponApplied: true };
  }

  private async assertCouponUsable(
    coupon: CouponRecord | null,
    subtotal: Decimal,
    owner: { userId: string | null; email: string | null },
  ): Promise<void> {
    const now = this.now();

    if (!coupon || !coupon.isActive) {
      throw new ValidationError("Kupon kodu geçersiz");
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new ValidationError("Kupon henüz geçerli değil");
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      throw new ValidationError("Kuponun süresi dolmuş");
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new ValidationError("Kuponun kullanım limiti dolmuş");
    }
    if (coupon.minSubtotal && subtotal.lt(coupon.minSubtotal)) {
      throw new ValidationError(
        `Bu kupon için minimum sepet tutarı ${formatMoney(coupon.minSubtotal)}`,
      );
    }
    if (coupon.perCustomerLimit !== null && owner.email) {
      const used = await this.deps.orders.countCouponUses(coupon.code, {
        userId: owner.userId,
        email: owner.email,
      });
      if (used >= coupon.perCustomerLimit) {
        throw new ValidationError("Bu kuponu daha fazla kullanamazsınız");
      }
    }
  }

  private toQuote(
    cartId: string,
    currency: string,
    priced: PricedLine[],
    totals: OrderTotals,
    applied: AppliedDiscount[],
  ): CheckoutQuote {
    return {
      cartId,
      currency,
      subtotal: totals.subtotal.toFixed(2),
      discountTotal: totals.discountTotal.toFixed(2),
      shippingTotal: totals.shippingTotal.toFixed(2),
      taxTotal: totals.taxTotal.toFixed(2),
      grandTotal: totals.grandTotal.toFixed(2),
      discounts: applied.map((item) => ({
        label: item.label,
        amount: item.amount.toFixed(2),
      })),
      lines: priced.map((entry, index) => ({
        variantId: entry.record.variantId,
        productName: entry.record.product.name,
        variantName: entry.record.optionLabels.length
          ? entry.record.optionLabels.join(" / ")
          : null,
        quantity: entry.record.quantity,
        unitPrice: entry.unitPrice.toFixed(2),
        lineTotal: totals.lines[index]!.lineTotal.toFixed(2),
      })),
    };
  }
}
