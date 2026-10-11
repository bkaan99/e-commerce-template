import type {
  AnalyticsAdapter,
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsEvents,
} from "./events";

export type ConsentState = "granted" | "denied" | "unknown";

/**
 * Olayları kayıtlı adapter'lara dağıtır. Çerez onayı verilmeden hiçbir
 * adapter'a olay gitmez; onaydan önceki olaylar atılır (kuyruğa alınmaz).
 */
export class AnalyticsDispatcher {
  private readonly adapters: AnalyticsAdapter[] = [];

  constructor(private readonly getConsent: () => ConsentState) {}

  register(adapter: AnalyticsAdapter): void {
    this.adapters.push(adapter);
  }

  track<K extends AnalyticsEventName>(
    name: K,
    payload: AnalyticsEvents[K],
  ): void {
    if (this.getConsent() !== "granted") return;

    const event = { name, payload } as AnalyticsEvent;
    for (const adapter of this.adapters) {
      try {
        adapter.track(event);
      } catch {
        // Bir izleme aracının hatası diğerlerini ve sayfayı etkilememeli.
      }
    }
  }
}
