import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { isFeatureEnabled } from "@/config/features";
import { siteConfig } from "@/config/site.config";
import { getCategoryTree } from "@/modules/catalog/cached";
import { getCachedMenu } from "@/modules/content/cached";
import { AccountLink } from "./account-link";
import { CartBadge } from "./cart-badge";

async function CategoryNav() {
  await connection();
  const [tree, extra] = await Promise.all([
    getCategoryTree(),
    getCachedMenu("header"),
  ]);

  return (
    <nav
      aria-label="Kategoriler"
      className="flex flex-wrap gap-x-5 gap-y-1 text-sm"
    >
      {tree.map((category) => (
        <Link
          key={category.id}
          href={`/kategori/${category.slug}`}
          className="hover:underline"
        >
          {category.name}
        </Link>
      ))}
      {extra.map((item) => (
        <Link
          key={`${item.label}-${item.url}`}
          href={item.url}
          className="text-muted-foreground hover:underline"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold">
            {siteConfig.name}
          </Link>
          <form
            action="/ara"
            role="search"
            className="hidden flex-1 sm:block sm:max-w-sm"
          >
            <input
              name="q"
              type="search"
              placeholder="Ürün ara"
              aria-label="Ürün ara"
              className="w-full rounded-theme border border-border px-3 py-2 text-sm"
            />
          </form>
          <div className="flex items-center gap-4">
            {isFeatureEnabled("wishlist") ? (
              <Link href="/favoriler" className="text-sm">
                Favoriler
              </Link>
            ) : null}
            <Suspense fallback={<span className="text-sm">&nbsp;</span>}>
              <AccountLink />
            </Suspense>
            <Suspense fallback={<span className="text-sm">Sepet</span>}>
              <CartBadge />
            </Suspense>
          </div>
        </div>
        <Suspense fallback={null}>
          <CategoryNav />
        </Suspense>
      </div>
    </header>
  );
}
