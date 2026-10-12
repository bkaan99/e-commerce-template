import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Price } from "@/components/storefront/price";
import { TrackOnMount } from "@/shared/analytics/track-on-mount";
import { getCurrentUser } from "@/modules/auth/session";
import { getCartIdentity } from "@/modules/cart/cart.session";
import { getAddressService } from "@/modules/account/container";
import { getCachedLegalLinks } from "@/modules/content/cached";
import { getCheckoutService } from "@/modules/orders/container";
import { isAppError } from "@/shared/errors";
import type { PaymentOption } from "@/modules/checkout/checkout.service";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Ödeme",
  robots: { index: false },
};

async function CheckoutContent({
  searchParams,
}: Pick<PageProps<"/odeme">, "searchParams">) {
  const params = await searchParams;
  const coupon = typeof params["kupon"] === "string" ? params["kupon"] : "";

  const [user, identity] = await Promise.all([
    getCurrentUser(),
    getCartIdentity(),
  ]);

  const [savedAddresses, legalLinks] = await Promise.all([
    user ? getAddressService().list(user.id) : Promise.resolve([]),
    getCachedLegalLinks(),
  ]);

  let quote;
  let paymentOptions: PaymentOption[] = [];
  try {
    quote = await getCheckoutService().quote(
      identity,
      coupon ? coupon.trim().toUpperCase() : null,
      { userId: user?.id ?? null, email: user?.email ?? null },
    );
    paymentOptions = await getCheckoutService().paymentOptions(
      identity,
      quote.grandTotal,
    );
  } catch (error) {
    if (isAppError(error) && error.message === "Sepetiniz boş")
      redirect("/sepet");
    if (isAppError(error)) {
      return (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-red-600">
            {error.message}
          </p>
          <Link href="/sepet" className="underline">
            Sepete dön
          </Link>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <TrackOnMount
        name="begin_checkout"
        payload={{
          currency: quote.currency,
          value: Number(quote.grandTotal),
          items: quote.lines.map((line) => ({
            id: line.variantId,
            name: line.productName,
            price: Number(line.unitPrice),
            quantity: line.quantity,
            variant: line.variantName,
          })),
        }}
      />
      <CheckoutForm
        defaultEmail={user?.email ?? ""}
        defaultCoupon={coupon}
        paymentOptions={paymentOptions}
        savedAddresses={savedAddresses}
        legalLinks={legalLinks}
      />

      <aside className="flex h-fit flex-col gap-3 rounded-theme border border-border p-5">
        <h2 className="font-semibold">Sipariş özeti</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {quote.lines.map((line) => (
            <li key={line.variantId} className="flex justify-between gap-3">
              <span>
                {line.productName}
                {line.variantName ? ` (${line.variantName})` : ""} ×{" "}
                {line.quantity}
              </span>
              <Price value={line.lineTotal} currency={quote.currency} />
            </li>
          ))}
        </ul>
        <hr className="border-border" />
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt>Ara toplam</dt>
            <dd>
              <Price value={quote.subtotal} currency={quote.currency} />
            </dd>
          </div>
          {quote.discounts.map((discount) => (
            <div
              key={discount.label}
              className="flex justify-between text-green-700"
            >
              <dt>{discount.label}</dt>
              <dd>
                -<Price value={discount.amount} currency={quote.currency} />
              </dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt>Kargo</dt>
            <dd>
              {Number(quote.shippingTotal) === 0 ? (
                "Ücretsiz"
              ) : (
                <Price value={quote.shippingTotal} currency={quote.currency} />
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Toplam</dt>
            <dd>
              <Price value={quote.grandTotal} currency={quote.currency} />
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">KDV dahildir.</p>
      </aside>
    </div>
  );
}

export default function CheckoutPage({ searchParams }: PageProps<"/odeme">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ödeme</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <CheckoutContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
