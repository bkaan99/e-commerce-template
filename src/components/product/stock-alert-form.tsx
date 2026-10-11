"use client";

import { useState, useTransition } from "react";
import { subscribeStockAlertAction } from "@/app/(storefront)/urun/[slug]/actions";

export function StockAlertForm({ variantId }: { variantId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function submit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    startTransition(async () => {
      const result = await subscribeStockAlertAction(variantId, email);
      setMessage(
        result.ok
          ? { text: "Stoğa girince size e-posta göndereceğiz.", error: false }
          : { text: result.error ?? "Kayıt yapılamadı", error: true },
      );
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-2 rounded-theme border border-border p-3"
    >
      <p className="text-sm font-medium">Stoğa girince haber ver</p>
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="E-posta adresiniz"
          aria-label="E-posta adresiniz"
          className="min-w-0 flex-1 rounded-theme border border-border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded-theme bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Kaydediliyor..." : "Haber ver"}
        </button>
      </div>
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
    </form>
  );
}
