import type Decimal from "decimal.js";
import { siteConfig, type SiteConfig } from "@/config/site.config";
import { roundMoney, toDecimal } from "@/shared/money";

export interface ShippingContext {
  /** İndirim sonrası, kargo hariç ara toplam */
  subtotal: Decimal;
  /** Sepetteki toplam desi (adet ile çarpılmış); bilinmiyorsa 0 */
  totalDesi: number;
}

/** Kargo ücretini hesaplayan sözleşme; bölge/firma tarifesi yeni uygulamalarla eklenir. */
export interface ShippingRateCalculator {
  calculate(context: ShippingContext): Decimal;
}

type ShippingConfig = SiteConfig["shipping"];

/** Ücretsiz kargo limiti → desi tarifesi → sabit ücret sırasıyla uygular. */
export class ConfiguredShippingRateCalculator implements ShippingRateCalculator {
  constructor(private readonly config: ShippingConfig = siteConfig.shipping) {}

  calculate(context: ShippingContext): Decimal {
    if (context.subtotal.gte(this.config.freeShippingThreshold)) {
      return toDecimal(0);
    }

    const tariff = [...this.config.desiTariff].sort(
      (a, b) => a.maxDesi - b.maxDesi,
    );
    if (tariff.length === 0 || context.totalDesi <= 0) {
      return roundMoney(this.config.flatRate);
    }

    const tier = tariff.find((item) => context.totalDesi <= item.maxDesi);
    if (tier) return roundMoney(tier.price);

    const last = tariff[tariff.length - 1]!;
    const extraDesi = Math.ceil(context.totalDesi - last.maxDesi);
    return roundMoney(
      toDecimal(last.price).plus(
        toDecimal(this.config.extraDesiPrice).times(extraDesi),
      ),
    );
  }
}
