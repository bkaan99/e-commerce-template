import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Price } from "@/components/storefront/price";
import { getCurrentCart } from "@/modules/cart/cart.session";
import { CartLines } from "./cart-lines";

export const metadata: Metadata = {
  title: "Sepetim",
  robots: { index: false },
};

async function CartContent() {
  const cart = await getCurrentCart();

  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">Sepetiniz boş.</p>
        <Link
          href="/"
          className="rounded-theme bg-primary px-5 py-2 text-primary-foreground"
        >
          Alışverişe başla
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <CartLines cart={cart} />
      <aside className="flex h-fit flex-col gap-4 rounded-theme border border-border p-5">
        <h2 className="font-semibold">Sipariş özeti</h2>
        <div className="flex items-center justify-between text-sm">
          <span>Ara toplam ({cart.itemCount} ürün)</span>
          <Price value={cart.subtotal} currency={cart.currency} />
        </div>
        <p className="text-xs text-muted-foreground">
          KDV dahildir. Kargo ücreti ödeme adımında hesaplanır.
        </p>
        {cart.hasIssues ? (
          <span className="rounded-theme bg-primary px-4 py-3 text-center text-primary-foreground opacity-50">
            Ödemeye geç
          </span>
        ) : (
          <Link
            href="/odeme"
            className="rounded-theme bg-primary px-4 py-3 text-center text-primary-foreground"
          >
            Ödemeye geç
          </Link>
        )}
        {cart.hasIssues ? (
          <p className="text-xs text-red-600">
            Sepetinizde satın alınamayan ürünler var.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

export default function CartPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Sepetim</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <CartContent />
      </Suspense>
    </div>
  );
}
