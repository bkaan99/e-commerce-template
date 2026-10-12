import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { BannerGrid } from "@/components/storefront/banner-grid";
import { ProductGrid } from "@/components/storefront/product-grid";
import { siteConfig } from "@/config/site.config";
import { getCategoryTree } from "@/modules/catalog/cached";
import { getRequestPricing } from "@/modules/b2b/pricing-identity";
import { catalogService } from "@/modules/catalog/container";

async function FeaturedProducts() {
  await connection();
  const products = await catalogService.getHomepageProducts(
    8,
    await getRequestPricing(),
  );
  return <ProductGrid products={products} />;
}

async function CategoryTiles() {
  await connection();
  const tree = await getCategoryTree();

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tree.map((category) => (
        <li key={category.id}>
          <Link
            href={`/kategori/${category.slug}`}
            className="flex h-24 items-center justify-center rounded-theme bg-muted text-center font-medium hover:bg-border"
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-2 rounded-theme bg-muted p-8">
        <h1 className="text-3xl font-semibold">{siteConfig.name}</h1>
        <p className="text-muted-foreground">{siteConfig.description}</p>
      </section>

      <Suspense fallback={null}>
        <BannerGrid />
      </Suspense>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Kategoriler</h2>
        <Suspense fallback={null}>
          <CategoryTiles />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Öne çıkan ürünler</h2>
        <Suspense
          fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
        >
          <FeaturedProducts />
        </Suspense>
      </section>
    </div>
  );
}
