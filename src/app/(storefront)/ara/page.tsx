import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterPanel } from "@/components/storefront/filter-panel";
import { Pagination } from "@/components/storefront/pagination";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SortLinks } from "@/components/storefront/sort-links";
import { getRequestPricing } from "@/modules/b2b/pricing-identity";
import { catalogService } from "@/modules/catalog/container";
import { parseListQuery, toSearchString } from "@/modules/catalog/query-params";

export const metadata: Metadata = {
  title: "Arama",
  robots: { index: false, follow: true },
};

async function SearchContent({
  searchParams,
}: Pick<PageProps<"/ara">, "searchParams">) {
  const query = parseListQuery(await searchParams);

  if (!query.search) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Aramak istediğiniz ürünü yazın.
      </p>
    );
  }

  const result = await catalogService.list(query, await getRequestPricing());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        “{query.search}” için {result.total} sonuç
      </h1>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filtreler">
          <FilterPanel
            action="/ara"
            query={query}
            attributeFacets={result.attributeFacets}
            brandFacet={result.brandFacet}
          />
        </aside>
        <div className="flex flex-col gap-6">
          <SortLinks basePath="/ara" query={query} />
          <ProductGrid products={result.items} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            hrefFor={(page) => `/ara${toSearchString(query, { page })}`}
          />
        </div>
      </div>
    </div>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/ara">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Aranıyor...</p>}>
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}
