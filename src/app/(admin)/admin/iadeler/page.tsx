import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { adminPage } from "@/modules/admin/guard";
import { getReturnService } from "@/modules/returns/container";
import type { ReturnStatus } from "@/modules/returns/return.types";
import { PERMISSIONS } from "@/shared/permissions";
import { ReturnRowActions } from "./return-row-actions";

export const metadata: Metadata = { title: "İade talepleri" };

const STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  COMPLETED: "İade edildi",
};

const TONES: Record<ReturnStatus, "warning" | "info" | "danger" | "success"> = {
  REQUESTED: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  COMPLETED: "success",
};

async function ReturnsContent({
  searchParams,
}: Pick<PageProps<"/admin/iadeler">, "searchParams">) {
  const user = await adminPage(PERMISSIONS.RETURN_MANAGE);
  if (!user) return <AccessDenied />;

  const params = await searchParams;
  const filter = params["tum"] ? undefined : ("REQUESTED" as const);
  const requests = await getReturnService().list(filter);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-3 text-sm">
        <Link
          href="/admin/iadeler"
          className={
            filter ? "text-muted-foreground" : "font-semibold underline"
          }
        >
          Bekleyenler
        </Link>
        <Link
          href="/admin/iadeler?tum=1"
          className={
            filter ? "font-semibold underline" : "text-muted-foreground"
          }
        >
          Tümü
        </Link>
      </nav>

      {requests.length === 0 ? (
        <p className="text-muted-foreground">Gösterilecek iade talebi yok.</p>
      ) : (
        requests.map((request) => (
          <Card key={request.id}>
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/siparisler/${request.orderNumber}`}
                  className="font-medium underline"
                >
                  {request.orderNumber}
                </Link>
                <Badge tone={TONES[request.status]}>
                  {STATUS_LABELS[request.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {request.email} · {request.createdAt.toLocaleString("tr-TR")}
                </span>
              </div>
              <ul className="text-sm">
                {request.items.map((item, index) => (
                  <li key={index}>
                    {item.productName}
                    {item.variantName ? ` · ${item.variantName}` : ""} ×{" "}
                    {item.quantity}
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                <strong>Neden:</strong> {request.reason}
                {request.note ? ` — ${request.note}` : ""}
              </p>
              <p className="text-sm">
                İade tutarı:{" "}
                <strong>
                  <Price value={request.refundAmount} />
                </strong>
              </p>
              {request.adminNote ? (
                <p className="text-sm text-muted-foreground">
                  Not: {request.adminNote}
                </p>
              ) : null}
              {request.status === "REQUESTED" ? (
                <ReturnRowActions
                  requestId={request.id}
                  amount={request.refundAmount}
                />
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export default function AdminReturnsPage({
  searchParams,
}: PageProps<"/admin/iadeler">) {
  return (
    <>
      <PageHeader title="İade talepleri" />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <ReturnsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
