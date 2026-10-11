"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { trackEvent } from "@/shared/analytics/client";
import { cancelOrderAction } from "./actions";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

/** Ödeme bildirimi gecikirse sayfayı birkaç kez yeniler. */
export function OrderStatusPoller() {
  const router = useRouter();

  useEffect(() => {
    let polls = 0;
    const timer = window.setInterval(() => {
      polls += 1;
      router.refresh();
      if (polls >= MAX_POLLS) window.clearInterval(timer);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <p role="status" className="text-sm text-muted-foreground">
      Ödemeniz doğrulanıyor, lütfen bekleyin...
    </p>
  );
}

export function CancelOrderButton({
  orderNumber,
  lookupToken,
  paid,
}: {
  orderNumber: string;
  lookupToken: string | null;
  paid: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    const message = paid
      ? "Siparişi iptal etmek istiyor musunuz? Ödemeniz iade edilecek."
      : "Siparişi iptal etmek istiyor musunuz?";
    if (!window.confirm(message)) return;

    startTransition(async () => {
      const result = await cancelOrderAction(orderNumber, lookupToken);
      setError(result.ok ? null : (result.error ?? "İptal edilemedi"));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="w-fit rounded-theme border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-60"
      >
        {pending ? "İptal ediliyor..." : "Siparişi iptal et"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Başarılı siparişte `purchase` olayını oturum başına bir kez gönderir. */
export function PurchaseTracker({
  orderNumber,
  currency,
  value,
  items,
}: {
  orderNumber: string;
  currency: string;
  value: number;
  items: { id: string; name: string; price: number; quantity: number }[];
}) {
  const itemsKey = JSON.stringify(items);

  useEffect(() => {
    const storageKey = `purchase-tracked:${orderNumber}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Depolama kapalıysa olay yine de bir kez gönderilir.
    }

    trackEvent("purchase", {
      transactionId: orderNumber,
      currency,
      value,
      items: JSON.parse(itemsKey) as typeof items,
    });
  }, [orderNumber, currency, value, itemsKey]);

  return null;
}
