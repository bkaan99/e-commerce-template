import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  getDevPaymentProvider,
  getOrderService,
} from "@/modules/orders/container";
import { getCurrentUser } from "@/modules/auth/session";
import { Price } from "@/components/storefront/price";
import { devPaymentAction } from "../../actions";

export const metadata: Metadata = {
  title: "Geliştirme ödeme sayfası",
  robots: { index: false },
};

/** Yalnızca PayTR anahtarı olmayan geliştirme ortamında görünür. */
async function DevPaymentContent({
  params,
  searchParams,
}: Pick<
  PageProps<"/odeme/gelistirme/[orderNumber]">,
  "params" | "searchParams"
>) {
  await connection();
  if (!getDevPaymentProvider()) notFound();

  const { orderNumber } = await params;
  const query = await searchParams;
  const token = typeof query["t"] === "string" ? query["t"] : "";
  const user = await getCurrentUser();

  const order = await getOrderService()
    .getForAccess(orderNumber, { userId: user?.id ?? null, lookupToken: token })
    .catch(() => null);
  if (!order) notFound();

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-theme border border-amber-300 bg-amber-50 p-6">
      <p className="text-sm text-amber-800">
        Bu sayfa yalnızca geliştirme ortamında görünür. Gerçek ödeme alınmaz.
      </p>
      <p>
        Sipariş <strong>{order.orderNumber}</strong> ·{" "}
        <Price value={order.grandTotal} currency={order.currency} />
      </p>
      <form action={devPaymentAction} className="flex gap-3">
        <input type="hidden" name="orderNumber" value={order.orderNumber} />
        <input type="hidden" name="lookupToken" value={order.lookupToken} />
        <input type="hidden" name="amount" value={order.grandTotal} />
        <button
          type="submit"
          name="status"
          value="success"
          className="rounded-theme bg-green-700 px-4 py-2 text-white"
        >
          Ödemeyi başarılı say
        </button>
        <button
          type="submit"
          name="status"
          value="failed"
          className="rounded-theme bg-red-700 px-4 py-2 text-white"
        >
          Ödemeyi başarısız say
        </button>
      </form>
    </div>
  );
}

export default function DevPaymentPage({
  params,
  searchParams,
}: PageProps<"/odeme/gelistirme/[orderNumber]">) {
  return (
    <Suspense fallback={null}>
      <DevPaymentContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
