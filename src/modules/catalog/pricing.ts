import type Decimal from "decimal.js";
import { toDecimal, type MoneyInput } from "@/shared/money";

export interface PricingContext {
  customerGroupId: string | null;
  quantity: number;
}

export interface PriceableVariant {
  id: string;
  price: MoneyInput;
}

/**
 * Birim fiyatı çözen sözleşme. B2B fazında grup fiyatı, grup iskontosu ve
 * kademeli fiyat yeni uygulamalar olarak eklenir; çağıranlar değişmez.
 */
export interface PriceResolver {
  resolveUnitPrice(variant: PriceableVariant, context: PricingContext): Decimal;
}

/** Perakende: varyantın liste fiyatı. */
export class RetailPriceResolver implements PriceResolver {
  resolveUnitPrice(variant: PriceableVariant): Decimal {
    return toDecimal(variant.price);
  }
}
