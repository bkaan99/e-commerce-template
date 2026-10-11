import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { getProductAdminService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Yeni ürün" };

async function NewProductContent() {
  const user = await adminPage(PERMISSIONS.PRODUCT_WRITE);
  if (!user) return <AccessDenied />;

  const references = await getProductAdminService().references();
  return <ProductForm mode="create" references={references} />;
}

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Yeni ürün" />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <NewProductContent />
      </Suspense>
    </>
  );
}
