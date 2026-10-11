"use client";

import { useActionState } from "react";
import { registerAction, type RegisterState } from "./actions";

const initial: RegisterState = {};
const input = "w-full rounded-theme border border-border px-3 py-2 text-sm";

export function RegisterForm({ captcha }: { captcha?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Ad
          <input
            name="firstName"
            required
            autoComplete="given-name"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Soyad
          <input
            name="lastName"
            required
            autoComplete="family-name"
            className={input}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        E-posta
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Cep telefonu (isteğe bağlı)
        <input name="phone" type="tel" autoComplete="tel" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Parola
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={input}
        />
        <span className="text-xs text-muted-foreground">
          En az 10 karakter, harf ve rakam içermeli.
        </span>
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
        {pending ? "Kaydediliyor..." : "Kayıt ol"}
      </button>
    </form>
  );
}
