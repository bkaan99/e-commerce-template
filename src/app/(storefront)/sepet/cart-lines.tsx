"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Price } from "@/components/storefront/price";
import type { CartLine, CartView } from "@/modules/cart/cart.types";
import { removeCartItemAction, updateCartQuantityAction } from "./actions";

const ISSUE_TEXT: Record<NonNullable<CartLine["issue"]>, string> = {
  OUT_OF_STOCK: "Bu ürün tükendi. Satın almak için sepetten çıkarın.",
  QUANTITY_REDUCED: "Stok azaldı, adedi güncelleyin.",
  UNAVAILABLE: "Bu ürün artık satışta değil.",
};

function Line({ line, currency }: { line: CartLine; currency: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const max = Math.min(line.availableQuantity ?? 99, 99);

  function update(quantity: number) {
    startTransition(async () => {
      const result = await updateCartQuantityAction(line.variantId, quantity);
      setError(result.ok ? null : (result.error ?? "Güncellenemedi"));
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartItemAction(line.variantId);
    });
  }

  return (
    <li className="flex gap-4 border-b border-border py-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-theme bg-muted">
        <Image
          src={line.imageUrl ?? "/placeholder.svg"}
          alt={line.productName}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <Link href={`/urun/${line.productSlug}`} className="font-medium">
          {line.productName}
        </Link>
        {line.variantLabel ? (
          <span className="text-sm text-muted-foreground">
            {line.variantLabel}
          </span>
        ) : null}
        <Price value={line.unitPrice} currency={currency} />

        <div className="mt-2 flex items-center gap-3">
          <label className="sr-only" htmlFor={`qty-${line.variantId}`}>
            Adet
          </label>
          <input
            id={`qty-${line.variantId}`}
            type="number"
            min={1}
            max={max}
            defaultValue={line.quantity}
            disabled={pending || line.issue === "OUT_OF_STOCK"}
            onBlur={(event) => {
              const next = Math.floor(Number(event.target.value));
              if (next >= 1 && next !== line.quantity)
                update(Math.min(next, max));
            }}
            className="w-20 rounded-theme border border-border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-sm text-red-600 underline"
          >
            Kaldır
          </button>
        </div>

        {line.issue ? (
          <p role="alert" className="text-sm text-red-600">
            {ISSUE_TEXT[line.issue]}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <div className="font-semibold">
        <Price value={line.lineTotal} currency={currency} />
      </div>
    </li>
  );
}

export function CartLines({ cart }: { cart: CartView }) {
  return (
    <ul>
      {cart.lines.map((line) => (
        <Line key={line.variantId} line={line} currency={cart.currency} />
      ))}
    </ul>
  );
}
