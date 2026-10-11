"use client";

import { useSyncExternalStore } from "react";
import { readConsent, subscribeConsent, writeConsent } from "./consent";
import type { ConsentState } from "./dispatcher";

function useConsent(): ConsentState {
  // Sunucuda "granted" varsayılır; banner yalnızca istemcide, tercih yoksa görünür.
  return useSyncExternalStore(subscribeConsent, readConsent, () => "granted");
}

export function CookieBanner() {
  const consent = useConsent();
  if (consent !== "unknown") return null;

  return (
    <div
      role="dialog"
      aria-label="Çerez tercihleri"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          Deneyiminizi iyileştirmek ve ölçümleme yapmak için çerezler
          kullanıyoruz. Zorunlu olmayan çerezleri kabul edebilir veya
          reddedebilirsiniz.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => writeConsent("denied")}
            className="whitespace-nowrap rounded-theme border border-border px-4 py-2 text-sm"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={() => writeConsent("granted")}
            className="whitespace-nowrap rounded-theme bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Kabul et
          </button>
        </div>
      </div>
    </div>
  );
}
