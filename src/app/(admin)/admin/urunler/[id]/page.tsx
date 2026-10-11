import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { getProductAdminService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { isAppError } from "@/shared/errors";
import { PERMISSIONS } from "@/shared/permissions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Ürün düzenle" };

async function EditProductContent({
  params,
}: Pick<PageProps<"/admin/urunler/[id]">, "params">) {
  const user = await adminPage(PERMISSIONS.PRODUCT_WRITE);
  if (!user) return <AccessDenied />;

  const { id } = await params;
  const service = getProductAdminService();

  let product;
  try {
    product = await service.get(id);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  const references = await service.references();

  return (
    <>
      <PageHeader
        title={product.name}
        description={`/urun/${product.slug}`}
        actions={
          product.status === "ACTIVE" ? (
            <Link
              href={`/urun/${product.slug}`}
              className="text-sm underline"
              target="_blank"
            >
              Sayfayı görüntüle
            </Link>
          ) : null
        }
      />
      <ProductForm
        key={product.id}
        mode="edit"
        product={product}
        references={references}
      />
    </>
  );
}

export default function EditProductPage({
  params,
}: PageProps<"/admin/urunler/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Yükleniyor...</p>}>
      <EditProductContent params={params} />
    </Suspense>
  );
}
