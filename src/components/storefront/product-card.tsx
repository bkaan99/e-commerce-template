import Image from "next/image";
import Link from "next/link";
import { isFeatureEnabled } from "@/config/features";
import type { ProductCard as ProductCardData } from "@/modules/catalog/catalog.types";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { Price } from "./price";

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <article className="group relative flex flex-col gap-3">
      <Link href={`/urun/${product.slug}`} className="flex flex-col gap-3">
        <div className="relative aspect-square overflow-hidden rounded-theme bg-muted">
          <Image
            src={product.imageUrl ?? "/placeholder.svg"}
            alt={product.imageAlt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
          {!product.inStock ? (
            <span className="absolute left-2 top-2 rounded bg-foreground px-2 py-1 text-xs text-background">
              Tükendi
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          {product.brandName ? (
            <span className="text-xs text-muted-foreground">
              {product.brandName}
            </span>
          ) : null}
          <h3 className="text-sm font-medium">{product.name}</h3>
          {product.priceVisible ? (
            <Price
              value={product.price}
              compareAt={product.compareAtPrice}
              currency={product.currency}
              prefix={product.hasPriceRange ? "’den başlayan" : undefined}
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              Fiyat için giriş yapın
            </span>
          )}
        </div>
      </Link>
      {isFeatureEnabled("wishlist") ? (
        <WishlistButton
          productId={product.id}
          className="absolute right-2 top-2"
        />
      ) : null}
    </article>
  );
}
