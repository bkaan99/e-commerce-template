export type SortOption = "newest" | "price-asc" | "price-desc" | "name";

export const SORT_OPTIONS: readonly SortOption[] = [
  "newest",
  "price-asc",
  "price-desc",
  "name",
];

export const DEFAULT_PAGE_SIZE = 24;

/** Listeleme isteği: kategori, arama, filtreler, sıralama ve sayfalama. */
export interface ProductListQuery {
  categorySlug?: string;
  search?: string;
  brandSlugs: string[];
  /** nitelik slug'ı → seçilen değer slug'ları (aynı nitelikte VEYA, nitelikler arası VE) */
  attributeFilters: Record<string, string[]>;
  minPrice?: number;
  maxPrice?: number;
  sort: SortOption;
  page: number;
  pageSize: number;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  imageUrl: string | null;
  imageAlt: string;
  /** false ise fiyat gösterilmez (yalnızca-B2B modunda girişsiz ziyaretçi) */
  priceVisible: boolean;
  /** En düşük aktif varyant fiyatı (ondalık string) */
  price: string;
  compareAtPrice: string | null;
  /** Varyantların fiyatları farklıysa "…'den başlayan" gösterilir */
  hasPriceRange: boolean;
  currency: string;
  inStock: boolean;
}

export interface FacetValue {
  value: string;
  slug: string;
  count: number;
}

export interface Facet {
  slug: string;
  name: string;
  values: FacetValue[];
}

export interface ProductListResult {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  attributeFacets: Facet[];
  brandFacet: Facet | null;
}

export interface CategoryNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sortOrder: number;
}

export interface CategoryBreadcrumb {
  name: string;
  slug: string;
}

export interface ProductImageView {
  url: string;
  alt: string;
  /** Doluysa görsel yalnızca bu seçeneğe (örn. renk) aittir */
  optionValueId: string | null;
}

export interface ProductOptionView {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

export interface VariantView {
  id: string;
  sku: string;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  inStock: boolean;
  /** Stok takibi yoksa null */
  availableQuantity: number | null;
  optionValueIds: string[];
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceVisible: boolean;
  categoryId: string;
  brand: { name: string; slug: string } | null;
  breadcrumbs: CategoryBreadcrumb[];
  seoTitle: string | null;
  seoDescription: string | null;
  images: ProductImageView[];
  options: ProductOptionView[];
  variants: VariantView[];
  attributes: { name: string; values: string[] }[];
  taxRate: string;
}
