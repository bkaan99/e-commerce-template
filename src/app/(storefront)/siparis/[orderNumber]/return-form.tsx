"use client";

import { useState, useTransition } from "react";
import {
  RETURN_REASONS,
  type ReturnableItem,
} from "@/modules/returns/return.types";
import { requestReturnAction } from "./return-actions";

export function ReturnForm({
  orderNumber,
  lookupToken,
  items,
  deadline,
}: {
  orderNumber: string;
  lookupToken: string | null;
  items: ReturnableItem[];
  deadline: string | null;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const selected = items
    .map((item) => ({
      orderItemId: item.orderItemId,
      quantity: quantities[item.orderItemId] ?? 0,
    }))
    .filter((item) => item.quantity > 0);

  function submit() {
    startTransition(async () => {
      const result = await requestReturnAction(orderNumber, lookupToken, {
        items: selected,
        reason,
        note,
      });
      setMessage(
        result.ok
          ? {
              text: "İade talebiniz alındı. Sonucu e-posta ile bildireceğiz.",
              error: false,
            }
          : { text: result.error ?? "Talep oluşturulamadı", error: true },
      );
      if (result.ok) setQuantities({});
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-theme border border-border p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">İade talebi oluştur</h2>
        {deadline ? (
          <p className="text-sm text-muted-foreground">
            Son iade tarihi: {new Date(deadline).toLocaleDateString("tr-TR")}
          </p>
        ) : null}
      </header>

      <ul className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.orderItemId}
            className="flex items-center justify-between gap-4 py-2 text-sm"
          >
            <span>
              {item.productName}
              {item.variantName ? ` · ${item.variantName}` : ""}
              <span className="text-muted-foreground">
                {" "}
                (iade edilebilir: {item.requestableQuantity})
              </span>
            </span>
            <input
              type="number"
              min={0}
              max={item.requestableQuantity}
              disabled={item.requestableQuantity === 0}
              value={quantities[item.orderItemId] ?? 0}
              aria-label={`${item.productName} iade adedi`}
              onChange={(event) => {
                const value = Math.floor(Number(event.target.value)) || 0;
                setQuantities((current) => ({
                  ...current,
                  [item.orderItemId]: Math.min(
                    Math.max(0, value),
                    item.requestableQuantity,
                  ),
                }));
              }}
              className="w-20 rounded-theme border border-border px-2 py-1"
            />
          </li>
        ))}
      </ul>

      <label className="flex flex-col gap-1 text-sm">
        İade nedeni
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="rounded-theme border border-border px-3 py-2"
        >
          {RETURN_REASONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Açıklama (isteğe bağlı)
        <textarea
          value={note}
          maxLength={500}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          className="rounded-theme border border-border px-3 py-2"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={pending || selected.length === 0}
        className="w-fit rounded-theme bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Gönderiliyor..." : "İade talebi gönder"}
      </button>

      {message ? (
        <p
          role={message.error ? "alert" : "status"}
          className={
            message.error ? "text-sm text-red-600" : "text-sm text-green-700"
          }
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
