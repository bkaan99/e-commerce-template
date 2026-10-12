/**
 * Domain olayları. Yeni olay tipleri bu haritaya eklenir; böylece yayıncı ve
 * dinleyici arasındaki veri sözleşmesi tip güvenli kalır.
 */
export interface DomainEvents {
  "order.paid": { orderId: string };
  /** Havale/EFT veya vadeli ödemeyle oluşan, kart tahsilatı olmayan sipariş */
  "order.placed": { orderId: string; method: "BANK_TRANSFER" | "DEFERRED" };
  "order.shipped": { orderId: string; trackingNumber: string | null };
  "order.cancelled": { orderId: string; refunded: boolean };
  "stock.replenished": { variantId: string };
}

export type DomainEventName = keyof DomainEvents;
export type DomainEventHandler<K extends DomainEventName> = (
  payload: DomainEvents[K],
) => Promise<void> | void;

export interface EventBus {
  publish<K extends DomainEventName>(
    name: K,
    payload: DomainEvents[K],
  ): Promise<void>;
  subscribe<K extends DomainEventName>(
    name: K,
    handler: DomainEventHandler<K>,
  ): void;
}

/** Aynı süreç içinde çalışan basit olay yolu. */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<
    DomainEventName,
    DomainEventHandler<never>[]
  >();

  subscribe<K extends DomainEventName>(
    name: K,
    handler: DomainEventHandler<K>,
  ): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as DomainEventHandler<never>);
    this.handlers.set(name, list);
  }

  async publish<K extends DomainEventName>(
    name: K,
    payload: DomainEvents[K],
  ): Promise<void> {
    for (const handler of this.handlers.get(name) ?? []) {
      await (handler as DomainEventHandler<K>)(payload);
    }
  }
}
