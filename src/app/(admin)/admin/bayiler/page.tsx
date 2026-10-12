import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { features } from "@/config/features";
import { adminPage } from "@/modules/admin/guard";
import { getDealerService } from "@/modules/b2b/container";
import type { DealerStatus } from "@/modules/b2b/dealer.types";
import { PERMISSIONS } from "@/shared/permissions";
import { DealerRow } from "./dealer-row";

export const metadata: Metadata = { title: "Bayiler" };

function isStatus(value: string | undefined): value is DealerStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

async function DealersContent({
  searchParams,
}: Pick<PageProps<"/admin/bayiler">, "searchParams">) {
  const user = await adminPage(PERMISSIONS.B2B_APPROVE);
  if (!user) return <AccessDenied />;

  const params = await searchParams;
  const raw = typeof params["durum"] === "string" ? params["durum"] : "PENDING";
  const status = isStatus(raw) ? raw : undefined;

  const service = getDealerService();
  const [dealers, groups] = await Promise.all([
    service.list({ status }),
    service.listGroups(),
  ]);

  const tabs: { label: string; value: string }[] = [
    { label: "Bekleyenler", value: "PENDING" },
    { label: "Onaylılar", value: "APPROVED" },
    { label: "Reddedilenler", value: "REJECTED" },
    { label: "Tümü", value: "ALL" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-4 text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/bayiler?durum=${tab.value}`}
            className={
              raw === tab.value
                ? "font-semibold underline"
                : "text-muted-foreground"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p role="alert" className="text-sm text-red-600">
          Onaylamadan önce en az bir müşteri grubu tanımlayın (Bayi grupları).
        </p>
      ) : null}

      {dealers.length === 0 ? (
        <p className="text-muted-foreground">Gösterilecek kayıt yok.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {dealers.map((dealer) => (
            <DealerRow
              key={dealer.userId}
              dealer={{
                userId: dealer.userId,
                name: dealer.name,
                email: dealer.email,
                status: dealer.status,
                companyName: dealer.companyName,
                taxNumber: dealer.taxNumber,
                taxOffice: dealer.taxOffice,
                groupId: dealer.groupId,
                groupName: dealer.groupName,
                creditLimit: dealer.creditLimit,
                minOrderAmount: dealer.minOrderAmount,
                note: dealer.note,
              }}
              groups={groups.map((group) => ({
                id: group.id,
                name: group.name,
              }))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminDealersPage({
  searchParams,
}: PageProps<"/admin/bayiler">) {
  if (!features.b2b) notFound();

  return (
    <>
      <PageHeader
        title="Bayiler"
        description="Bayi başvurularını değerlendirin; grup, kredi limiti ve minimum sipariş tutarını belirleyin."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <DealersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
