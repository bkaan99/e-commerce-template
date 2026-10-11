import Decimal from "decimal.js";
import { roundMoney, toDecimal } from "@/shared/money";

export interface RefundLine {
  unitPrice: Decimal.Value;
  quantity: number;
}

/**
 * İade tutarı: ürün tutarı, siparişteki indirim oranı kadar düşürülür
 * (müşteri ödediğinden fazlasını almamalı). Kargo ücreti iade edilmez.
 */
export function calculateRefund(
  lines: readonly RefundLine[],
  orderSubtotal: Decimal.Value,
  orderDiscountTotal: Decimal.Value,
): Decimal {
  const subtotal = toDecimal(orderSubtotal);
  const gross = lines.reduce(
    (sum, line) => sum.plus(toDecimal(line.unitPrice).times(line.quantity)),
    toDecimal(0),
  );

  if (subtotal.isZero()) return toDecimal(0);

  const discountRatio = toDecimal(orderDiscountTotal).dividedBy(subtotal);
  return roundMoney(gross.times(toDecimal(1).minus(discountRatio)));
}
