import type Decimal from "decimal.js";
import { roundMoney, toDecimal, type MoneyInput } from "@/shared/money";

/** Fiyatı kimin için çözdüğümüz: bayi grubu varsa grup fiyatları devreye girer. */
export interface PricingContext {
  customerGroupId: string | null;
}

export interface PriceRequest {
  variantId: string;
  /** Varyantın perakende liste fiyatı */
  listPrice: MoneyInput;
  quantity: number;
}

/**
 * Birim fiyat çözücü. Birden çok varyant tek çağrıda çözülür; böylece grup
 * ve kademe fiyatları tek sorguyla okunur (listelemede N+1 olmaz).
 */
export interface PriceResolver {
  resolveUnitPrices(
    requests: readonly PriceRequest[],
    context: PricingContext,
  ): Promise<Map<string, Decimal>>;
}

/** Perakende: varyantın liste fiyatı. */
export class RetailPriceResolver implements PriceResolver {
  async resolveUnitPrices(
    requests: readonly PriceRequest[],
  ): Promise<Map<string, Decimal>> {
    return new Map(
      requests.map((request) => [
        request.variantId,
        toDecimal(request.listPrice),
      ]),
    );
  }
}

export interface TierPriceRecord {
  minQuantity: number;
  price: Decimal;
}

export interface PriceInputs {
  listPrice: Decimal;
  /** Bu gruba özel, varyant bazlı liste fiyatı */
  groupPrice: Decimal | null;
  /** Gruba tanımlı yüzde iskonto (0-100) */
  groupDiscountPercent: Decimal | null;
  /** Bu varyant için geçerli kademeler (gruba özel ve genel) */
  tiers: readonly TierPriceRecord[];
  quantity: number;
}

/**
 * Fiyat önceliği: varyanta özel grup fiyatı → grup iskontosu → liste fiyatı;
 * ardından adet kademesi uygulanır ve en düşük fiyat kazanır.
 */
export function computeUnitPrice(input: PriceInputs): Decimal {
  let base = input.listPrice;

  if (input.groupPrice) {
    base = input.groupPrice;
  } else if (input.groupDiscountPercent && input.groupDiscountPercent.gt(0)) {
    base = roundMoney(
      input.listPrice
        .times(toDecimal(100).minus(input.groupDiscountPercent))
        .dividedBy(100),
    );
  }

  const applicable = input.tiers
    .filter((tier) => tier.minQuantity <= input.quantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0];

  if (applicable && applicable.price.lt(base)) return applicable.price;
  return base;
}

/** Fiyat verisini okuyan sözleşme (Prisma uygulaması repository'dedir). */
export interface PricingRepository {
  groupPrices(
    groupId: string,
    variantIds: string[],
  ): Promise<Map<string, Decimal>>;
  groupDiscountPercent(groupId: string): Promise<Decimal | null>;
  /** Genel (grupsuz) ve verilen gruba özel kademeler. */
  tierPrices(
    variantIds: string[],
    groupId: string | null,
  ): Promise<Map<string, TierPriceRecord[]>>;
}

/** Bayi grubu fiyatlarını uygular; grup yoksa yalnızca genel kademeler geçerlidir. */
export class GroupPriceResolver implements PriceResolver {
  constructor(private readonly pricing: PricingRepository) {}

  async resolveUnitPrices(
    requests: readonly PriceRequest[],
    context: PricingContext,
  ): Promise<Map<string, Decimal>> {
    if (requests.length === 0) return new Map();

    const variantIds = requests.map((request) => request.variantId);
    const groupId = context.customerGroupId;

    const [groupPrices, discount, tiers] = await Promise.all([
      groupId
        ? this.pricing.groupPrices(groupId, variantIds)
        : Promise.resolve(new Map<string, Decimal>()),
      groupId
        ? this.pricing.groupDiscountPercent(groupId)
        : Promise.resolve(null),
      this.pricing.tierPrices(variantIds, groupId),
    ]);

    return new Map(
      requests.map((request) => [
        request.variantId,
        computeUnitPrice({
          listPrice: toDecimal(request.listPrice),
          groupPrice: groupPrices.get(request.variantId) ?? null,
          groupDiscountPercent: discount,
          tiers: tiers.get(request.variantId) ?? [],
          quantity: request.quantity,
        }),
      ]),
    );
  }
}
