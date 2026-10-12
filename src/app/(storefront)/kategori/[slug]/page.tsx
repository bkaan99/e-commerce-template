import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { FilterPanel } from "@/components/storefront/filter-panel";
import { JsonLd } from "@/components/storefront/json-ld";
import { Pagination } from "@/components/storefront/pagination";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SortLinks } from "@/components/storefront/sort-links";
import { getRequestPricing } from "@/modules/b2b/pricing-identity";
import { catalogService } from "@/modules/catalog/container";
import { loadCategory } from "@/modules/catalog/loaders";
import { parseListQuery, toSearchString } from "@/modules/catalog/query-params";
import { absoluteUrl } from "@/shared/site-url";

export async function generateMetadata({
  params,
}: PageProps<"/kategori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadCategory(slug);
  if (loaded.kind !== "ok") return {};

  const { category } = loaded.value;
  const description =
    category.seoDescription ??
    category.description ??
    `${category.name} kategorisindeki ürünleri keşfedin.`;

  return {
    title: category.seoTitle ?? category.name,
    description,
    alternates: { canonical: absoluteUrl(`/kategori/${category.slug}`) },
    openGraph: { title: category.name, description, type: "website" },
  };
}

async function CategoryContent({
  params,
  searchParams,
}: Pick<PageProps<"/kategori/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const loaded = await loadCategory(slug);

  if (loaded.kind === "redirect") permanentRedirect(loaded.to);
  if (loaded.kind === "missing") notFound();

  const { category, breadcrumbs } = loaded.value;
  const query = parseListQuery(await searchParams, { categorySlug: slug });
  const result = await catalogService.list(query, await getRequestPricing());
  const basePath = `/kategori/${category.slug}`;

  const crumbs = [
    { name: "Ana sayfa", href: "/" },
    ...breadcrumbs.map((crumb, index) => ({
      name: crumb.name,
      href:
        index === breadcrumbs.length - 1
          ? undefined
          : `/kategori/${crumb.slug}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: absoluteUrl(`/kategori/${crumb.slug}`),
          })),
        }}
      />
      <Breadcrumbs items={crumbs} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{category.name}</h1>
        {category.description ? (
          <p className="text-muted-foreground">{category.description}</p>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filtreler">
          <FilterPanel
            action={basePath}
            query={query}
            attributeFacets={result.attributeFacets}
            brandFacet={result.brandFacet}
          />
        </aside>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{result.total} ürün</p>
            <SortLinks basePath={basePath} query={query} />
          </div>
          <ProductGrid products={result.items} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            hrefFor={(page) => `${basePath}${toSearchString(query, { page })}`}
          />
        </div>
      </div>
    </div>
  );
}

export default function CategoryPage({
  params,
  searchParams,
}: PageProps<"/kategori/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Yükleniyor...</p>}>
      <CategoryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
