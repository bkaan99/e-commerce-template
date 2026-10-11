"use client";

import { Ga4Adapter, MetaPixelAdapter } from "./adapters";
import { readConsent } from "./consent";
import { AnalyticsDispatcher } from "./dispatcher";
import type { AnalyticsEventName, AnalyticsEvents } from "./events";

let dispatcher: AnalyticsDispatcher | undefined;

function getDispatcher(): AnalyticsDispatcher {
  if (!dispatcher) {
    dispatcher = new AnalyticsDispatcher(readConsent);
    dispatcher.register(new Ga4Adapter());
    dispatcher.register(new MetaPixelAdapter());
  }
  return dispatcher;
}

/** Tarayıcıdan e-ticaret olayı gönderir. Çerez onayı yoksa hiçbir şey yapmaz. */
export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  payload: AnalyticsEvents[K],
): void {
  getDispatcher().track(name, payload);
}
