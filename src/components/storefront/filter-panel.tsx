import Link from "next/link";
import type { Facet, ProductListQuery } from "@/modules/catalog/catalog.types";

function FacetGroup({
  title,
  name,
  facet,
  selected,
}: {
  title: string;
  name: string;
  facet: Facet;
  selected: string[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {facet.values.map((value) => (
        <label key={value.slug} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={value.slug}
            defaultChecked={selected.includes(value.slug)}
          />
          <span>{value.value}</span>
          <span className="text-muted-foreground">({value.count})</span>
        </label>
      ))}
    </fieldset>
  );
}

/** JavaScript gerektirmeyen, GET formu tabanlı filtre paneli. */
export function FilterPanel({
  action,
  query,
  attributeFacets,
  brandFacet,
}: {
  action: string;
  query: ProductListQuery;
  attributeFacets: Facet[];
  brandFacet: Facet | null;
}) {
  return (
    <form action={action} method="get" className="flex flex-col gap-5">
      {query.search ? (
        <input type="hidden" name="q" value={query.search} />
      ) : null}
      {query.sort !== "newest" ? (
        <input type="hidden" name="sirala" value={query.sort} />
      ) : null}

      {brandFacet ? (
        <FacetGroup
          title="Marka"
          name="marka"
          facet={brandFacet}
          selected={query.brandSlugs}
        />
      ) : null}

      {attributeFacets.map((facet) => (
        <FacetGroup
          key={facet.slug}
          title={facet.name}
          name={`f.${facet.slug}`}
          facet={facet}
          selected={query.attributeFilters[facet.slug] ?? []}
        />
      ))}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Fiyat (TL)</legend>
        <div className="flex items-center gap-2">
          <input
            name="fiyat-min"
            type="number"
            min="0"
            placeholder="En az"
            defaultValue={query.minPrice}
            aria-label="En düşük fiyat"
            className="w-full rounded-theme border border-border px-2 py-1 text-sm"
          />
          <input
            name="fiyat-max"
            type="number"
            min="0"
            placeholder="En çok"
            defaultValue={query.maxPrice}
            aria-label="En yüksek fiyat"
            className="w-full rounded-theme border border-border px-2 py-1 text-sm"
          />
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-theme bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Filtrele
        </button>
        <Link
          href={
            query.search
              ? `${action}?q=${encodeURIComponent(query.search)}`
              : action
          }
          className="rounded-theme border border-border px-4 py-2 text-sm"
        >
          Temizle
        </Link>
      </div>
    </form>
  );
}
