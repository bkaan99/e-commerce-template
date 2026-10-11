"use client";

import { useActionState, useState } from "react";
import { TURKEY_PROVINCES } from "@/shared/geo/turkey-provinces";
import { placeOrderAction, type CheckoutFormState } from "./actions";

const initial: CheckoutFormState = {};

const inputClass =
  "w-full rounded-theme border border-border px-3 py-2 text-sm";

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: Record<string, string>;
  children: React.ReactNode;
}) {
  const error = errors?.[name];

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function AddressFields({
  prefix,
  errors,
  defaultInvoiceType = "INDIVIDUAL",
}: {
  prefix: "shipping" | "billing";
  errors?: Record<string, string>;
  defaultInvoiceType?: "INDIVIDUAL" | "CORPORATE";
}) {
  const [invoiceType, setInvoiceType] = useState(defaultInvoiceType);
  const name = (field: string) => `${prefix}.${field}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Ad" name={name("firstName")} errors={errors}>
        <input
          name={name("firstName")}
          required
          autoComplete="given-name"
          className={inputClass}
        />
      </Field>
      <Field label="Soyad" name={name("lastName")} errors={errors}>
        <input
          name={name("lastName")}
          required
          autoComplete="family-name"
          className={inputClass}
        />
      </Field>
      <Field label="Cep telefonu" name={name("phone")} errors={errors}>
        <input
          name={name("phone")}
          type="tel"
          required
          autoComplete="tel"
          placeholder="05XX XXX XX XX"
          className={inputClass}
        />
      </Field>
      <Field label="İl" name={name("city")} errors={errors}>
        <select
          name={name("city")}
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            İl seçin
          </option>
          {TURKEY_PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </Field>
      <Field label="İlçe" name={name("district")} errors={errors}>
        <input name={name("district")} required className={inputClass} />
      </Field>
      <Field label="Mahalle" name={name("neighborhood")} errors={errors}>
        <input name={name("neighborhood")} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Açık adres" name={name("addressLine")} errors={errors}>
          <textarea
            name={name("addressLine")}
            required
            rows={3}
            autoComplete="street-address"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Posta kodu" name={name("postalCode")} errors={errors}>
        <input
          name={name("postalCode")}
          autoComplete="postal-code"
          className={inputClass}
        />
      </Field>

      <fieldset className="flex items-center gap-4 text-sm sm:col-span-2">
        <legend className="sr-only">Fatura tipi</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={name("invoiceType")}
            value="INDIVIDUAL"
            checked={invoiceType === "INDIVIDUAL"}
            onChange={() => setInvoiceType("INDIVIDUAL")}
          />
          Bireysel
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={name("invoiceType")}
            value="CORPORATE"
            checked={invoiceType === "CORPORATE"}
            onChange={() => setInvoiceType("CORPORATE")}
          />
          Kurumsal
        </label>
      </fieldset>

      {invoiceType === "INDIVIDUAL" ? (
        <Field
          label="T.C. kimlik no (isteğe bağlı)"
          name={name("nationalId")}
          errors={errors}
        >
          <input
            name={name("nationalId")}
            inputMode="numeric"
            maxLength={11}
            className={inputClass}
          />
        </Field>
      ) : (
        <>
          <Field
            label="Firma unvanı"
            name={name("companyName")}
            errors={errors}
          >
            <input name={name("companyName")} className={inputClass} />
          </Field>
          <Field
            label="Vergi numarası"
            name={name("taxNumber")}
            errors={errors}
          >
            <input
              name={name("taxNumber")}
              inputMode="numeric"
              maxLength={10}
              className={inputClass}
            />
          </Field>
          <Field label="Vergi dairesi" name={name("taxOffice")} errors={errors}>
            <input name={name("taxOffice")} className={inputClass} />
          </Field>
        </>
      )}
    </div>
  );
}

export function CheckoutForm({
  defaultEmail,
  defaultCoupon,
}: {
  defaultEmail: string;
  defaultCoupon: string;
}) {
  const [state, formAction, pending] = useActionState(
    placeOrderAction,
    initial,
  );
  const [sameBilling, setSameBilling] = useState(true);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.message ? (
        <p
          role="alert"
          className="rounded-theme border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {state.message}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">İletişim</h2>
        <Field label="E-posta" name="email" errors={errors}>
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            autoComplete="email"
            className={inputClass}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Teslimat adresi</h2>
        <AddressFields prefix="shipping" errors={errors} />
      </section>

      <section className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="sameBilling"
            checked={sameBilling}
            onChange={(event) => setSameBilling(event.target.checked)}
          />
          Fatura adresim teslimat adresimle aynı
        </label>
        {!sameBilling ? (
          <>
            <h2 className="text-lg font-semibold">Fatura adresi</h2>
            <AddressFields prefix="billing" errors={errors} />
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Sipariş</h2>
        <Field label="Kupon kodu" name="couponCode" errors={errors}>
          <input
            name="couponCode"
            defaultValue={defaultCoupon}
            className={`${inputClass} uppercase`}
          />
        </Field>
        <Field
          label="Sipariş notu (isteğe bağlı)"
          name="customerNote"
          errors={errors}
        >
          <textarea
            name="customerNote"
            rows={2}
            maxLength={500}
            className={inputClass}
          />
        </Field>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-1" />
        <span>
          Ön bilgilendirme formunu ve mesafeli satış sözleşmesini okudum,
          onaylıyorum.
        </span>
      </label>
      {errors?.["acceptTerms"] ? (
        <p role="alert" className="text-xs text-red-600">
          {errors["acceptTerms"]}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-theme bg-primary px-6 py-3 text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Sipariş oluşturuluyor..." : "Ödemeye geç"}
      </button>
    </form>
  );
}
