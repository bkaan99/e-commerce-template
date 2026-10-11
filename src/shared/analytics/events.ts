export interface AnalyticsItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  variant?: string | null;
  brand?: string | null;
  category?: string | null;
}

/** Tüm e-ticaret olayları ve veri sözleşmeleri. */
export interface AnalyticsEvents {
  view_item: { currency: string; value: number; item: AnalyticsItem };
  add_to_cart: { currency: string; value: number; item: AnalyticsItem };
  view_cart: { currency: string; value: number; items: AnalyticsItem[] };
  begin_checkout: { currency: string; value: number; items: AnalyticsItem[] };
  purchase: {
    transactionId: string;
    currency: string;
    value: number;
    items: AnalyticsItem[];
  };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

export interface AnalyticsEvent<
  K extends AnalyticsEventName = AnalyticsEventName,
> {
  name: K;
  payload: AnalyticsEvents[K];
}

/** Bir izleme aracı (GA4, Meta Pixel, ...) için adapter sözleşmesi. */
export interface AnalyticsAdapter {
  readonly name: string;
  track(event: AnalyticsEvent): void;
}
