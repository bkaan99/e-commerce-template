import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductGrid } from "@/components/storefront/product-grid";
import { isFeatureEnabled } from "@/config/features";
import { getCurrentUser } from "@/modules/auth/session";
import { getRequestPricing } from "@/modules/b2b/pricing-identity";
import { catalogService } from "@/modules/catalog/container";
import { wishlistService } from "@/modules/wishlist/container";
import { GuestWishlist } from "./guest-wishlist";

export const metadata: Metadata = {
  title: "Favorilerim",
  robots: { index: false },
};

async function WishlistContent() {
  const user = await getCurrentUser();
  if (!user) return <GuestWishlist />;

  const ids = await wishlistService.list(user.id);
  const cards = await catalogService.getCardsInOrder(
    ids,
    await getRequestPricing(),
  );

  if (cards.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Henüz favori ürününüz yok.
      </p>
    );
  }

  return <ProductGrid products={cards} />;
}

export default function WishlistPage() {
  if (!isFeatureEnabled("wishlist")) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Favorilerim</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <WishlistContent />
      </Suspense>
    </div>
  );
}
