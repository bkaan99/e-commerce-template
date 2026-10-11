import Decimal from "decimal.js";

export const DEFAULT_CURRENCY = "TRY";
export const DEFAULT_LOCALE = "tr-TR";

export type MoneyInput = Decimal.Value;

/** Para hesabı için Decimal üretir. Kuruş hatası olmaması için number ile hesap yapılmaz. */
export function toDecimal(value: MoneyInput): Decimal {
  return new Decimal(value);
}

/** Tutarı 2 basamağa yuvarlar (yarıdan yukarı). */
export function roundMoney(value: MoneyInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Yalnızca görüntüleme içindir; hesaplamada kullanılmaz. */
export function formatMoney(
  value: MoneyInput,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(roundMoney(value).toNumber());
}
