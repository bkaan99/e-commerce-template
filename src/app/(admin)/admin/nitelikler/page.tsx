import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { getTaxonomyService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";
import { AttributeManager } from "./attribute-manager";

export const metadata: Metadata = { title: "Nitelikler ve markalar" };

async function AttributesContent() {
  const user = await adminPage(PERMISSIONS.CATALOG_MANAGE);
  if (!user) return <AccessDenied />;

  const service = getTaxonomyService();
  const [attributes, brands] = await Promise.all([
    service.listAttributes(),
    service.listBrands(),
  ]);

  return (
    <AttributeManager
      attributes={attributes.map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
        isFilterable: attribute.isFilterable,
        values: attribute.values.map((value) => ({
          id: value.id,
          value: value.value,
          productCount: value.productCount,
        })),
      }))}
      brands={brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        productCount: brand.productCount,
      }))}
    />
  );
}

export default function AdminAttributesPage() {
  return (
    <>
      <PageHeader
        title="Nitelikler ve markalar"
        description="Nitelikler vitrinde filtre olarak kullanılır."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <AttributesContent />
      </Suspense>
    </>
  );
}
