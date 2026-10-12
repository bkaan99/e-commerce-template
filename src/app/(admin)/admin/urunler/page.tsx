import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getProductAdminService } from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { cn } from "@/shared/cn";
import { PERMISSIONS } from "@/shared/permissions";

export const metadata: Metadata = { title: "Ürünler" };

const PAGE_SIZE = 25;
const STATUS_LABELS = {
  DRAFT: "Taslak",
  ACTIVE: "Yayında",
  ARCHIVED: "Arşiv",
} as const;
const TONES = {
  DRAFT: "warning",
  ACTIVE: "success",
  ARCHIVED: "neutral",
} as const;

function isStatus(
  value: string | undefined,
): value is keyof typeof STATUS_LABELS {
  return value === "DRAFT" || value === "ACTIVE" || value === "ARCHIVED";
}

async function ProductsContent({
  searchParams,
}: Pick<PageProps<"/admin/urunler">, "searchParams">) {
  const user = await adminPage(PERMISSIONS.PRODUCT_READ);
  if (!user) return <AccessDenied />;

  const params = await searchParams;
  const search = typeof params["q"] === "string" ? params["q"] : "";
  const rawStatus =
    typeof params["durum"] === "string" ? params["durum"] : undefined;
  const page = Math.max(1, Number(params["sayfa"]) || 1);

  const result = await getProductAdminService().list({
    search,
    status: isStatus(rawStatus) ? rawStatus : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const queryFor = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (isStatus(rawStatus)) query.set("durum", rawStatus);
    if (target > 1) query.set("sayfa", String(target));
    const text = query.toString();
    return `/admin/urunler${text ? `?${text}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form action="/admin/urunler" className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="Ürün adı veya SKU"
          className="max-w-xs"
          aria-label="Ara"
        />
        <Select
          name="durum"
          defaultValue={rawStatus ?? ""}
          className="max-w-40"
          aria-label="Durum"
        >
          <option value="">Tüm durumlar</option>
          <option value="ACTIVE">Yayında</option>
          <option value="DRAFT">Taslak</option>
          <option value="ARCHIVED">Arşiv</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtrele
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{result.total} ürün</p>

      <Table>
        <THead>
          <tr>
            <TH>Ürün</TH>
            <TH>Kategori</TH>
            <TH>Durum</TH>
            <TH>Varyant</TH>
            <TH>Stok</TH>
            <TH className="text-right">Fiyat</TH>
          </tr>
        </THead>
        <TBody>
          {result.items.map((product) => (
            <TR key={product.id}>
              <TD>
                <Link
                  href={`/admin/urunler/${product.id}`}
                  className="flex items-center gap-3"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-theme bg-muted">
                    <Image
                      src={product.imageUrl ?? "/placeholder.svg"}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </span>
                  <span className="font-medium underline">{product.name}</span>
                </Link>
              </TD>
              <TD>{product.categoryName}</TD>
              <TD>
                <Badge tone={TONES[product.status]}>
                  {STATUS_LABELS[product.status]}
                </Badge>
              </TD>
              <TD>{product.variantCount}</TD>
              <TD>{product.totalStock}</TD>
              <TD className="text-right">
                {product.minPrice ? <Price value={product.minPrice} /> : "–"}
              </TD>
            </TR>
          ))}
          {result.items.length === 0 ? (
            <TR>
              <TD
                colSpan={6}
                className="py-8 text-center text-muted-foreground"
              >
                Ürün bulunamadı.
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

export default function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/urunler">) {
  return (
    <>
      <PageHeader
        title="Ürünler"
        actions={
          <>
            <a
              href="/admin/disa-aktar/urunler"
              className="self-center text-sm underline"
              download
            >
              CSV olarak indir
            </a>
            <Link
              href="/admin/urunler/ice-aktar"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              İçe aktar
            </Link>
            <Link href="/admin/urunler/yeni" className={cn(buttonVariants())}>
              Yeni ürün
            </Link>
          </>
        }
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
