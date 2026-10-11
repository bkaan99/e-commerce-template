import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerQueryService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order-labels";
import type { OrderStatus } from "@/modules/orders/order.types";
import { PERMISSIONS } from "@/shared/permissions";

export const metadata: Metadata = { title: "Müşteri" };

async function CustomerContent({
  params,
}: Pick<PageProps<"/admin/musteriler/[id]">, "params">) {
  const user = await adminPage(PERMISSIONS.CUSTOMER_READ);
  if (!user) return <AccessDenied />;

  const { id } = await params;
  const customer = await getCustomerQueryService().get(id);
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={customer.name} description={customer.email} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Sipariş</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {customer.orderCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Toplam harcama</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <Price value={customer.totalSpent} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hesap</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1 text-sm">
            <Badge tone={customer.emailVerified ? "success" : "warning"}>
              {customer.emailVerified
                ? "E-posta doğrulandı"
                : "E-posta doğrulanmadı"}
            </Badge>
            {customer.b2bStatus !== "NONE" ? (
              <Badge tone="info">Bayi: {customer.b2bStatus}</Badge>
            ) : null}
            {customer.groupName ? <Badge>{customer.groupName}</Badge> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Siparişler</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sipariş yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {customer.orders.map((order) => (
                <li
                  key={order.orderNumber}
                  className="flex justify-between gap-3 py-2"
                >
                  <Link
                    href={`/admin/siparisler/${order.orderNumber}`}
                    className="font-medium underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <span className="text-muted-foreground">
                    {order.createdAt.toLocaleDateString("tr-TR")} ·{" "}
                    {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                  </span>
                  <Price value={order.grandTotal} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminCustomerPage({
  params,
}: PageProps<"/admin/musteriler/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Yükleniyor...</p>}>
      <CustomerContent params={params} />
    </Suspense>
  );
}
