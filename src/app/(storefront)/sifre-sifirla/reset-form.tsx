"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "./actions";

const initial: ResetState = {};
const input = "w-full rounded-theme border border-border px-3 py-2 text-sm";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initial,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
        Yeni parola
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Yeni parola (tekrar)
        <input
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={input}
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
        {pending ? "Kaydediliyor..." : "Parolayı güncelle"}
      </button>
    </form>
  );
}
