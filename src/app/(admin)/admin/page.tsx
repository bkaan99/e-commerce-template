import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPage } from "@/modules/admin/guard";
import { reportingService } from "@/modules/reporting/container";
import {
  REPORT_PERIODS,
  parseReportPeriod,
} from "@/modules/reporting/reporting.service";
import { cn } from "@/shared/cn";
import { PERMISSIONS } from "@/shared/permissions";

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">–</span>;
  const positive = value >= 0;
  return (
    <Badge tone={positive ? "success" : "danger"}>
      {positive ? "+" : ""}
      {value}%
    </Badge>
  );
}

async function DashboardContent({
  searchParams,
}: Pick<PageProps<"/admin">, "searchParams">) {
  const user = await adminPage();
  if (!user) return <AccessDenied />;

  const canReport = user.permissions.includes(PERMISSIONS.REPORT_VIEW);
  if (!canReport) {
    return (
      <p className="text-muted-foreground">
        Hoş geldiniz, {user.name || user.email}. Soldaki menüden çalışmak
        istediğiniz bölümü seçin.
      </p>
    );
  }

  const params = await searchParams;
  const period = parseReportPeriod(
    typeof params["gun"] === "string" ? params["gun"] : undefined,
  );
  const data = await reportingService.dashboard(period);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Dönem" className="flex flex-wrap gap-2 text-sm">
        {REPORT_PERIODS.map((days) => (
          <Link
            key={days}
            href={`/admin?gun=${days}`}
            aria-current={days === period ? "page" : undefined}
            className={cn(
              "rounded-theme border border-border px-3 py-1",
              days === period && "bg-primary text-primary-foreground",
            )}
          >
            Son {days} gün
          </Link>
        ))}
      </nav>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ciro (son {data.periodDays} gün)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <span className="text-2xl font-semibold">
              <Price value={data.revenue.current} />
            </span>
            <Change value={data.revenue.changePercent} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sipariş sayısı</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <span className="text-2xl font-semibold">
              {data.orders.current}
            </span>
            <Change value={data.orders.changePercent} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ortalama sepet</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">
              <Price value={data.averageOrderValue} />
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Yeni müşteri</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <span className="text-2xl font-semibold">
              {data.customers.newCustomers}
            </span>
            <Change value={data.customers.newChangePercent} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alışveriş yapan üye</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">
              {data.customers.buyers}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tekrar alışveriş oranı</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">
              {data.customers.returningRate === null
                ? "—"
                : `%${data.customers.returningRate}`}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dikkat gerektirenler</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/siparisler?durum=PAID" className="underline">
            Hazırlanacak sipariş:{" "}
            <strong>{data.attention.ordersToProcess}</strong>
          </Link>
          <Link href="/admin/iadeler" className="underline">
            Bekleyen iade talebi:{" "}
            <strong>{data.attention.openReturnRequests}</strong>
          </Link>
          <span>
            Onay bekleyen bayi: <strong>{data.attention.pendingDealers}</strong>
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>En çok satanlar</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bu dönemde satış yok.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {data.topProducts.map((product) => (
                  <li key={product.name} className="flex justify-between py-2">
                    <span>{product.name}</span>
                    <span className="text-muted-foreground">
                      {product.quantity} adet ·{" "}
                      <Price value={product.revenue} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Düşük stok</CardTitle>
          </CardHeader>
          <CardContent>
            {data.attention.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Düşük stoklu ürün yok.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {data.attention.lowStock.map((item) => (
                  <li key={item.sku} className="flex justify-between py-2">
                    <span>
                      {item.productName}{" "}
                      <span className="text-muted-foreground">
                        ({item.sku})
                      </span>
                    </span>
                    <Badge tone={item.available === 0 ? "danger" : "warning"}>
                      {item.available} adet
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data.stockDemand.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Stok talebi (haber ver bekleyenler)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {data.stockDemand.map((item) => (
                <li key={item.sku} className="flex justify-between py-2">
                  <span>
                    {item.productName}{" "}
                    <span className="text-muted-foreground">({item.sku})</span>
                  </span>
                  <span>{item.waiting} kişi bekliyor</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  return (
    <>
      <PageHeader
        title="Pano"
        description="Seçilen dönemin önceki dönemle karşılaştırmalı özeti"
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
