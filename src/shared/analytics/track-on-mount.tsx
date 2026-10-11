"use client";

import { useEffect } from "react";
import { trackEvent } from "./client";
import type { AnalyticsEventName, AnalyticsEvents } from "./events";

/** Sayfa yüklendiğinde bir olay gönderir (örn. ürün görüntüleme). */
export function TrackOnMount<K extends AnalyticsEventName>({
  name,
  payload,
}: {
  name: K;
  payload: AnalyticsEvents[K];
}) {
  const serialized = JSON.stringify(payload);

  useEffect(() => {
    trackEvent(name, JSON.parse(serialized) as AnalyticsEvents[K]);
  }, [name, serialized]);

  return null;
}
