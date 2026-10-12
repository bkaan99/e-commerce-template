import "server-only";
import { cache } from "react";
import { NotFoundError } from "@/shared/errors";
import type {
  CategoryBreadcrumb,
  CategoryNode,
  ProductDetail,
} from "./catalog.types";
import { getRequestPricing } from "../b2b/pricing-identity";
import { catalogService } from "./container";

export type LoadResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "redirect"; to: string }
  | { kind: "missing" };

async function resolveMissing<T>(path: string): Promise<LoadResult<T>> {
  const to = await catalogService.findRedirect(path);
  return to ? { kind: "redirect", to } : { kind: "missing" };
}

/** Aynı istekte hem sayfa hem metadata için tek sorgu. */
export const loadCategory = cache(
  async (
    slug: string,
  ): Promise<
    LoadResult<{ category: CategoryNode; breadcrumbs: CategoryBreadcrumb[] }>
  > => {
    try {
      return {
        kind: "ok",
        value: await catalogService.getCategoryBySlug(slug),
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return resolveMissing(`/kategori/${slug}`);
      }
      throw error;
    }
  },
);

export const loadProduct = cache(
  async (slug: string): Promise<LoadResult<ProductDetail>> => {
    try {
      return {
        kind: "ok",
        value: await catalogService.getProductBySlug(
          slug,
          await getRequestPricing(),
        ),
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return resolveMissing(`/urun/${slug}`);
      }
      throw error;
    }
  },
);
