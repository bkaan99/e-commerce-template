import type { AnalyticsAdapter, AnalyticsEvent, AnalyticsItem } from "./events";

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
  }
}

function ga4Item(item: AnalyticsItem): Record<string, unknown> {
  return {
    item_id: item.id,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity ?? 1,
    item_variant: item.variant ?? undefined,
    item_brand: item.brand ?? undefined,
    item_category: item.category ?? undefined,
  };
}

/** Olayı GA4 `gtag` çağrısına çevirir. Saf fonksiyon, test edilebilir. */
export function toGa4Call(event: AnalyticsEvent): {
  name: string;
  params: Record<string, unknown>;
} {
  switch (event.name) {
    case "view_item":
    case "add_to_cart": {
      const payload = event.payload as {
        currency: string;
        value: number;
        item: AnalyticsItem;
      };
      return {
        name: event.name,
        params: {
          currency: payload.currency,
          value: payload.value,
          items: [ga4Item(payload.item)],
        },
      };
    }
    case "purchase": {
      const payload = event.payload as {
        transactionId: string;
        currency: string;
        value: number;
        items: AnalyticsItem[];
      };
      return {
        name: "purchase",
        params: {
          transaction_id: payload.transactionId,
          currency: payload.currency,
          value: payload.value,
          items: payload.items.map(ga4Item),
        },
      };
    }
    default: {
      const payload = event.payload as {
        currency: string;
        value: number;
        items: AnalyticsItem[];
      };
      return {
        name: event.name,
        params: {
          currency: payload.currency,
          value: payload.value,
          items: payload.items.map(ga4Item),
        },
      };
    }
  }
}

/** Olayı Meta Pixel standart olayına çevirir; karşılığı yoksa null. */
export function toMetaCall(
  event: AnalyticsEvent,
): { name: string; params: Record<string, unknown> } | null {
  const base = (currency: string, value: number) => ({ currency, value });

  switch (event.name) {
    case "view_item": {
      const { currency, value, item } = event.payload as {
        currency: string;
        value: number;
        item: AnalyticsItem;
      };
      return {
        name: "ViewContent",
        params: {
          ...base(currency, value),
          content_ids: [item.id],
          content_name: item.name,
          content_type: "product",
        },
      };
    }
    case "add_to_cart": {
      const { currency, value, item } = event.payload as {
        currency: string;
        value: number;
        item: AnalyticsItem;
      };
      return {
        name: "AddToCart",
        params: {
          ...base(currency, value),
          content_ids: [item.id],
          content_type: "product",
        },
      };
    }
    case "begin_checkout": {
      const { currency, value, items } = event.payload as {
        currency: string;
        value: number;
        items: AnalyticsItem[];
      };
      return {
        name: "InitiateCheckout",
        params: { ...base(currency, value), num_items: items.length },
      };
    }
    case "purchase": {
      const { currency, value, items } = event.payload as {
        currency: string;
        value: number;
        items: AnalyticsItem[];
      };
      return {
        name: "Purchase",
        params: {
          ...base(currency, value),
          content_ids: items.map((i) => i.id),
          content_type: "product",
        },
      };
    }
    default:
      return null;
  }
}

export class Ga4Adapter implements AnalyticsAdapter {
  readonly name = "ga4";

  track(event: AnalyticsEvent): void {
    if (typeof window === "undefined" || !window.gtag) return;
    const call = toGa4Call(event);
    window.gtag("event", call.name, call.params);
  }
}

export class MetaPixelAdapter implements AnalyticsAdapter {
  readonly name = "meta-pixel";

  track(event: AnalyticsEvent): void {
    if (typeof window === "undefined" || !window.fbq) return;
    const call = toMetaCall(event);
    if (call) window.fbq("track", call.name, call.params);
  }
}
