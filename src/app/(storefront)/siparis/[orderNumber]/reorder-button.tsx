"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reorderAction } from "./reorder-actions";

export function ReorderButton({
  orderNumber,
  lookupToken,
}: {
  orderNumber: string;
  lookupToken: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reorder() {
    startTransition(async () => {
      const result = await reorderAction(orderNumber, lookupToken);
      if (!result.ok) {
        setError(result.error ?? "İşlem başarısız");
        return;
      }

      setError(null);
      const skipped = result.skipped ?? [];
      setNotes(skipped.map((item) => `${item.productName}: ${item.reason}`));
      if ((result.added ?? 0) > 0 && skipped.length === 0)
        router.push("/sepet");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={reorder}
        disabled={pending}
        className="w-fit rounded-theme border border-border px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Ekleniyor..." : "Tekrar sipariş ver"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {notes.length > 0 ? (
        <div role="status" className="text-sm">
          <p>Bazı ürünler sepete eklenemedi:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <a href="/sepet" className="underline">
            Sepete git
          </a>
        </div>
      ) : null}
    </div>
  );
}
