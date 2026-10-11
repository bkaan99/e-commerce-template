"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({
  callbackUrl,
  captcha,
}: {
  callbackUrl: string;
  captcha?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
      <label className="flex flex-col gap-1 text-sm">
        Parola
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-theme border border-border px-3 py-2"
        />
      </label>
      {captcha}
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
        {pending ? "Giriş yapılıyor..." : "Giriş yap"}
      </button>
    </form>
  );
}
