"use client";

import { useState, useTransition } from "react";
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
} from "../actions";

const input = "w-full rounded-theme border border-border px-3 py-2 text-sm";

function useAction() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    successText: string,
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { text: successText, error: false }
          : { text: result.error ?? "İşlem başarısız", error: true },
      );
      if (result.ok) onSuccess?.();
    });
  }

  return { pending, message, run };
}

function Message({
  message,
}: {
  message: { text: string; error: boolean } | null;
}) {
  if (!message) return null;
  return (
    <p
      role={message.error ? "alert" : "status"}
      className={
        message.error ? "text-sm text-red-600" : "text-sm text-green-700"
      }
    >
      {message.text}
    </p>
  );
}

export function ProfileForm({
  firstName,
  lastName,
  phone,
  email,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}) {
  const [values, setValues] = useState({ firstName, lastName, phone });
  const { pending, message, run } = useAction();

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => updateProfileAction(values), "Bilgileriniz güncellendi");
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        E-posta
        <input
          className={`${input} bg-muted`}
          value={email}
          disabled
          readOnly
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Ad
          <input
            className={input}
            value={values.firstName}
            onChange={(e) =>
              setValues({ ...values, firstName: e.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Soyad
          <input
            className={input}
            value={values.lastName}
            onChange={(e) => setValues({ ...values, lastName: e.target.value })}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Cep telefonu
        <input
          className={input}
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-theme bg-primary px-5 py-2 text-primary-foreground disabled:opacity-60"
      >
        Kaydet
      </button>
      <Message message={message} />
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { pending, message, run } = useAction();

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (next !== confirm) return;
        run(
          () => changePasswordAction(current, next),
          "Parolanız değiştirildi",
          () => {
            setCurrent("");
            setNext("");
            setConfirm("");
          },
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Mevcut parola
        <input
          type="password"
          autoComplete="current-password"
          className={input}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Yeni parola
        <input
          type="password"
          autoComplete="new-password"
          className={input}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Yeni parola (tekrar)
        <input
          type="password"
          autoComplete="new-password"
          className={input}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {next && confirm && next !== confirm ? (
        <p role="alert" className="text-sm text-red-600">
          Parolalar eşleşmiyor
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !current || !next || next !== confirm}
        className="w-fit rounded-theme bg-primary px-5 py-2 text-primary-foreground disabled:opacity-60"
      >
        Parolayı değiştir
      </button>
      <Message message={message} />
    </form>
  );
}

export function DeleteAccountForm() {
  const [password, setPassword] = useState("");
  const { pending, message, run } = useAction();

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !window.confirm(
            "Hesabınız kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?",
          )
        ) {
          return;
        }
        run(() => deleteAccountAction(password), "Hesabınız silindi");
      }}
    >
      <p className="text-sm text-muted-foreground">
        Hesabınız ve kişisel verileriniz (adresler, favoriler, bildirim
        kayıtları) silinir. Yasal saklama yükümlülüğü gereği sipariş ve fatura
        kayıtları saklanmaya devam eder. Tamamlanmamış siparişiniz varsa hesap
        silinemez.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Onay için parolanız
        <input
          type="password"
          autoComplete="current-password"
          className={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending || !password}
        className="w-fit rounded-theme bg-red-600 px-5 py-2 text-white disabled:opacity-60"
      >
        Hesabımı sil
      </button>
      <Message message={message} />
    </form>
  );
}
