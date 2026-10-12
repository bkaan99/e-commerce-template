import { trackingUrl } from "@/shared/shipping/carriers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOrderService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import {
  allowedTransitions,
  isStaffCancellable,
} from "@/modules/admin/orders/order-state";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_STATUS_LABELS,
} from "@/modules/orders/order-labels";
import type { PaymentStatus } from "@/modules/orders/order.types";
import { isAppError } from "@/shared/errors";
import { hasPermission } from "@/modules/auth/authorization";
import { PERMISSIONS } from "@/shared/permissions";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Sipariş detayı" };

function AddressBlock({
  title,
  address,
}: {
  title: string;
  address: Record<string, string | null>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <p>
          {address["firstName"]} {address["lastName"]} · {address["phone"]}
        </p>
        <p className="text-muted-foreground">
          {address["addressLine"]}
          {address["neighborhood"] ? `, ${address["neighborhood"]}` : ""}{" "}
          {address["district"]}/{address["city"]}
        </p>
        {address["companyName"] ? (
          <p>
            {address["companyName"]} · VKN {address["taxNumber"]} (
            {address["taxOffice"]})
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function OrderDetail({
  params,
}: Pick<PageProps<"/admin/siparisler/[orderNumber]">, "params">) {
  const user = await adminPage(PERMISSIONS.ORDER_READ);
  if (!user) return <AccessDenied />;

  const { orderNumber } = await params;

  let order;
  try {
    order = await getAdminOrderService().get(orderNumber);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  const transitions = allowedTransitions(order.status);
  const canUpdate = hasPermission(user.permissions, PERMISSIONS.ORDER_UPDATE);
  const canCancel = hasPermission(user.permissions, PERMISSIONS.ORDER_CANCEL);
  const payment = order.payments[0];
  const METHOD_LABELS = {
    CARD: "Kart",
    BANK_TRANSFER: "Havale / EFT",
    DEFERRED: "Vadeli",
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Sipariş ${order.orderNumber}`} />
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={ORDER_STATUS_TONES[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Ödeme: {PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus]} ·{" "}
          {order.createdAt.toLocaleString("tr-TR")} · Kanal: {order.source}
        </span>
      </div>

      {canUpdate || canCancel ? (
        <Card>
          <CardHeader>
            <CardTitle>İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderActions
              orderNumber={order.orderNumber}
              canProcess={canUpdate && transitions.includes("PROCESSING")}
              canShip={canUpdate && transitions.includes("SHIPPED")}
              canDeliver={canUpdate && transitions.includes("DELIVERED")}
              canCancel={canCancel && isStaffCancellable(order.status)}
              canConfirmBankTransfer={
                canUpdate &&
                payment?.method === "BANK_TRANSFER" &&
                order.status === "PENDING_PAYMENT"
              }
              canCollectDeferred={
                canUpdate &&
                payment?.method === "DEFERRED" &&
                order.paymentStatus === "PENDING" &&
                order.status !== "CANCELLED"
              }
              paid={order.paymentStatus === "PAID"}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ürünler</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-2">
                <span>
                  {item.productName}
                  {item.variantName ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {item.variantName}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground"> ({item.sku})</span> ×{" "}
                  {item.quantity}
                </span>
                <Price value={item.lineTotal} currency={order.currency} />
              </li>
            ))}
          </ul>
          <dl className="ml-auto mt-4 flex max-w-xs flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt>Ara toplam</dt>
              <dd>
                <Price value={order.subtotal} currency={order.currency} />
              </dd>
            </div>
            {Number(order.discountTotal) > 0 ? (
              <div className="flex justify-between">
                <dt>
                  İndirim{order.couponCode ? ` (${order.couponCode})` : ""}
                </dt>
                <dd>
                  -
                  <Price
                    value={order.discountTotal}
                    currency={order.currency}
                  />
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Kargo</dt>
              <dd>
                <Price value={order.shippingTotal} currency={order.currency} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold">
              <dt>Toplam</dt>
              <dd>
                <Price value={order.grandTotal} currency={order.currency} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <AddressBlock title="Teslimat adresi" address={order.shippingAddress} />
        <AddressBlock title="Fatura adresi" address={order.billingAddress} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Müşteri</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{order.email}</p>
            <p className="text-muted-foreground">
              {order.userId ? "Üye" : "Misafir"}
            </p>
            {order.customerNote ? (
              <p className="mt-2">Not: {order.customerNote}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ödeme ve kargo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {order.payments.map((payment) => (
              <p key={payment.merchantOid}>
                {METHOD_LABELS[payment.method]} · {payment.status} ·{" "}
                <Price value={payment.amount} currency={order.currency} />
                <span className="text-muted-foreground">
                  {" "}
                  ({payment.merchantOid})
                </span>
                {payment.dueAt ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · vade {payment.dueAt.toLocaleDateString("tr-TR")}
                  </span>
                ) : null}
              </p>
            ))}
            {order.shipments.map((shipment, index) => (
              <p key={index}>
                {shipment.carrier}
                {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}
                {trackingUrl(shipment.carrier, shipment.trackingNumber) ? (
                  <>
                    {" · "}
                    <a
                      href={trackingUrl(
                        shipment.carrier,
                        shipment.trackingNumber,
                      )!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Takip
                    </a>
                  </>
                ) : null}
              </p>
            ))}
            {order.returns.map((request) => (
              <p key={request.id}>
                <Link href="/admin/iadeler" className="underline">
                  İade talebi
                </Link>{" "}
                · {request.status}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminOrderPage({
  params,
}: PageProps<"/admin/siparisler/[orderNumber]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Yükleniyor...</p>}>
      <OrderDetail params={params} />
    </Suspense>
  );
}
