"use client";

import { useState, useTransition } from "react";
import { districtsOf } from "@/shared/geo/turkey-districts";
import { TURKEY_PROVINCES } from "@/shared/geo/turkey-provinces";
import { deleteAddressAction, saveAddressAction } from "../actions";

export interface AddressView {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  district: string;
  neighborhood: string | null;
  addressLine: string;
  postalCode: string | null;
  invoiceType: "INDIVIDUAL" | "CORPORATE";
  nationalId: string | null;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

interface FormState {
  id: string | null;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  district: string;
  neighborhood: string;
  addressLine: string;
  postalCode: string;
  invoiceType: "INDIVIDUAL" | "CORPORATE";
  nationalId: string;
  companyName: string;
  taxNumber: string;
  taxOffice: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

const blank: FormState = {
  id: null,
  title: "",
  firstName: "",
  lastName: "",
  phone: "",
  city: "",
  district: "",
  neighborhood: "",
  addressLine: "",
  postalCode: "",
  invoiceType: "INDIVIDUAL",
  nationalId: "",
  companyName: "",
  taxNumber: "",
  taxOffice: "",
  isDefaultShipping: false,
  isDefaultBilling: false,
};

const input = "w-full rounded-theme border border-border px-3 py-2 text-sm";

function toForm(address: AddressView): FormState {
  return {
    id: address.id,
    title: address.title,
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    city: address.city,
    district: address.district,
    neighborhood: address.neighborhood ?? "",
    addressLine: address.addressLine,
    postalCode: address.postalCode ?? "",
    invoiceType: address.invoiceType,
    nationalId: address.nationalId ?? "",
    companyName: address.companyName ?? "",
    taxNumber: address.taxNumber ?? "",
    taxOffice: address.taxOffice ?? "",
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
  };
}

export function AddressManager({ addresses }: { addresses: AddressView[] }) {
  const [form, setForm] = useState<FormState>(blank);
  const [open, setOpen] = useState(addresses.length === 0);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function save() {
    startTransition(async () => {
      const { id, ...payload } = form;
      const result = await saveAddressAction(id, payload);
      if (result.ok) {
        setMessage({ text: "Adres kaydedildi", error: false });
        setForm(blank);
        setOpen(false);
      } else {
        setMessage({ text: result.error ?? "Kaydedilemedi", error: true });
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Adres silinsin mi?")) return;
    startTransition(async () => {
      const result = await deleteAddressAction(id);
      setMessage(
        result.ok
          ? { text: "Adres silindi", error: false }
          : { text: result.error ?? "Silinemedi", error: true },
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-2">
        {addresses.map((address) => (
          <li
            key={address.id}
            className="flex flex-col gap-2 rounded-theme border border-border p-4 text-sm"
          >
            <div className="flex items-center justify-between">
              <strong>{address.title}</strong>
              <span className="text-xs text-muted-foreground">
                {[
                  address.isDefaultShipping && "Varsayılan teslimat",
                  address.isDefaultBilling && "Varsayılan fatura",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <p>
              {address.firstName} {address.lastName} · {address.phone}
            </p>
            <p className="text-muted-foreground">
              {address.addressLine}
              {address.neighborhood ? `, ${address.neighborhood}` : ""}{" "}
              {address.district}/{address.city}
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setForm(toForm(address));
                  setOpen(true);
                }}
              >
                Düzenle
              </button>
              <button
                type="button"
                className="text-red-600 underline"
                disabled={pending}
                onClick={() => remove(address.id)}
              >
                Sil
              </button>
            </div>
          </li>
        ))}
      </ul>

      {message ? (
        <p
          role={message.error ? "alert" : "status"}
          className={
            message.error ? "text-sm text-red-600" : "text-sm text-green-700"
          }
        >
          {message.text}
        </p>
      ) : null}

      {open ? (
        <section className="flex flex-col gap-4 rounded-theme border border-border p-5">
          <h2 className="text-lg font-semibold">
            {form.id ? "Adresi düzenle" : "Yeni adres"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Adres başlığı (Ev, İş…)
              <input
                className={input}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Ad
              <input
                className={input}
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Soyad
              <input
                className={input}
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Cep telefonu
              <input
                className={input}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              İl
              <select
                className={input}
                value={form.city}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    city: e.target.value,
                    district: "",
                  }))
                }
              >
                <option value="">Seçin</option>
                {TURKEY_PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              İlçe
              <select
                className={input}
                value={form.district}
                disabled={!form.city}
                onChange={(e) => set("district", e.target.value)}
              >
                <option value="">
                  {form.city ? "Seçin" : "Önce il seçin"}
                </option>
                {districtsOf(form.city).map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mahalle
              <input
                className={input}
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Açık adres
              <textarea
                className={input}
                rows={3}
                value={form.addressLine}
                onChange={(e) => set("addressLine", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Posta kodu
              <input
                className={input}
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Fatura tipi
              <select
                className={input}
                value={form.invoiceType}
                onChange={(e) =>
                  set("invoiceType", e.target.value as FormState["invoiceType"])
                }
              >
                <option value="INDIVIDUAL">Bireysel</option>
                <option value="CORPORATE">Kurumsal</option>
              </select>
            </label>
            {form.invoiceType === "INDIVIDUAL" ? (
              <label className="flex flex-col gap-1 text-sm">
                T.C. kimlik no (isteğe bağlı)
                <input
                  className={input}
                  value={form.nationalId}
                  maxLength={11}
                  onChange={(e) => set("nationalId", e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Firma unvanı
                  <input
                    className={input}
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Vergi numarası
                  <input
                    className={input}
                    value={form.taxNumber}
                    maxLength={10}
                    onChange={(e) => set("taxNumber", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Vergi dairesi
                  <input
                    className={input}
                    value={form.taxOffice}
                    onChange={(e) => set("taxOffice", e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isDefaultShipping}
                onChange={(e) => set("isDefaultShipping", e.target.checked)}
              />
              Varsayılan teslimat adresi
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isDefaultBilling}
                onChange={(e) => set("isDefaultBilling", e.target.checked)}
              />
              Varsayılan fatura adresi
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="rounded-theme bg-primary px-5 py-2 text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              type="button"
              className="rounded-theme border border-border px-5 py-2"
              onClick={() => {
                setForm(blank);
                setOpen(false);
              }}
            >
              Vazgeç
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="w-fit rounded-theme border border-border px-4 py-2 text-sm"
          onClick={() => {
            setForm(blank);
            setOpen(true);
          }}
        >
          Yeni adres ekle
        </button>
      )}
    </div>
  );
}
