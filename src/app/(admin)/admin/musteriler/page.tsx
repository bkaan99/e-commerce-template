import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCustomerQueryService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";

export const metadata: Metadata = { title: "Müşteriler" };

const PAGE_SIZE = 25;

async function CustomersContent({
  searchParams,
}: Pick<PageProps<"/admin/musteriler">, "searchParams">) {
  const user = await adminPage(PERMISSIONS.CUSTOMER_READ);
  if (!user) return <AccessDenied />;

  const params = await searchParams;
  const search = typeof params["q"] === "string" ? params["q"] : "";
  const page = Math.max(1, Number(params["sayfa"]) || 1);

  const result = await getCustomerQueryService().search({
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const queryFor = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (target > 1) query.set("sayfa", String(target));
    const text = query.toString();
    return `/admin/musteriler${text ? `?${text}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form action="/admin/musteriler" className="flex gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="Ad veya e-posta"
          className="max-w-xs"
          aria-label="Ara"
        />
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{result.total} müşteri</p>

      <Table>
        <THead>
          <tr>
            <TH>Müşteri</TH>
            <TH>Durum</TH>
            <TH>Sipariş</TH>
            <TH className="text-right">Toplam harcama</TH>
            <TH>Kayıt</TH>
          </tr>
        </THead>
        <TBody>
          {result.items.map((customer) => (
            <TR key={customer.id}>
              <TD>
                <Link
                  href={`/admin/musteriler/${customer.id}`}
                  className="font-medium underline"
                >
                  {customer.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {customer.email}
                </div>
              </TD>
              <TD>
                <div className="flex gap-1">
                  <Badge tone={customer.emailVerified ? "success" : "warning"}>
                    {customer.emailVerified ? "Doğrulandı" : "Doğrulanmadı"}
                  </Badge>
                  {!customer.isActive ? (
                    <Badge tone="danger">Pasif</Badge>
                  ) : null}
                </div>
              </TD>
              <TD>{customer.orderCount}</TD>
              <TD className="text-right">
                <Price value={customer.totalSpent} />
              </TD>
              <TD>{customer.createdAt.toLocaleDateString("tr-TR")}</TD>
            </TR>
          ))}
          {result.items.length === 0 ? (
            <TR>
              <TD
                colSpan={5}
                className="py-8 text-center text-muted-foreground"
              >
                Müşteri bulunamadı.
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

export default function AdminCustomersPage({
  searchParams,
}: PageProps<"/admin/musteriler">) {
  return (
    <>
      <PageHeader title="Müşteriler" />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <CustomersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
