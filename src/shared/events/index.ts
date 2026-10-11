import "server-only";
import { InMemoryEventBus, type EventBus } from "./event-bus";

export type { DomainEvents, EventBus } from "./event-bus";

const globalForBus = globalThis as unknown as { eventBus?: EventBus };

/** Süreç genelinde tek olay yolu. Aboneler ilgili modül container'larında bağlanır. */
export function getEventBus(): EventBus {
  globalForBus.eventBus ??= new InMemoryEventBus();
  return globalForBus.eventBus;
}
