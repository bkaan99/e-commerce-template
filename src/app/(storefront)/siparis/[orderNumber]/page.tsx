import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Price } from "@/components/storefront/price";
import { getCurrentUser } from "@/modules/auth/session";
import { getOrderService } from "@/modules/orders/container";
import {
  ORDER_STATUS_LABELS,
  isCancellable,
} from "@/modules/orders/order-labels";
import { isAppError } from "@/shared/errors";
import {
  CancelOrderButton,
  OrderStatusPoller,
  PurchaseTracker,
} from "./order-client";

export const metadata: Metadata = {
  title: "Sipariş detayı",
  robots: { index: false },
};

async function OrderContent({
  params,
  searchParams,
}: Pick<PageProps<"/siparis/[orderNumber]">, "params" | "searchParams">) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const token = typeof query["t"] === "string" ? query["t"] : null;
  const user = await getCurrentUser();

  let order;
  try {
    order = await getOrderService().getForAccess(orderNumber, {
      userId: user?.id ?? null,
      lookupToken: token,
    });
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  const address = order.shippingAddress;
  const awaitingPayment = order.status === "PENDING_PAYMENT";
  const failedReturn = query["durum"] === "basarisiz";

  return (
    <div className="flex flex-col gap-8">
      {order.paymentStatus === "PAID" ? (
        <PurchaseTracker
          orderNumber={order.orderNumber}
          currency={order.currency}
          value={Number(order.grandTotal)}
          items={order.items.map((item) => ({
            id: item.sku,
            name: item.productName,
            price: Number(item.unitPrice),
            quantity: item.quantity,
          }))}
        />
      ) : null}

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sipariş {order.orderNumber}</h1>
        <p className="text-muted-foreground">
          Durum: <strong>{ORDER_STATUS_LABELS[order.status]}</strong>
        </p>
        {order.status === "PAID" ? (
          <p className="text-green-700">
            Siparişiniz için teşekkürler. Onay e-postası {order.email} adresine
            gönderildi.
          </p>
        ) : null}
        {failedReturn && awaitingPayment ? (
          <p role="alert" className="text-red-600">
            Ödeme tamamlanamadı. Süre dolmadan tekrar deneyebilirsiniz.
          </p>
        ) : null}
        {order.status === "CANCELLED" && order.paymentStatus === "FAILED" ? (
          <p role="alert" className="text-red-600">
            Ödeme alınamadığı için sipariş iptal edildi.
          </p>
        ) : null}
      </header>

      {awaitingPayment && !failedReturn ? <OrderStatusPoller /> : null}

      {order.trackingNumber ? (
        <p>
          Kargo: {order.carrier ? `${order.carrier} · ` : ""}
          <strong>{order.trackingNumber}</strong>
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ürünler</h2>
        <ul className="flex flex-col divide-y divide-border">
          {order.items.map((item) => (
            <li
              key={item.sku}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <span>
                {item.productName}
                {item.variantName ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {item.variantName}
                  </span>
                ) : null}{" "}
                × {item.quantity}
              </span>
              <Price value={item.lineTotal} currency={order.currency} />
            </li>
          ))}
        </ul>
        <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt>Ara toplam</dt>
            <dd>
              <Price value={order.subtotal} currency={order.currency} />
            </dd>
          </div>
          {Number(order.discountTotal) > 0 ? (
            <div className="flex justify-between text-green-700">
              <dt>İndirim</dt>
              <dd>
                -<Price value={order.discountTotal} currency={order.currency} />
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Kargo</dt>
            <dd>
              <Price value={order.shippingTotal} currency={order.currency} />
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <dt>Toplam</dt>
            <dd>
              <Price value={order.grandTotal} currency={order.currency} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-1 text-sm">
        <h2 className="text-lg font-semibold">Teslimat adresi</h2>
        <p>
          {address.firstName} {address.lastName} · {address.phone}
        </p>
        <p className="text-muted-foreground">
          {address.addressLine}
          {address.neighborhood ? `, ${address.neighborhood}` : ""}{" "}
          {address.district}/{address.city}
        </p>
      </section>

      {isCancellable(order.status) && !awaitingPayment ? (
        <CancelOrderButton
          orderNumber={order.orderNumber}
          lookupToken={token}
          paid={order.paymentStatus === "PAID"}
        />
      ) : null}
    </div>
  );
}

export default function OrderPage({
  params,
  searchParams,
}: PageProps<"/siparis/[orderNumber]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Yükleniyor...</p>}>
      <OrderContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
