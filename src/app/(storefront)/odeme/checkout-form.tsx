"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { SavedAddress } from "@/modules/account/address.repository";
import { districtsOf } from "@/shared/geo/turkey-districts";
import { TURKEY_PROVINCES } from "@/shared/geo/turkey-provinces";
import type { PaymentOption } from "@/modules/checkout/checkout.service";
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
  saved,
}: {
  prefix: "shipping" | "billing";
  errors?: Record<string, string>;
  saved?: SavedAddress;
}) {
  const [invoiceType, setInvoiceType] = useState(
    saved?.invoiceType ?? "INDIVIDUAL",
  );
  const [city, setCity] = useState(saved?.city ?? "");
  const districts = districtsOf(city);
  const name = (field: string) => `${prefix}.${field}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Ad" name={name("firstName")} errors={errors}>
        <input
          name={name("firstName")}
          defaultValue={saved?.firstName}
          required
          autoComplete="given-name"
          className={inputClass}
        />
      </Field>
      <Field label="Soyad" name={name("lastName")} errors={errors}>
        <input
          name={name("lastName")}
          defaultValue={saved?.lastName}
          required
          autoComplete="family-name"
          className={inputClass}
        />
      </Field>
      <Field label="Cep telefonu" name={name("phone")} errors={errors}>
        <input
          name={name("phone")}
          type="tel"
          defaultValue={saved?.phone}
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
          value={city}
          onChange={(event) => setCity(event.target.value)}
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
        <select
          key={city}
          name={name("district")}
          required
          defaultValue={
            city === saved?.city && districts.includes(saved?.district ?? "")
              ? saved?.district
              : ""
          }
          disabled={districts.length === 0}
          className={inputClass}
        >
          <option value="" disabled>
            {city ? "İlçe seçin" : "Önce il seçin"}
          </option>
          {districts.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Mahalle" name={name("neighborhood")} errors={errors}>
        <input
          name={name("neighborhood")}
          defaultValue={saved?.neighborhood ?? ""}
          className={inputClass}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Açık adres" name={name("addressLine")} errors={errors}>
          <textarea
            name={name("addressLine")}
            defaultValue={saved?.addressLine}
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
          defaultValue={saved?.postalCode ?? ""}
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
            defaultValue={saved?.nationalId ?? ""}
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
            <input
              name={name("companyName")}
              defaultValue={saved?.companyName ?? ""}
              className={inputClass}
            />
          </Field>
          <Field
            label="Vergi numarası"
            name={name("taxNumber")}
            errors={errors}
          >
            <input
              name={name("taxNumber")}
              defaultValue={saved?.taxNumber ?? ""}
              inputMode="numeric"
              maxLength={10}
              className={inputClass}
            />
          </Field>
          <Field label="Vergi dairesi" name={name("taxOffice")} errors={errors}>
            <input
              name={name("taxOffice")}
              defaultValue={saved?.taxOffice ?? ""}
              className={inputClass}
            />
          </Field>
        </>
      )}
    </div>
  );
}

/** Kayıtlı adres seçimi; seçim alanları yeniden oluşturarak değerleri doldurur. */
function AddressSection({
  prefix,
  addresses,
  errors,
  initialId,
}: {
  prefix: "shipping" | "billing";
  addresses: SavedAddress[];
  errors?: Record<string, string>;
  initialId?: string;
}) {
  const [selectedId, setSelectedId] = useState(initialId ?? "");
  const selected = addresses.find((address) => address.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      {addresses.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm">
          <span>Kayıtlı adreslerim</span>
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className={inputClass}
          >
            <option value="">Yeni adres gir</option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.title} — {address.district}/{address.city}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <AddressFields
        key={selectedId || "new"}
        prefix={prefix}
        errors={errors}
        saved={selected}
      />
    </div>
  );
}

const METHOD_LABELS: Record<PaymentOption["method"], string> = {
  CARD: "Kredi/banka kartı",
  BANK_TRANSFER: "Havale / EFT",
  DEFERRED: "Vadeli ödeme (cari hesap)",
};

export function CheckoutForm({
  defaultEmail,
  defaultCoupon,
  paymentOptions,
  savedAddresses,
  legalLinks,
}: {
  defaultEmail: string;
  defaultCoupon: string;
  paymentOptions: PaymentOption[];
  savedAddresses: SavedAddress[];
  legalLinks: { slug: string; title: string; href: string }[];
}) {
  const defaultShipping = savedAddresses.find((a) => a.isDefaultShipping);
  const defaultBilling = savedAddresses.find((a) => a.isDefaultBilling);
  const preInfo = legalLinks.find((l) => l.slug === "on-bilgilendirme-formu");
  const salesContract = legalLinks.find(
    (l) => l.slug === "mesafeli-satis-sozlesmesi",
  );
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
        <AddressSection
          prefix="shipping"
          addresses={savedAddresses}
          errors={errors}
          initialId={defaultShipping?.id}
        />
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
            <AddressSection
              prefix="billing"
              addresses={savedAddresses}
              errors={errors}
              initialId={defaultBilling?.id}
            />
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

      {paymentOptions.length > 1 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Ödeme yöntemi</h2>
          {paymentOptions.map((option, index) => (
            <label
              key={option.method}
              className={`flex items-start gap-3 rounded-theme border border-border p-3 text-sm ${
                option.available ? "" : "opacity-60"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option.method}
                defaultChecked={index === 0}
                disabled={!option.available}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="font-medium">
                  {METHOD_LABELS[option.method]}
                </span>
                {option.note ? (
                  <span className="text-muted-foreground">{option.note}</span>
                ) : null}
              </span>
            </label>
          ))}
        </section>
      ) : (
        <input type="hidden" name="paymentMethod" value="CARD" />
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-1" />
        <span>
          {preInfo ? (
            <Link href={preInfo.href} target="_blank" className="underline">
              Ön bilgilendirme formunu
            </Link>
          ) : (
            "Ön bilgilendirme formunu"
          )}{" "}
          ve{" "}
          {salesContract ? (
            <Link
              href={salesContract.href}
              target="_blank"
              className="underline"
            >
              mesafeli satış sözleşmesini
            </Link>
          ) : (
            "mesafeli satış sözleşmesini"
          )}{" "}
          okudum, onaylıyorum.
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
