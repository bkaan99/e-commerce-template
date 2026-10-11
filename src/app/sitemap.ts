import { connection } from "next/server";
import type { MetadataRoute } from "next";
import { catalogService } from "@/modules/catalog/container";
import { getContentService } from "@/modules/content/container";
import { absoluteUrl } from "@/shared/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Veritabanından okunur; build sırasında değil istek anında üretilir.
  await connection();

  const [categories, products, pages] = await Promise.all([
    catalogService.getCategories(),
    catalogService.listProductSlugs(),
    getContentService().publishedPageSlugs(),
  ]);

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    ...categories.map((category) => ({
      url: absoluteUrl(`/kategori/${category.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...pages.map((page) => ({
      url: absoluteUrl(`/sayfa/${page.slug}`),
      lastModified: page.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/urun/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
