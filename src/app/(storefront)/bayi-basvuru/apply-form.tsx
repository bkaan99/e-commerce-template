"use client";

import { useActionState } from "react";
import { applyDealerAction, type DealerApplyState } from "./actions";

const initial: DealerApplyState = {};
const input = "w-full rounded-theme border border-border px-3 py-2 text-sm";

export function DealerApplyForm() {
  const [state, formAction, pending] = useActionState(
    applyDealerAction,
    initial,
  );

  if (state.submitted) {
    return (
      <p
        role="status"
        className="rounded-theme bg-green-50 p-4 text-sm text-green-800"
      >
        Başvurunuz alındı. Değerlendirme sonucunu e-posta ile bildireceğiz.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Firma unvanı
        <input name="companyName" required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Vergi numarası (VKN)
        <input
          name="taxNumber"
          required
          inputMode="numeric"
          maxLength={10}
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Vergi dairesi
        <input name="taxOffice" required className={input} />
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
        {pending ? "Gönderiliyor..." : "Başvuruyu gönder"}
      </button>
    </form>
  );
}
