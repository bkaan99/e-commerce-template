import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { getTaxonomyService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { flattenWithDepth } from "@/modules/admin/taxonomy/category.logic";
import { PERMISSIONS } from "@/shared/permissions";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Kategoriler" };

async function CategoriesContent() {
  const user = await adminPage(PERMISSIONS.CATALOG_MANAGE);
  if (!user) return <AccessDenied />;

  const categories = await getTaxonomyService().listCategories();
  return <CategoryManager categories={flattenWithDepth(categories)} />;
}

export default function AdminCategoriesPage() {
  return (
    <>
      <PageHeader
        title="Kategoriler"
        description="Adres değişirse eski adres otomatik olarak yeni adrese yönlendirilir."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <CategoriesContent />
      </Suspense>
    </>
  );
}
