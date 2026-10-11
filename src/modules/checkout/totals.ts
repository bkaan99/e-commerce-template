import type Decimal from "decimal.js";
import { roundMoney, toDecimal } from "@/shared/money";

export interface TotalsLineInput {
  variantId: string;
  quantity: number;
  /** KDV dahil birim fiyat */
  unitPrice: Decimal;
  /** KDV oranı, yüzde */
  taxRate: Decimal.Value;
}

export interface TotalsLine {
  variantId: string;
  lineTotal: Decimal;
  discount: Decimal;
  /** İndirim sonrası, KDV dahil satır tutarı */
  netTotal: Decimal;
  /** netTotal içindeki KDV tutarı */
  taxAmount: Decimal;
}

export interface OrderTotals {
  lines: TotalsLine[];
  subtotal: Decimal;
  discountTotal: Decimal;
  shippingTotal: Decimal;
  /** Satırlar ve kargo dahil toplam KDV (fiyatlara dahildir) */
  taxTotal: Decimal;
  grandTotal: Decimal;
}

/** KDV dahil tutardan KDV payını çıkarır: brüt × oran / (100 + oran). */
export function extractTax(gross: Decimal, rate: Decimal.Value): Decimal {
  const percent = toDecimal(rate);
  return roundMoney(gross.times(percent).dividedBy(percent.plus(100)));
}

/**
 * Sipariş toplamlarını hesaplar. İndirim satırlara tutarla orantılı dağıtılır
 * (yuvarlama farkı son satıra yazılır); KDV indirim sonrası tutardan çıkarılır.
 */
export function calculateOrderTotals(input: {
  lines: TotalsLineInput[];
  discountTotal: Decimal;
  shippingTotal: Decimal;
  shippingTaxRate: Decimal.Value;
}): OrderTotals {
  const lineTotals = input.lines.map((line) =>
    line.unitPrice.times(line.quantity),
  );
  const subtotal = lineTotals.reduce(
    (sum, value) => sum.plus(value),
    toDecimal(0),
  );
  const discountTotal = input.discountTotal.gt(subtotal)
    ? subtotal
    : input.discountTotal;

  let distributed = toDecimal(0);
  const lines: TotalsLine[] = input.lines.map((line, index) => {
    const lineTotal = lineTotals[index]!;
    const isLast = index === input.lines.length - 1;

    const share = subtotal.isZero()
      ? toDecimal(0)
      : isLast
        ? discountTotal.minus(distributed)
        : roundMoney(discountTotal.times(lineTotal).dividedBy(subtotal));

    distributed = distributed.plus(share);
    const netTotal = lineTotal.minus(share);

    return {
      variantId: line.variantId,
      lineTotal,
      discount: share,
      netTotal,
      taxAmount: extractTax(netTotal, line.taxRate),
    };
  });

  const shippingTax = extractTax(input.shippingTotal, input.shippingTaxRate);
  const taxTotal = lines.reduce(
    (sum, line) => sum.plus(line.taxAmount),
    shippingTax,
  );

  return {
    lines,
    subtotal,
    discountTotal,
    shippingTotal: input.shippingTotal,
    taxTotal,
    grandTotal: subtotal.minus(discountTotal).plus(input.shippingTotal),
  };
}
