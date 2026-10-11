"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ForgotState } from "./actions";

const initial: ForgotState = {};

export function ForgotForm({ captcha }: { captcha?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initial,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-posta
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-theme border border-border px-3 py-2"
        />
      </label>
      {captcha}
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-green-700">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-theme bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Gönderiliyor..." : "Sıfırlama bağlantısı gönder"}
      </button>
    </form>
  );
}
