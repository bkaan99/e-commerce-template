import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminOrderService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_STATUS_LABELS,
} from "@/modules/orders/order-labels";
import type { OrderStatus, PaymentStatus } from "@/modules/orders/order.types";
import { PERMISSIONS } from "@/shared/permissions";

export const metadata: Metadata = { title: "Siparişler" };

const PAGE_SIZE = 25;
const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

function isStatus(value: string | undefined): value is OrderStatus {
  return STATUSES.includes(value as OrderStatus);
}

async function OrdersContent({
  searchParams,
}: Pick<PageProps<"/admin/siparisler">, "searchParams">) {
  const user = await adminPage(PERMISSIONS.ORDER_READ);
  if (!user) return <AccessDenied />;

  const params = await searchParams;
  const rawStatus =
    typeof params["durum"] === "string" ? params["durum"] : undefined;
  const search = typeof params["q"] === "string" ? params["q"] : "";
  const page = Math.max(1, Number(params["sayfa"]) || 1);

  const result = await getAdminOrderService().list({
    status: isStatus(rawStatus) ? rawStatus : undefined,
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const queryFor = (target: number) => {
    const query = new URLSearchParams();
    if (isStatus(rawStatus)) query.set("durum", rawStatus);
    if (search) query.set("q", search);
    if (target > 1) query.set("sayfa", String(target));
    const text = query.toString();
    return `/admin/siparisler${text ? `?${text}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap gap-2" action="/admin/siparisler">
        <Input
          name="q"
          defaultValue={search}
          placeholder="Sipariş no veya e-posta"
          className="max-w-xs"
          aria-label="Ara"
        />
        <Select
          name="durum"
          defaultValue={rawStatus ?? ""}
          className="max-w-48"
          aria-label="Durum"
        >
          <option value="">Tüm durumlar</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filtrele
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{result.total} sipariş</p>

      <Table>
        <THead>
          <tr>
            <TH>Sipariş</TH>
            <TH>Müşteri</TH>
            <TH>Durum</TH>
            <TH>Ödeme</TH>
            <TH>Adet</TH>
            <TH className="text-right">Tutar</TH>
            <TH>Tarih</TH>
          </tr>
        </THead>
        <TBody>
          {result.items.map((order) => (
            <TR key={order.id}>
              <TD>
                <Link
                  href={`/admin/siparisler/${order.orderNumber}`}
                  className="font-medium underline"
                >
                  {order.orderNumber}
                </Link>
              </TD>
              <TD>
                <div>{order.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {order.email}
                </div>
              </TD>
              <TD>
                <Badge tone={ORDER_STATUS_TONES[order.status]}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </TD>
              <TD>
                {PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus]}
              </TD>
              <TD>{order.itemCount}</TD>
              <TD className="text-right">
                <Price value={order.grandTotal} currency={order.currency} />
              </TD>
              <TD>{order.createdAt.toLocaleString("tr-TR")}</TD>
            </TR>
          ))}
          {result.items.length === 0 ? (
            <TR>
              <TD
                colSpan={7}
                className="py-8 text-center text-muted-foreground"
              >
                Sipariş bulunamadı.
              </TD>
            </TR>
          ) : null}
        </TBody>
      </Table>

      {result.totalPages > 1 ? (
        <nav className="flex items-center gap-3 text-sm" aria-label="Sayfalama">
          {page > 1 ? <Link href={queryFor(page - 1)}>Önceki</Link> : null}
          <span className="text-muted-foreground">
            {page} / {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link href={queryFor(page + 1)}>Sonraki</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export default function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/siparisler">) {
  return (
    <>
      <PageHeader
        title="Siparişler"
        actions={
          <a
            href="/admin/disa-aktar/siparisler"
            className="text-sm underline"
            download
          >
            CSV olarak indir
          </a>
        }
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
