"use client";

import { useActionState } from "react";
import { lookupOrderAction, type LookupState } from "./actions";

const initial: LookupState = {};

export function LookupForm() {
  const [state, formAction, pending] = useActionState(
    lookupOrderAction,
    initial,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Sipariş numarası
        <input
          name="orderNumber"
          required
          className="rounded-theme border border-border px-3 py-2 uppercase"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        E-posta
        <input
          name="email"
          type="email"
          required
          className="rounded-theme border border-border px-3 py-2"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-theme bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Sorgulanıyor..." : "Siparişi sorgula"}
      </button>
    </form>
  );
}
