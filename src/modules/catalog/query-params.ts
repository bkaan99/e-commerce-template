import {
  DEFAULT_PAGE_SIZE,
  SORT_OPTIONS,
  type ProductListQuery,
  type SortOption,
} from "./catalog.types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const ATTRIBUTE_PREFIX = "f.";
const MAX_PAGE_SIZE = 60;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function splitList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePositiveNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseSort(value: string | undefined): SortOption {
  return SORT_OPTIONS.find((option) => option === value) ?? "newest";
}

/** URL sorgu parametrelerini güvenli bir listeleme isteğine çevirir. */
export function parseListQuery(
  params: RawSearchParams,
  base: { categorySlug?: string; pageSize?: number } = {},
): ProductListQuery {
  const attributeFilters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith(ATTRIBUTE_PREFIX)) continue;
    const slug = key.slice(ATTRIBUTE_PREFIX.length);
    const values = splitList(value);
    if (slug && values.length > 0) attributeFilters[slug] = values;
  }

  const page = Math.floor(parsePositiveNumber(first(params["sayfa"])) ?? 1);
  const search = first(params["q"])?.trim();

  return {
    categorySlug: base.categorySlug,
    search: search ? search.slice(0, 100) : undefined,
    brandSlugs: splitList(params["marka"]),
    attributeFilters,
    minPrice: parsePositiveNumber(first(params["fiyat-min"])),
    maxPrice: parsePositiveNumber(first(params["fiyat-max"])),
    sort: parseSort(first(params["sirala"])),
    page: Math.max(1, page),
    pageSize: Math.min(base.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/** Listeleme isteğini URL sorgu dizesine çevirir (sayfa bağlantıları için). */
export function toSearchString(
  query: Partial<ProductListQuery>,
  overrides: { page?: number } = {},
): string {
  const params = new URLSearchParams();

  if (query.search) params.set("q", query.search);
  if (query.sort && query.sort !== "newest") params.set("sirala", query.sort);
  if (query.brandSlugs?.length) params.set("marka", query.brandSlugs.join(","));
  if (query.minPrice !== undefined) {
    params.set("fiyat-min", String(query.minPrice));
  }
  if (query.maxPrice !== undefined) {
    params.set("fiyat-max", String(query.maxPrice));
  }
  for (const [slug, values] of Object.entries(query.attributeFilters ?? {})) {
    if (values.length > 0)
      params.set(`${ATTRIBUTE_PREFIX}${slug}`, values.join(","));
  }

  const page = overrides.page ?? query.page ?? 1;
  if (page > 1) params.set("sayfa", String(page));

  const text = params.toString();
  return text ? `?${text}` : "";
}
