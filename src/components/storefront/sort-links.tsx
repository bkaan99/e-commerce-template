import Link from "next/link";
import type {
  ProductListQuery,
  SortOption,
} from "@/modules/catalog/catalog.types";
import { toSearchString } from "@/modules/catalog/query-params";

const LABELS: Record<SortOption, string> = {
  newest: "En yeni",
  "price-asc": "Fiyat (artan)",
  "price-desc": "Fiyat (azalan)",
  name: "İsim (A-Z)",
};

export function SortLinks({
  basePath,
  query,
}: {
  basePath: string;
  query: ProductListQuery;
}) {
  return (
    <nav
      aria-label="Sıralama"
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <span className="text-muted-foreground">Sırala:</span>
      {(Object.keys(LABELS) as SortOption[]).map((option) => (
        <Link
          key={option}
          href={`${basePath}${toSearchString({ ...query, sort: option }, { page: 1 })}`}
          aria-current={query.sort === option ? "true" : undefined}
          className={
            query.sort === option
              ? "font-semibold underline"
              : "text-muted-foreground hover:text-foreground"
          }
        >
          {LABELS[option]}
        </Link>
      ))}
    </nav>
  );
}
